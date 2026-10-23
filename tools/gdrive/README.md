# gdrive

Google Drive を読み書きする汎用CLI。依存パッケージなし（Node 18 以上）。
Claude Code のスキル・ローカル作業・GitHub Actions（`.github/actions/gdrive`）から共通で使う。

## コマンド

```bash
node tools/gdrive/gdrive.mjs whoami
node tools/gdrive/gdrive.mjs ls    --folder <id> [--path a/b]
node tools/gdrive/gdrive.mjs stat  --folder <id> --path a/b/file.json   # または --id <id>
node tools/gdrive/gdrive.mjs get   --folder <id> --path a/b/file.json --out local.json
node tools/gdrive/gdrive.mjs put   local.pdf --folder <id> [--path a/b] [--name 名前.pdf]
node tools/gdrive/gdrive.mjs put   local.pdf --id <id> [--name 新しい名前.pdf]
node tools/gdrive/gdrive.mjs mkdir --folder <id> --path a/b
node tools/gdrive/gdrive.mjs trash --id <id>
```

- 結果は標準出力に JSON で出る（`get` で `--out` を省略した場合は本文）。
- `put` は同じフォルダに同名ファイルがあれば中身を更新する（ファイルIDとURLを維持し、Drive の版履歴に残る）。
  `--path` の途中のフォルダは無ければ作る。
- Google ドキュメント類の `get` は `--export <MIME>` で形式を指定する（既定は text/plain）。

## 認証

個人の Google アカウント（My Drive）を読み書きするため、**OAuth のユーザー認証（リフレッシュトークン）**を使う。
サービスアカウントは個人の My Drive に保存容量を持てずアップロードできないため使わない（`decisions/0002`）。

環境変数:

| 変数 | 内容 |
|---|---|
| `GDRIVE_CLIENT_ID` | OAuth クライアントID |
| `GDRIVE_CLIENT_SECRET` | OAuth クライアントシークレット |
| `GDRIVE_REFRESH_TOKEN` | リフレッシュトークン（スコープ `https://www.googleapis.com/auth/drive`） |
| `GDRIVE_ACCESS_TOKEN` | （任意）取得済みのアクセストークン。設定時は上の3つより優先 |

登録先:

- **GitHub Actions**: リポジトリの Settings → Secrets and variables → Actions に同名で登録
- **Claude Code（クラウド）**: 環境の設定（セッションのタイトルバーの環境メニュー → Edit）で環境変数として登録
- **ローカル**: シェルの環境変数（リポジトリ内のファイルには書かない）

### 初回セットアップ（一度だけ）

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作り、**Google Drive API** を有効にする。
2. 「Google Auth Platform」（OAuth 同意画面）を構成する。対象は「外部」、テストユーザーに自分のアカウントを追加。
3. **公開ステータスを「本番環境」にする。** 「テスト」のままだとリフレッシュトークンが7日で失効する。
   審査は不要（自分しか使わないため。許可画面で「未確認のアプリ」と出るので「詳細」から続行する）。
4. 「クライアント」で OAuth クライアントを作る。種類は **デスクトップ アプリ**。
5. ローカルでリフレッシュトークンを取得する:

   ```bash
   export GDRIVE_CLIENT_ID=... GDRIVE_CLIENT_SECRET=...
   node tools/gdrive/gdrive.mjs auth                      # 表示された URL をブラウザで開いて許可
   node tools/gdrive/gdrive.mjs auth --code '<移動先の http://localhost/?code=... のURL>'
   ```

   表示された `refresh_token` を上の登録先に保存する。チャットやリポジトリには貼らない。
6. GitHub Actions の `gdrive-check` ワークフローを手動実行して疎通を確認する。

## GitHub Actions から使う

```yaml
steps:
  - uses: actions/checkout@v4
  - id: drive
    uses: ./.github/actions/gdrive
    with:
      command: get
      folder: <フォルダID>
      path: _data/profile.json
      client-id: ${{ secrets.GDRIVE_CLIENT_ID }}
      client-secret: ${{ secrets.GDRIVE_CLIENT_SECRET }}
      refresh-token: ${{ secrets.GDRIVE_REFRESH_TOKEN }}
  # 結果は ${{ steps.drive.outputs.result }}（JSON、get で out 省略時は本文）
```

公開リポジトリなので、取得した内容やファイル名をログに出さないこと（`echo` しない、Step Summary に書かない）。

## 機能を足すとき

`gdrive.mjs` の `commands` にコマンドを追加し、`HELP` とこの README、必要なら `action.yml` の inputs を更新する。
