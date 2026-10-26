# home-server

常設PC（`knowledge/assets/home-server.md`）を目標の構成にするスクリプト。

```bash
bash tools/home-server/setup.sh
```

- Ubuntu 24.04 LTS デスクトップ専用。一般ユーザーで実行する（内部で sudo を使う）
- 冪等。設定が崩れたときや、構成を変えたあとに再実行してよい
- GNOME の設定（`gsettings`）はデスクトップのセッション内でしか書けない。SSH 経由で実行したときは、その部分だけ飛ばす
  （スリープの防止は systemd の設定で効くので、実害はない）
- 実行後に再起動する（`docker` グループと常駐の設定を反映するため）

## 常駐するもの

| 名前 | 中身 | 起動のしかた |
|---|---|---|
| `chrome-keepalive.sh` → `~/.local/bin/chrome-keepalive` | Chrome が動いていなければ30秒以内に起動する | Chrome Remote Desktop のデスクトップ（XFCE）の自動起動（`~/.config/autostart/chrome-keepalive.desktop`、`OnlyShowIn=XFCE`） |
| `claude-rc.sh` → `~/.local/bin/claude-rc` | 指定したフォルダで `claude remote-control --chrome --permission-mode auto --name home-server-<フォルダ名>` を、終了したら10秒後に起動し直す | systemd のユーザーサービス `claude-rc@<フォルダ名>.service`（リポジトリごとに1つ。対象は `CLAUDE_RC_REPOS`、既定 `life-ops live-streaming`）が tmux の `claude-rc-<フォルダ名>` セッションで動かす。linger を有効にしているので、ログインしていなくても起動時に動く |

- Remote Control の様子を見る・初回の確認に答える: `tmux attach -t claude-rc-<フォルダ名>`（抜けるのは Ctrl-b d）。
  新しいフォルダは初回に「信頼するか」「Remote Control を有効にするか」「spawn mode」を聞かれる
- 状態: `systemctl --user status 'claude-rc@*'`、`pgrep -a chrome`
- 画面の前の GNOME と仮想デスクトップは同時に使えない（GDM がパスワード直後に「同じユーザーのセッションが動いている」と断る）。
  ふだんは `multi-user.target` で画面の前に GNOME を出さず、`desktop-switch.sh`（→ `/usr/local/bin/desktop-switch`）で切り替える:
  `desktop-switch local`（仮想デスクトップを止めて GDM を起こす）・`desktop-switch remote`（GDM を止めて仮想デスクトップを戻す。
  GNOME の中から実行しても最後まで進むよう `systemd-run` で流す）
- Chrome はどこから起動しても `--password-store=basic`（`~/.local/share/applications/google-chrome.desktop` で上書き）
- 鍵束（gnome-keyring）は XFCE 用の自動起動を `~/.config/autostart/gnome-keyring-secrets-xfce.desktop` に置く
- claude.ai/code では、Remote Control を起動したフォルダごとに別の環境として出る。ホームフォルダは信頼が保存されないので使わない

Tailscale へのログイン、Chrome Remote Desktop の登録、Claude in Chrome 拡張の導入は、ブラウザで本人が行う（担当 Issue に手順を書く）。
