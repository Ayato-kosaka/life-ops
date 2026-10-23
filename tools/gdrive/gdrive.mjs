#!/usr/bin/env node
// Google Drive 汎用CLI（依存なし・Node 18+）
// 認証は環境変数から読む:
//   GDRIVE_CLIENT_ID / GDRIVE_CLIENT_SECRET / GDRIVE_REFRESH_TOKEN（OAuthユーザー認証）
//   または GDRIVE_ACCESS_TOKEN（取得済みのアクセストークンを直接使う場合）
// 使い方は `node tools/gdrive/gdrive.mjs help` または tools/gdrive/README.md を参照。

import { readFile, writeFile } from "node:fs/promises";
import { basename, extname } from "node:path";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const FILE_FIELDS = "id,name,mimeType,modifiedTime,size,webViewLink,parents";
const SCOPE = "https://www.googleapis.com/auth/drive";
const REDIRECT_URI = "http://localhost";

const MIME_BY_EXT = {
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".html": "text/html",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const HELP = `Usage: node tools/gdrive/gdrive.mjs <command> [options]

Commands:
  whoami                                  認証の確認（アカウントのメールアドレスを表示）
  ls      --folder <id> [--path a/b]      フォルダ直下の一覧
  stat    (--id <id> | --folder <id> --path a/b/file)
                                          ファイルのメタデータ
  get     (--id <id> | --folder <id> --path a/b/file) [--out <local>] [--export <mime>]
                                          ダウンロード（--out 省略時は標準出力）
  put     <local> (--id <id> | --folder <id> [--path a/b]) [--name <name>] [--mime <mime>]
                                          アップロード。同名ファイルがあれば中身を更新（IDとURLを維持）
                                          --id 指定時はそのファイルを更新（--name でリネームも可）
  mkdir   --folder <id> --path a/b        フォルダを作成（既存なら再利用、mkdir -p 相当）
  trash   --id <id>                       ゴミ箱へ移動
  auth    [--code <code or redirected URL>]
                                          リフレッシュトークン取得の補助（ローカルで実行すること）

Output: 標準出力にJSON（get の本文出力時を除く）`;

// ---------- args ----------

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = { _: [] };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next === undefined || next.startsWith("--")) opts[key] = true;
      else opts[key] = rest[++i];
    } else {
      opts._.push(a);
    }
  }
  return { command, opts };
}

function need(opts, key) {
  if (!opts[key] || opts[key] === true) fail(`--${key} が必要です`);
  return opts[key];
}

function fail(message) {
  const err = new Error(message);
  err.userError = true;
  throw err;
}

// ---------- auth ----------

let cachedToken;

async function accessToken() {
  if (cachedToken) return cachedToken;
  if (process.env.GDRIVE_ACCESS_TOKEN) return (cachedToken = process.env.GDRIVE_ACCESS_TOKEN);
  const { GDRIVE_CLIENT_ID: id, GDRIVE_CLIENT_SECRET: secret, GDRIVE_REFRESH_TOKEN: refresh } = process.env;
  if (!id || !secret || !refresh) {
    fail("認証情報がありません。GDRIVE_CLIENT_ID / GDRIVE_CLIENT_SECRET / GDRIVE_REFRESH_TOKEN を設定してください");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }),
  });
  const body = await res.json();
  if (!res.ok) fail(`トークン更新に失敗しました: ${body.error} ${body.error_description ?? ""}`);
  return (cachedToken = body.access_token);
}

async function api(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, ...init.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    fail(`Drive API ${res.status}: ${text}`);
  }
  return res;
}

const qs = (params) => new URLSearchParams({ supportsAllDrives: "true", ...params }).toString();

// ---------- drive primitives ----------

const escapeQ = (s) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function list(folderId, extraQ = "") {
  const files = [];
  let pageToken;
  do {
    const params = {
      q: `'${escapeQ(folderId)}' in parents and trashed = false${extraQ}`,
      fields: `nextPageToken,files(${FILE_FIELDS})`,
      pageSize: "1000",
      orderBy: "folder,name",
      includeItemsFromAllDrives: "true",
    };
    if (pageToken) params.pageToken = pageToken;
    const body = await (await api(`${API}/files?${qs(params)}`)).json();
    files.push(...body.files);
    pageToken = body.nextPageToken;
  } while (pageToken);
  return files;
}

async function findChild(folderId, name) {
  const hits = await list(folderId, ` and name = '${escapeQ(name)}'`);
  if (hits.length > 1) fail(`同名のファイルが複数あります: ${name}（--id で指定してください）`);
  return hits[0];
}

const splitPath = (p) => (p ? String(p).split("/").filter(Boolean) : []);

