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

セッションは Google の認証情報を持たない。Drive の読み書きは GitHub Actions に任せ、データは sealbox で暗号化して渡す
（流れは `CLAUDE.md` の「セッションから Google Drive を使う」）。以下の「`gdrive.yml` で get」などはその流れで実行することを指す。

- 読み書き全般: `gdrive.yml`（`folder: $ROOT`）
- PDF生成 → 保存 → 通知: `invoice.yml`（PDF は大きく入力に収まらないため、Actions 側で `render.mjs` を実行して作る）

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

1. 返信用の鍵を作る（`<work>/reply.pem`）。以降の Actions 呼び出しで使い回してよい。
2. `gdrive.yml` で `get`（`path: _data/profile.json`）し、再利用情報を読む。無ければ請求元・口座情報をヒアリングして作る。
3. `gdrive.yml` で `ls`（`path: _data/invoices`）し、既存の請求データを確認する。同じ請求先の直近の請求があれば
   `get` して雛形にする（件名・明細の書き方・経費の項目を踏襲できる）。
4. Actions が失敗する（認証切れなど）場合は、PDF をローカル生成してユーザーに渡し、保存できなかったことを伝える。
   認証の再設定などユーザー作業が必要なら、その Issue を作って手順を書き、通知する。

### 2. ヒアリング（足りないものだけ聞く）

profile と直近の請求から埋まるものは聞かない。毎回聞く必要があるのは通常これだけ:

- 請求先（既知の請求先なら名前だけで特定する。表記ゆれは profile の請求先に寄せる）
- 対象月・件名と明細（内容・数量・単価）
- 立替経費の有無と内訳

既定値（聞かずに決める）:

- 請求日: 今日
- 支払期日: profile の `due`。検収完了日は**依頼で指定された場合だけ**使う（聞かない）
- 金額: 「税込20万」のように税込で指定されたら `itemsTaxIncluded: true` にして単価に税込額を書く
  （税抜換算と消費税は `render.mjs` が計算し、税込額に必ず一致させる）。「税抜」と言われたら `false`
- 立替経費の月表記: 指定がなければ請求の対象月
- 備考: profile の `defaults.notes`。立替経費が無い請求では立替経費についての行を外す

依頼の内容で埋まらない必須項目があるときだけ、まとめて一度に聞く。推測で埋めた値は報告時に明示する。
新しい請求先・変わった情報は profile に反映する。

#### 依頼の例

> サンプル社の10月分の請求書作って。・税込20万固定給 ・翌月末払い　経費 ・Claude code 10,000

→ 請求先 `sample`、件名 `業務委託料（2026年10月分）`、明細 `業務委託料（2026年10月分・月額固定）` 1式 200,000（`itemsTaxIncluded: true`）、
支払期日は請求日の翌月末、立替経費 `Claude Code 利用料（2026年10月分）` 1式 10,000。質問せずに最後まで実行する。
（例は架空。実在の請求先名・金額をリポジトリに書かないこと）

### 3. 請求データを作る

- 番号: `INV-<請求日YYYYMMDD>-<連番3桁>`。連番は `_data/invoices/` にある同じ日付の番号の最大値 + 1（無ければ 001）。
- 支払期日: 依頼の指定、無ければ profile の `due` から計算する（`dueNote` は上の表に従う）。
- 金額の計算はしない（`render.mjs` が小計・消費税・合計を計算して出力する）。
- `<work>/<番号>.json` に保存する。`revision` は 1。

### 4. PDF をローカルで生成して確認する

```bash
node .claude/skills/invoice/render.mjs <work>/<番号>.json --out <work>/<番号>.pdf
```

出力された `totals` とヒアリング内容が一致するか確認する。可能なら `pdftoppm -png -r 70` で画像化して見た目を確認する。
（保存用の PDF は Actions 側で同じコードから生成される）

### 5. 通知先の Issue を決める

通知と Issue の扱いは `CLAUDE.md` に従う。関連する既存 Issue（例: 「10月分の請求書を出す」）があればそれを使い、
無ければ `請求書作成: <番号>` という Issue を作る（本文にも番号以外の請求内容は書かない）。番号を `github.issue` に記録する。

### 6. Google Drive に保存して通知する

1. profile に変更があれば、`gdrive.yml` で `put`（`path: _data`, `name: profile.json`, `payload`: 暗号化した profile.json）。
2. `{"invoice": <番号>.json の中身, "pdfName": "請求書_<番号>_<件名の短縮>.pdf"}` を暗号化して `payload` にし、
   `invoice.yml` を起動する（`number`, `revision`, `issue`, `reply-key`, `request-id`）。
   - Actions が PDF を生成 → Drive に保存（`drive.pdfId` があれば同じファイルを更新）→ `_data/invoices/<番号>.json` を保存し、
     **すべて成功した場合だけ** `github-message` で通知する（`dedupe-key: invoice:<番号>:r<revision>`）。
   - 失敗したら通知は送られない。ログ（機密は出ない）で原因を直し、同じ `revision` で再実行してよい（二重通知はされない）。
3. 返ってきた結果（`pdfId`・`webViewLink`・`totals`）を確認する。`totals` がローカル生成と一致すること。
4. 自分で作った Issue は、notify ジョブの成功を確認してからクローズする。既存 Issue はその完了条件を満たす場合のみクローズする。

### 7. ユーザーへの報告

チャットでは、番号・請求先・合計金額・支払期日・Drive の PDF の URL を報告し、PDF ファイルも渡す（チャットは公開されない）。

## 修正して再アップロードするとき

1. `gdrive.yml` で `_data/invoices/<番号>.json` を `get` し、指摘箇所を直して `revision` を +1 する（番号は変えない）。
2. ローカルで再生成して確認し、手順 6-2 と同じく `invoice.yml` を起動する。`drive.pdfId` があるので**同じファイルが更新**される
   （URL が変わらず、Drive の版履歴にも残る）。通知先は `github.issue` の Issue（クローズ済みのままでよい）。

## 改善するとき

- レイアウト: `style.css`（見た目）と `render.mjs` の `buildHtml`（構造）。`example.json` で確認する。
- フローで繰り返し詰まった点や、ヒアリングで毎回聞いている項目があれば、この SKILL.md か profile.json の既定値に反映する。
