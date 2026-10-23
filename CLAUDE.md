# life-ops — AIエージェント向けの運用ルール

構造と置き場所のルールは `governance/repo-structure.md` が SoT。作業前に確認すること。

## 公開リポジトリとしての注意

コミット・Issue・PR・コメントに、個人情報（自分・他人）、金額、口座情報、認証情報、非公開ファイルのURLを書かない。
これらが必要な業務データは Google Drive に置き、`tools/gdrive/` で読み書きする。

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

## スキル

- `.claude/skills/invoice/` — 請求書PDFの作成 → Google Drive 保存 → 通知
