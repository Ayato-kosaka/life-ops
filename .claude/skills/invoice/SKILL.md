---
name: invoice
description: 請求書PDFを対話で作成し、Google Driveに保存して、完了をGitHub Issueで本人に通知する。「請求書を作って」「〇〇宛の請求書」「請求書を修正して再アップロード」などの依頼で使う。
---

# 請求書作成

ヒアリング → PDF生成 → Google Drive保存 → GitHub通知 までを一続きで行う。
必要な情報が揃っていれば、途中で承認を求めずに最後まで実行してよい。

## 置き場所の原則（公開リポジトリ）

- 請求書PDF・請求データ・請求元／請求先／口座情報は **Google Drive にだけ置く**。リポジトリに書かない、コミットしない。
- 作業ファイルはリポジトリの外（セッションのスクラッチパッド、なければ `${TMPDIR:-/tmp}/invoice/`）に作る。
- GitHub（Issue・コメント・コミット）には請求先名・金額・口座・DriveのURLを書かない。書いてよいのは請求書番号まで。

## Google Drive の構成

保存先フォルダID: `1UoBTtgJ220Q0341VtOFVpEh7jVIcpOIs`（以下 `$ROOT`）

```
$ROOT/
├── 請求書_<番号>_<件名の短縮>.pdf     # 請求書の実体
└── _data/
    ├── profile.json                   # 再利用する情報（請求元・口座・既定値・請求先）
    └── invoices/<番号>.json            # 請求書ごとの入力データ（再生成・修正・次回の雛形に使う）
```

Drive 操作は `node tools/gdrive/gdrive.mjs`（以下 `gdrive`）で行う。認証は環境変数
`GDRIVE_CLIENT_ID` / `GDRIVE_CLIENT_SECRET` / `GDRIVE_REFRESH_TOKEN`。詳細は `tools/gdrive/README.md`。

### profile.json

```json
{
  "issuer": { "name": "", "postalCode": "", "address": "", "registrationNumber": null },
  "bank": { "bankName": "", "branch": "", "accountType": "普通", "accountNumber": "", "accountHolder": "" },
  "defaults": {
    "taxRate": 0.1,
    "taxRounding": "round",
    "itemsTotalLabel": "業務委託料 計（税込）",
    "notes": ["…"]
  },
  "clients": {
    "<英数字のキー>": {
      "company": "", "person": "〇〇 様", "postalCode": "", "address": "",
      "due": { "rule": "next-month-end" }
    }
  }
}
```

`due`（支払期日の既定ルール。依頼で指定があればそちらを優先し、新しい条件が今後も続くなら profile を更新する）:

| rule | 支払期日 | dueNote |
|---|---|---|
| `next-month-end` | 請求日の翌月末日 | なし |
| `month-end` | 請求日の当月末日 | なし |
| `days`（`days`, `from`） | 起点日 + `days` 日。`from` は `issue`（請求日）か `acceptance`（検収完了日） | `acceptance` のとき `※検収完了日（2026年10月9日）の翌日から起算して14日目` の形で書く |

### invoices/<番号>.json

`render.mjs` にそのまま渡せる完成形（profile の内容もコピーして自己完結させる）。形式は `example.json` を参照。
加えて管理用に次を持つ（描画には使われない）:

```json
{ "clientKey": "<clients のキー>", "revision": 1, "drive": { "pdfId": "" }, "github": { "issue": 0 } }
```

## 手順

### 1. 準備

1. `gdrive whoami` で認証を確認する。失敗したら PDF 生成までは進め、PDF をユーザーに渡したうえで
   「Drive 認証が未設定のためアップロードできない」と伝える（成功通知は送らない）。
   認証の設定・再設定がユーザー作業として必要なら、その Issue（初回設定は #103）に手順を書いて通知する。
2. `gdrive get --folder $ROOT --path _data/profile.json --out <work>/profile.json` で再利用情報を読む。
   無ければ請求元・口座情報をヒアリングして作る。
3. `gdrive ls --folder $ROOT --path _data/invoices` で既存の請求データを確認する。同じ請求先の直近の請求があれば
   `get` して雛形にする（件名・明細の書き方・経費の項目を踏襲できる）。

### 2. ヒアリング（足りないものだけ聞く）

profile と直近の請求から埋まるものは聞かない。毎回聞く必要があるのは通常これだけ:

- 請求先（既知の請求先なら名前だけで特定する。表記ゆれは profile の請求先に寄せる）
- 対象月・件名と明細（内容・数量・単価）
- 立替経費の有無と内訳

