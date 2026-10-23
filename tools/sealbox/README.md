# sealbox

公開リポジトリの GitHub Actions と機密データをやり取りするための暗号化CLI（依存なし）。
Claude Code のセッションは認証情報を持たないため、Drive 操作などは Actions に任せ、その入出力をこれで暗号化する。

```bash
node tools/sealbox/sealbox.mjs keygen --private <file> [--public <file>]   # 公開鍵を1行の base64 で出力
node tools/sealbox/sealbox.mjs seal <file|-> --pub <base64 | 鍵ファイル>
node tools/sealbox/sealbox.mjs open <file|-> --key <秘密鍵PEM> [--out <file>]
```

- 方式: RSA-OAEP(SHA-256, 3072bit) で AES-256-GCM の鍵を包む。平文は gzip してから暗号化する。
- **セッション → Actions**: `public.key`（このディレクトリ）で暗号化する。対の秘密鍵は Google Drive の
  `life-ops/_keys/sealbox-private.pem` にだけあり、Actions が実行時に取得する。鍵は `sealbox-setup` ワークフローで作る。
- **Actions → セッション**: 呼び出し側が毎回 `keygen` で使い捨ての鍵ペアを作り、公開鍵を `reply-key` として渡す。
  Actions は結果をそれで暗号化し、ログの `SEALED_RESULT:` 行に出す。
- workflow_dispatch の入力は合計 65,535 文字まで。暗号化後の payload が収まる大きさ（JSON など。PDF は不可）に限る。

使い方の流れは `CLAUDE.md` の「セッションから Google Drive を使う」。
