#!/usr/bin/env node
// 公開リポジトリの GitHub Actions と機密データをやり取りするための暗号化CLI（依存なし）。
// RSA-OAEP(SHA-256) で AES-256-GCM の鍵を包み、平文は gzip してから暗号化する。出力は1行の base64。
//
//   keygen --private <file> [--public <file>]   鍵ペアを作る（公開鍵は1行の base64 DER で出力）
//   seal   <file|-> --pub <base64DER|PEMファイル>  暗号化して標準出力へ
//   open   <file|-> --key <PEMファイル> [--out <file>]
//                                               復号（--out 省略時は標準出力）
//
// 公開鍵は1行の base64 DER（workflow の入力にそのまま渡せる形）か PEM ファイルのどちらでも受け付ける。

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import crypto from "node:crypto";
import zlib from "node:zlib";

const VERSION = 1;

async function readInput(src) {
  if (!src || src === "-") {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    return Buffer.concat(chunks);
  }
  return readFile(src);
}

async function publicKey(spec) {
  const text = existsSync(spec) ? (await readFile(spec, "utf8")) : spec;
  if (text.includes("BEGIN")) return crypto.createPublicKey(text);
  return crypto.createPublicKey({ key: Buffer.from(text.replace(/\s+/g, ""), "base64"), format: "der", type: "spki" });
}

export function seal(plain, pub) {
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(zlib.gzipSync(plain)), cipher.final()]);
  const wrapped = crypto.publicEncrypt({ key: pub, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, key);
  const len = Buffer.alloc(2);
  len.writeUInt16BE(wrapped.length);
  return Buffer.concat([Buffer.from([VERSION]), len, wrapped, iv, cipher.getAuthTag(), body]).toString("base64");
}

export function open(sealed, priv) {
  const buf = Buffer.from(sealed.toString().trim(), "base64");
  if (buf[0] !== VERSION) throw new Error(`unsupported sealbox version: ${buf[0]}`);
  const n = buf.readUInt16BE(1);
  let p = 3;
  const wrapped = buf.subarray(p, (p += n));
  const iv = buf.subarray(p, (p += 12));
  const tag = buf.subarray(p, (p += 16));
  const key = crypto.privateDecrypt({ key: priv, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, wrapped);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return zlib.gunzipSync(Buffer.concat([decipher.update(buf.subarray(p)), decipher.final()]));
}

function parse(argv) {
  const [command, ...rest] = argv;
  const opts = { _: [] };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith("--")) opts[rest[i].slice(2)] = rest[++i];
    else opts._.push(rest[i]);
  }
  return { command, opts };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { command, opts } = parse(process.argv.slice(2));
  try {
    if (command === "keygen") {
      if (!opts.private) throw new Error("--private が必要です");
      const { publicKey: pub, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 3072 });
      await writeFile(opts.private, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
      const der = pub.export({ type: "spki", format: "der" }).toString("base64");
      if (opts.public) await writeFile(opts.public, der + "\n");
      console.log(der);
    } else if (command === "seal") {
      if (!opts.pub) throw new Error("--pub が必要です");
      console.log(seal(await readInput(opts._[0]), await publicKey(opts.pub)));
    } else if (command === "open") {
      if (!opts.key) throw new Error("--key が必要です");
      const plain = open(await readInput(opts._[0]), crypto.createPrivateKey(await readFile(opts.key)));
      if (opts.out) await writeFile(opts.out, plain);
      else process.stdout.write(plain);
    } else {
      console.log("usage: sealbox.mjs keygen|seal|open ...（先頭のコメント参照）");
      process.exit(command ? 2 : 0);
    }
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}
