# life-ops

life-ops は、仕事・生活・趣味・学習を GitHub Issues と生成 AI で管理するための個人運用リポジトリです。

このリポジトリ自体はタスクの SoT ではありません。
SoT は GitHub Issues とし、このリポジトリには朝会・夕会・日報・週報・月報などを行うためのプロンプト、テンプレート、運用ルールを格納します。

目的

日々のタスクや振り返りを、生成 AI との対話によって整理します。

特に次のような運用を目指します。

* 毎朝、今日やるタスクを対話形式で決める
* 毎晩、今日の進捗・未完了・気づきを整理する
* GitHub Issues をタスク管理の SoT として使う
* 日報・週報・月報の内容を GitHub Issues に紐づける
* 仕事だけでなく、生活・趣味・学習・回復も同じ仕組みで扱う
* プロンプト自体を継続的に改善する

基本方針

GitHub Issues を SoT にする

行動が必要なものは GitHub Issues に登録します。

例:

* 今日やる仕事
* 生活タスク
* 趣味の予定
* 学習したいこと
* 先送りしていること
* 日報・週報・月報
* 気づきから生まれた改善アクション

このリポジトリにはプロンプトを置く

このリポジトリには、生成 AI に渡すためのプロンプトや運用ルールを置きます。

例:

* 朝会プロンプト
* 夕会プロンプト
* 日報プロンプト
* 週報プロンプト
* 月報プロンプト
* Issue 作成ルール
* ラベル設計
* プロンプト改善メモ

ChatGPT Web UI は対話に使う

毎朝、ChatGPT Web UI にこのリポジトリ内の朝会プロンプトのURLを渡し、次のように依頼します。

この内容で朝会しましょう。
GitHub Issues を SoT として、今日やるタスクを対話形式で決めたいです。

朝会の中で、生成 AI には以下を依頼します。

* 直近の日報 Issue を探す
* 未完了 Issue を確認する
* 今日やる候補を出す
* Must / Should / Could に分ける
* 仕事・生活・趣味・回復のバランスを見る
* 対話しながら今日のタスクを調整する
* 最後に GitHub Issue として作成しやすい形式で出力する

想定フロー

朝会

1. ChatGPT Web UI を開く
2. prompts/morning.md のURLを貼る
3. 「この内容で朝会しましょう」と依頼する
4. AI が直近の日報・未完了 Issue・今日の候補を確認する
5. 対話しながら今日やることを決める
6. 最後に、今日の朝会結果を GitHub Issue として作成する

夕会

1. ChatGPT Web UI を開く
2. prompts/evening.md のURLを貼る
3. 「この内容で夕会しましょう」と依頼する
4. 今日の Issue をもとに進捗を確認する
5. 完了・未完了・明日への持ち越しを整理する
6. 日報 Issue として保存する

プロンプト改善

運用していて不便な点があれば、Codex CLI などを使ってこのリポジトリのプロンプトを改善します。

例:

* 朝会で聞いてほしい質問を増やす
* 日報の出力形式を変える
* Issue ラベル設計を見直す
* 週報・月報への集計しやすさを改善する

ディレクトリ構成

.
├── README.md
├── prompts/
│   ├── morning.md
│   ├── evening.md
│   ├── daily-report.md
│   ├── weekly-review.md
│   └── monthly-review.md
├── templates/
│   ├── issue-daily.md
│   ├── issue-task.md
│   ├── issue-weekly.md
│   └── issue-monthly.md
└── docs/
    ├── labels.md
    ├── workflow.md
    └── prompt-improvements.md

運用ルール

日報・朝会・夕会は Issue として作成する

日々の記録は GitHub Issues に保存します。

例:

2026-06-15 朝会
2026-06-15 日報
2026-W25 週報
2026-06 月報

日報は翌日の朝会に紐づける

朝会では、直近の日報 Issue を参照します。

ただし、日報が存在しない日もあるため、AI は以下のように扱います。

* 直近の日報があれば参照する
* 昨日の日報がない場合は、さらに前の日報を探す
* 日報に穴がある場合は、その事実を明示する
* 不明な部分は推測しすぎず、ユーザーに確認する

会話全文は保存しない

ChatGPT との会話全文は保存しません。
保存するのは、朝会・夕会・日報として確定した要約のみです。

AI は決定者ではなく補助者

生成 AI は、タスクの整理、優先順位づけ、振り返りを支援します。
最終的な判断はユーザーが行います。

AI は以下を意識します。

* 詰め込みすぎを止める
* 仕事だけに偏らせない
* 趣味や回復も重要な予定として扱う
* 未完了タスクを責めない
* 今日やらないことも明確にする
* 不明点を勝手に補完しすぎない

ラベル方針

GitHub Issues には、以下のようなラベルを使います。

type/task
type/daily
type/weekly
type/monthly
type/idea
type/log
area/work
area/life
area/hobby
area/learning
area/health
area/family
status/inbox
status/next
status/today
status/waiting
status/someday
status/done
priority/high
priority/medium
priority/low
energy/high
energy/low

朝会で重視すること

朝会では、単に未完了タスクを並べるのではなく、今日の現実的な計画を作ります。

確認する観点:

* 今日の予定
* 締切
* 体力
* 気分
* 昨日からの持ち越し
* 今週の方針
* 今月の方針
* 仕事・生活・趣味・回復のバランス

最終的には、以下のような形で今日の Issue を作成します。

# 2026-06-15 朝会
## 今日の方針
## Must
## Should
## Could
## やらないこと
## 昨日の日報からの引き継ぎ
## 今日の確認事項
## 関連Issue

注意点

この運用では、ChatGPT Web UI から GitHub Issues を直接更新できない場合があります。
その場合は、AI に Issue 作成用の Markdown を出力してもらい、手動で GitHub Issue を作成します。

プロンプトやテンプレートの改善は、Codex CLI などを使ってこのリポジトリに反映します。

今後やりたいこと

* 朝会プロンプトの改善
* 夕会プロンプトの作成
* 週報・月報の集計ルール作成
* GitHub Issue ラベルの整理
* GitHub Project との連携
* Codex CLI によるプロンプト改善フローの整備
* 日報の抜け漏れ検出
* 趣味・生活・学習の扱い方の改善