既定値（聞かずに決める）:

- 請求日: 今日
- 支払期日: profile の `due`。検収完了日は**依頼で指定された場合だけ**使う（聞かない）
- 金額: 「税込30万」のように税込で指定されたら `itemsTaxIncluded: true` にして単価に税込額を書く
  （税抜換算と消費税は `render.mjs` が計算し、税込額に必ず一致させる）。「税抜」と言われたら `false`
- 立替経費の月表記: 指定がなければ請求の対象月
- 備考: profile の `defaults.notes`。立替経費が無い請求では立替経費についての行を外す

依頼の内容で埋まらない必須項目があるときだけ、まとめて一度に聞く。推測で埋めた値は報告時に明示する。
新しい請求先・変わった情報は profile に反映する。

#### 依頼の例

> テクノロッキーの10月分の請求書作って。・税込30万固定給 ・翌月末払い　経費 ・Claude code 27,437

→ 請求先 `techno-rocky`、件名 `業務委託料（2026年10月分）`、明細 `業務委託料（2026年10月分・月額固定）` 1式 300,000（`itemsTaxIncluded: true`）、
支払期日は請求日の翌月末、立替経費 `Claude Code 利用料（2026年10月分）` 1式 27,437。質問せずに最後まで実行する。

### 3. 請求データを作る

- 番号: `INV-<請求日YYYYMMDD>-<連番3桁>`。連番は `_data/invoices/` にある同じ日付の番号の最大値 + 1（無ければ 001）。
- 支払期日: 依頼の指定、無ければ profile の `due` から計算する（`dueNote` は上の表に従う）。
- 金額の計算はしない（`render.mjs` が小計・消費税・合計を計算して出力する）。
- `<work>/<番号>.json` に保存する。`revision` は 1。

### 4. PDF を生成して確認する

```bash
node .claude/skills/invoice/render.mjs <work>/<番号>.json --out <work>/<番号>.pdf
```

出力された `totals` とヒアリング内容が一致するか確認する。可能なら `pdftoppm -png -r 70` で画像化して見た目を確認する。

### 5. Google Drive に保存する

PDF → JSON → profile の順に保存する。PDF のファイル名は `請求書_<番号>_<件名の短縮>.pdf`。

```bash
gdrive put <work>/<番号>.pdf --folder $ROOT --name "請求書_<番号>_<件名の短縮>.pdf"   # 返り値の id を drive.pdfId に記録
gdrive put <work>/<番号>.json --folder $ROOT --path _data/invoices
gdrive put <work>/profile.json --folder $ROOT --path _data                           # 変更があった場合のみ
```

### 6. 通知する（保存がすべて成功した場合のみ）

通知の仕組みと Issue の扱いは `CLAUDE.md` の「本人への通知」に従う。請求書では:

- 関連する既存 Issue（例: 「10月分の請求書を出す」）があればそれを使う。無ければ
  `請求書作成: <番号>` という Issue を作る。番号を `github.issue` に記録し、JSON を再度 `put` する。
- `github-message` で通知する。`dedupe-key` は `invoice:<番号>:r<revision>`（同じ版を二重に通知しない）。
- 本文の例（番号以外の請求内容は書かない）:
  > 請求書 `INV-20261023-001`（第1版）を作成し、Google Drive に保存しました。内容を確認し、修正があれば Claude Code のセッションで指摘してください。
- 自分で作った Issue は通知後にクローズする（請求書の作成が完了条件のため）。既存 Issue はその完了条件を満たす場合のみクローズする。

### 7. ユーザーへの報告

チャットでは、番号・請求先・合計金額・支払期日・Drive の PDF の URL を報告し、PDF ファイルも渡す（チャットは公開されない）。

## 修正して再アップロードするとき

1. `_data/invoices/<番号>.json` を `get` し、指摘箇所を直して `revision` を +1 する（番号は変えない）。
2. 再生成し、`gdrive put <pdf> --id <drive.pdfId> --name <新しいファイル名>` で**同じファイルを更新**する
   （URL が変わらず、Drive の版履歴にも残る）。JSON も `put` し直す。
3. `github.issue` の Issue に `dedupe-key: invoice:<番号>:r<revision>` で通知する（クローズ済みのままでよい）。

## 改善するとき

- レイアウト: `style.css`（見た目）と `render.mjs` の `buildHtml`（構造）。`example.json` で確認する。
- フローで繰り返し詰まった点や、ヒアリングで毎回聞いている項目があれば、この SKILL.md か profile.json の既定値に反映する。
