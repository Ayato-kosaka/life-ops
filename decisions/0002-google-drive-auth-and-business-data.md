# 0002. Google Drive 連携は個人アカウントの OAuth リフレッシュトークンで行い、業務データは Drive に置く

- ステータス: 提案中
- 決定日: 2026-10-23
- 関連: [life-ops#102](https://github.com/Ayato-kosaka/life-ops/issues/102)
- 前提が変わったら見直す条件: Google Workspace（共有ドライブ）を個人業務で使うようになった／リポジトリを非公開にした／OAuth の失効が頻発する

## 決定

1. Google Drive の読み書きは、**個人 Google アカウントの OAuth ユーザー認証（リフレッシュトークン）**で行う。スコープは `drive`。
   認証情報は **GitHub Secrets にだけ**置く（Claude Code のクラウド環境には渡さない）。Drive 操作は共通の CLI（`tools/gdrive/`）で行い、
   セッションからは GitHub Actions（`gdrive.yml` など）を起動して実行する。機密データの受け渡しは `tools/sealbox/` で暗号化する
   （秘密鍵は Drive にだけ置き、公開鍵はリポジトリに置く）。
2. 請求書PDF・請求データ・請求元／請求先／口座情報などの**業務データは Google Drive に置き、リポジトリには置かない**。
   リポジトリに置くのはコード・手順・ダミーの例だけ。
3. 本人への通知は github-actions[bot] によるメンション付き Issue コメント（`github-message` ワークフロー）で行い、
   通知文には業務データ（請求先・金額・口座・非公開URL）を含めない。

## 背景と選択肢

| 案 | 判定 | 理由 |
|---|---|---|
| **OAuth ユーザー認証（リフレッシュトークン）** | **採用** | 個人の My Drive に本人として読み書きできる。Actions・ローカル・クラウドセッションで同じ方式を使える |
| サービスアカウント＋フォルダ共有 | 棄却 | サービスアカウントは保存容量を持たず、個人の My Drive へ新規アップロードできない。共有ドライブは Workspace 専用 |
| Workload Identity Federation | 棄却 | 鍵は不要になるが、最終的にサービスアカウントとして動くため上と同じ容量の制約を受ける |
| 認証情報をクラウドセッションの環境変数にも置く | 棄却 | 本人の方針（[#103](https://github.com/Ayato-kosaka/life-ops/issues/103#issuecomment-6367469648)）。認証情報の置き場所を GitHub Secrets の1か所に絞る |
| Claude の Google Drive コネクタ | 棄却 | 接続先が仕事用アカウントで、個人の保存先フォルダに届かない。Actions からも使えない |
| スコープ `drive.file` | 棄却 | アプリが作ったファイルしか扱えず、既存フォルダの読み書き・汎用化ができない |
| 再利用情報をリポジトリ（暗号化含む）に置く | 棄却 | 公開リポジトリであり、口座番号などは暗号化しても置かない方針（`governance/repo-structure.md`） |

## 根拠（要約）

- サービスアカウントには Drive の保存容量がなく、個人 My Drive への作成は `storageQuotaExceeded` になる（[Drive API: 共有ドライブ](https://developers.google.com/workspace/drive/api/guides/about-shareddrives)）。
- OAuth の公開ステータスが「テスト」の外部アプリはリフレッシュトークンが7日で失効する。「本番環境」にすれば失効しない（[OAuth 2.0: リフレッシュトークンの失効](https://developers.google.com/identity/protocols/oauth2#expiration)）。自分専用なので審査は不要（未確認アプリの警告が出るだけ）。
- 公開リポジトリの Actions ログは誰でも読めるため、Drive の中身・ファイル名はログに出さない設計にした。

## 影響と実行

- 初回のみ、本人が Google Cloud で OAuth クライアントを作りリフレッシュトークンを取得して登録する（手順は [life-ops#103](https://github.com/Ayato-kosaka/life-ops/issues/103)）。
- Drive 連携が必要な今後の自動化は `tools/gdrive/` と `.github/actions/gdrive/` を使い、足りない操作はそこに追加する。
- 通知が必要な今後の自動化は `github-message` を使う（`CLAUDE.md`）。

## 再検討トリガー

- 個人業務で Google Workspace を契約し、共有ドライブを使えるようになった（サービスアカウント方式を再評価）
- リフレッシュトークンの失効・取り消しが運用上の負担になった
- リポジトリを非公開にした（業務データの置き場所を再評価）