async function createFolder(parentId, name) {
  const res = await api(`${API}/files?${qs({ fields: FILE_FIELDS })}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  return res.json();
}

// フォルダパスを辿ってIDを返す。create=true なら途中のフォルダを作る
async function resolveFolder(rootId, path, { create = false } = {}) {
  let current = rootId;
  for (const seg of splitPath(path)) {
    let child = await findChild(current, seg);
    if (!child) {
      if (!create) fail(`フォルダが見つかりません: ${path}`);
      child = await createFolder(current, seg);
    } else if (child.mimeType !== FOLDER_MIME) {
      fail(`フォルダではありません: ${seg}`);
    }
    current = child.id;
  }
  return current;
}

async function statById(id) {
  return (await api(`${API}/files/${encodeURIComponent(id)}?${qs({ fields: FILE_FIELDS })}`)).json();
}

// --id または --folder + --path でファイルを特定する
async function locate(opts) {
  if (opts.id) return statById(opts.id);
  const folder = need(opts, "folder");
  const segs = splitPath(need(opts, "path"));
  const name = segs.pop();
  const parent = await resolveFolder(folder, segs.join("/"));
  const file = await findChild(parent, name);
  if (!file) fail(`ファイルが見つかりません: ${opts.path}`);
  return file;
}

function multipart(metadata, content, mime) {
  const boundary = `gdrive-${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--`);
  return { body: Buffer.concat([head, content, tail]), contentType: `multipart/related; boundary=${boundary}` };
}

// ---------- commands ----------

const commands = {
  async whoami() {
    const body = await (await api(`${API}/about?fields=user(emailAddress,displayName)`)).json();
    return body.user;
  },

  async ls(opts) {
    const folder = await resolveFolder(need(opts, "folder"), opts.path);
    return list(folder);
  },

  async stat(opts) {
    return locate(opts);
  },

  async get(opts) {
    const file = await locate(opts);
    const isNative = file.mimeType.startsWith("application/vnd.google-apps.");
    const url = isNative
      ? `${API}/files/${file.id}/export?${new URLSearchParams({ mimeType: opts.export || "text/plain" })}`
      : `${API}/files/${file.id}?${qs({ alt: "media" })}`;
    const data = Buffer.from(await (await api(url)).arrayBuffer());
    if (opts.out) {
      await writeFile(opts.out, data);
      return { ...file, savedTo: opts.out };
    }
    process.stdout.write(data);
    return undefined;
  },

  async put(opts) {
    const local = opts._[0] ?? fail("アップロードするローカルファイルを指定してください");
    const content = await readFile(local);
    const mime = opts.mime || MIME_BY_EXT[extname(local).toLowerCase()] || "application/octet-stream";
    const name = opts.name || basename(local);

    let target;
    if (opts.id) {
      target = await statById(opts.id);
    } else {
      const parent = await resolveFolder(need(opts, "folder"), opts.path, { create: true });
      target = (await findChild(parent, name)) ?? { parent };
    }

    if (target.id) {
      const metadata = opts.name ? { name } : {};
      const { body, contentType } = multipart(metadata, content, mime);
      const res = await api(`${UPLOAD}/files/${target.id}?${qs({ uploadType: "multipart", fields: FILE_FIELDS })}`, {
        method: "PATCH",
        headers: { "Content-Type": contentType },
        body,
      });
      return { action: "updated", ...(await res.json()) };
    }
    const { body, contentType } = multipart({ name, parents: [target.parent] }, content, mime);
    const res = await api(`${UPLOAD}/files?${qs({ uploadType: "multipart", fields: FILE_FIELDS })}`, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    });
    return { action: "created", ...(await res.json()) };
  },

  async mkdir(opts) {
    const id = await resolveFolder(need(opts, "folder"), need(opts, "path"), { create: true });
    return statById(id);
  },

  async trash(opts) {
    const id = need(opts, "id");
    const res = await api(`${API}/files/${encodeURIComponent(id)}?${qs({ fields: FILE_FIELDS })}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    });
    return { action: "trashed", ...(await res.json()) };
  },

  async auth(opts) {
    const { GDRIVE_CLIENT_ID: id, GDRIVE_CLIENT_SECRET: secret } = process.env;
    if (!id || !secret) fail("GDRIVE_CLIENT_ID / GDRIVE_CLIENT_SECRET を設定してから実行してください");
    if (!opts.code) {
      const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: id,
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        scope: SCOPE,
        access_type: "offline",
        prompt: "consent",
      })}`;
      return {
        step: "1/2",
        message:
          "このURLをブラウザで開いて許可してください。許可後に http://localhost/?code=... へ移動します" +
          "（ページは表示エラーで構いません）。アドレスバーのURLを --code に渡して再実行してください。",
        url,
      };
    }
    const code = opts.code.includes("code=") ? new URL(opts.code).searchParams.get("code") : opts.code;
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({ client_id: id, client_secret: secret, code, redirect_uri: REDIRECT_URI, grant_type: "authorization_code" }),
    });
    const body = await res.json();
    if (!res.ok) fail(`コード交換に失敗しました: ${body.error} ${body.error_description ?? ""}`);
    if (!body.refresh_token) fail("refresh_token が返りませんでした。prompt=consent で再度許可してください");
    return {
      step: "2/2",
      message: "GDRIVE_REFRESH_TOKEN として保存してください（チャットやリポジトリには貼らないこと）",
      refresh_token: body.refresh_token,
    };
  },
};

// ---------- main ----------

const { command, opts } = parseArgs(process.argv.slice(2));
if (!command || command === "help" || !commands[command]) {
  console.log(HELP);
  process.exit(command && command !== "help" ? 2 : 0);
}
try {
  const result = await commands[command](opts);
  if (result !== undefined) console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error(err.userError ? `error: ${err.message}` : err);
  process.exit(1);
}
