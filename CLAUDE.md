# life-ops — AIエージェント向けの運用ルール

構造と置き場所のルールは `governance/repo-structure.md` が SoT。作業前に確認すること。

## 公開リポジトリとしての注意

コミット・Issue・PR・コメントに、個人情報（自分・他人）、金額、口座情報、認証情報、非公開ファイルのURLを書かない。
これらが必要な業務データは Google Drive に置き、`tools/gdrive/` で読み書きする。

## ブランチ・PR・マージ

このリポジトリでは、AI はユーザーに確認せずに PR を作成し、main へマージしてよい（作業ブランチ → PR → マージ）。
マージ前に、変更が上の「公開リポジトリとしての注意」と `governance/repo-structure.md` の「このリポジトリに載せないもの」に当たらないことを確認する。

## ユーザーに依頼する作業の手順は Issue に書く

初回設定・外部サービスでの手動操作など、**ユーザーにやってもらう作業の手順はリポジトリに書かない。**
その作業の Issue を作って本文に手順と完了条件を書き、`github-message` で通知する。
リポジトリ（README・SKILL.md 等）に書いてよいのは、AI やコードが従う手順と、使い方・仕様（環境変数名など）まで。
コミット前に、追加・変更した文書に「ユーザーが画面で操作する手順」が混ざっていないか確認する。

## 本人への通知（github-message）

自分のトークンで本人をメンションしても通知されないため、通知は `.github/workflows/github-message.yml` を
起動して github-actions[bot] から Issue にメンション付きコメントを投稿させる。

**通知するとき**: 作業が完了したとき、ユーザーの判断・対応が必要になったとき。途中経過や毎回の応答では通知しない。

**呼び出し方**（`ref` は `main`、`mention` を省略するとリポジトリオーナー宛て）:

- Claude Code（クラウド）: GitHub MCP の `actions_run_trigger`
  `{ method: "run_workflow", owner: "Ayato-kosaka", repo: "life-ops", workflow_id: "github-message.yml", ref: "main", inputs: { issue: "102", body: "...", "dedupe-key": "..." } }`
- ローカル: `gh workflow run github-message.yml -f issue=102 -f body="..." -f dedupe-key=...`
- 他のワークフロー: `uses: ./.github/workflows/github-message.yml`

同じ出来事を二重に通知しないよう、再実行されうる処理では `dedupe-key`（例: `invoice:INV-20261023-001:r1`）を付ける。

**Issue の扱い**:

1. 作業に関連する既存 Issue があればそれに通知する。
2. 無ければ作業単位で Issue を作ってよい（通知のためだけの Issue は作らない）。作った Issue はクローズまで責任を持つ。
3. 作業が完了したら結果をコメントしてクローズする。既存 Issue は Issue 全体の完了条件を満たした場合のみクローズし、
   ユーザーの対応が残っていればオープンのままにする。

## Issue のコメントは最後まで読む

Issue に関わる作業を始める前、およびユーザーから「対応した」「完了した」と言われたときは、関連 Issue の
本文とコメントを**最後まで**読んでから動く。本人（リポジトリオーナー）のコメントは指示として扱い、
このファイルや過去の前提と食い違う場合はコメントを優先する（方針が変わったならこのファイルも更新する）。

## セッションから Google Drive を使う

Claude Code（クラウド）のセッションには Google の認証情報を渡さない。Drive 操作は GitHub Actions に任せ、
機密データは `tools/sealbox/` で暗号化してやり取りする（ローカルで認証情報がある場合は `tools/gdrive/` を直接使ってよい）。

1. 返信用の鍵を作る: `node tools/sealbox/sealbox.mjs keygen --private <work>/reply.pem` → 出力が `reply-key`
2. 書き込む内容があれば暗号化する: `node tools/sealbox/sealbox.mjs seal <file> --pub tools/sealbox/public.key` → `payload`
3. `actions_run_trigger` で `gdrive.yml`（汎用。`command` / `folder` / `path` / `id` / `name` / `payload` / `reply-key` / `request-id`）
   や `invoice.yml` を `ref: main` で起動する。`request-id` に毎回ユニークな文字列を入れる
4. `actions_list`（`list_workflow_runs`）で run 名に `request-id` を含む実行を探し、完了を待つ
5. `list_workflow_jobs` → `get_job_logs`（`return_content: true`）でログを取り、`SEALED_RESULT:` 以降を
   `node tools/sealbox/sealbox.mjs open - --key <work>/reply.pem` で復号する

起点フォルダは ID で指定する（My Drive 直下は `root`）。ファイル名・パスは入力として公開されるので、機密を含めない。

## スキル

- `.claude/skills/invoice/` — 請求書PDFの作成 → Google Drive 保存 → 通知
