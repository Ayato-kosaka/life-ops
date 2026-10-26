#!/usr/bin/env bash
# 常設PC（Ubuntu 24.04 LTS デスクトップ）の初期設定。何度実行しても同じ状態になる（冪等）。
# 使い方: bash tools/home-server/setup.sh   （一般ユーザーで実行し、途中で sudo を使う）
# 構成の定義は knowledge/assets/home-server.md
set -euo pipefail

if [[ $EUID -eq 0 ]]; then
  echo "一般ユーザーで実行してください（sudo は内部で使います）" >&2
  exit 1
fi

. /etc/os-release
if [[ "$ID" != ubuntu || "$VERSION_ID" != 24.04 ]]; then
  echo "想定外のOSです: $PRETTY_NAME（Ubuntu 24.04 向け）" >&2
  exit 1
fi

USER_NAME=$(id -un)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

step() { printf '\n==> %s\n' "$*"; }

installed() { dpkg-query -W -f='${Status}' "$1" 2>/dev/null | grep -q 'ok installed'; }

step "基本設定（タイムゾーン・パッケージ更新）"
sudo timedatectl set-timezone Asia/Tokyo
# リリースアップグレード（do-release-upgrade）が無効化して残した、古いリリース向けの入手元を片づける。
# 必要なもの（Tailscale・Docker）は下で今のリリース向けに入れ直す
sudo rm -f /etc/apt/sources.list.d/*.distUpgrade /etc/apt/sources.list.d/*.save \
  /etc/apt/sources.list.d/third-party.sources /etc/apt/sources.list.d/obsproject-*
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get -y full-upgrade
sudo apt-get install -y curl ca-certificates gnupg

step "不要なアプリを削除"
purge=()
for p in thunderbird libreoffice-common remmina cheese rhythmbox shotwell totem transmission-gtk \
         deja-dup aisleriot gnome-mahjongg gnome-mines gnome-sudoku whoopsie kerneloops apport; do
  if installed "$p"; then purge+=("$p"); fi
done
if ((${#purge[@]})); then
  sudo apt-get purge -y "${purge[@]}"
fi
sudo apt-get autoremove --purge -y
for s in thunderbird firefox snap-store; do
  if snap list "$s" >/dev/null 2>&1; then sudo snap remove --purge "$s"; fi
done
# 古い snap リビジョンを残さない
sudo snap set system refresh.retain=2

step "常設に不要なサービスを停止（印刷・Bluetooth・モデム・エラー報告）"
for s in cups cups-browsed bluetooth ModemManager avahi-daemon; do
  if systemctl list-unit-files "$s.service" --no-legend | grep -q .; then
    sudo systemctl disable --now "$s.service" || true
  fi
done
# ソケットや監視が残っていると、呼ばれたときにサービスが起き直す
for u in avahi-daemon.socket cups.socket cups.path; do
  if systemctl list-unit-files "$u" --no-legend | grep -q .; then
    sudo systemctl disable --now "$u" || true
  fi
done

step "スリープさせない（蓋を閉じても動き続ける）"
sudo mkdir -p /etc/systemd/logind.conf.d
sudo tee /etc/systemd/logind.conf.d/10-always-on.conf >/dev/null <<'EOF'
[Login]
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
IdleAction=ignore
EOF
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
# GNOME の設定はデスクトップのセッション内でしか書けないので、SSH 経由なら失敗しても続行する
gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing' 2>/dev/null || true
gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-battery-type 'nothing' 2>/dev/null || true
gsettings set org.gnome.settings-daemon.plugins.power lid-close-ac-action 'nothing' 2>/dev/null || true
gsettings set org.gnome.settings-daemon.plugins.power lid-close-battery-action 'nothing' 2>/dev/null || true

step "ログの上限（journal を 500MB まで）"
sudo mkdir -p /etc/systemd/journald.conf.d
sudo tee /etc/systemd/journald.conf.d/10-size.conf >/dev/null <<'EOF'
[Journal]
SystemMaxUse=500M
EOF
sudo systemctl restart systemd-journald

step "セキュリティ更新を自動適用し、必要なら深夜4時に再起動"
sudo apt-get install -y unattended-upgrades
sudo tee /etc/apt/apt.conf.d/52always-on >/dev/null <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF

step "電池の満充電を80%で止める（常時給電での劣化対策。LG gram 等 lg-laptop 対応機のみ）"
limit_file=$(ls /sys/class/power_supply/*/charge_control_end_threshold 2>/dev/null | head -1 || true)
if [[ -n "$limit_file" ]]; then
  sudo tee /etc/systemd/system/battery-charge-limit.service >/dev/null <<EOF
[Unit]
Description=Limit battery charge to 80%

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'echo 80 > $limit_file'

[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl daemon-reload
  sudo systemctl enable --now battery-charge-limit.service
else
  echo "充電上限の設定に非対応のため、スキップ"
fi

step "Tailscale"
# 入手元が無ければ（新規、またはリリースアップグレードで外れた）公式スクリプトで入れ直す
if [[ ! -e /etc/apt/sources.list.d/tailscale.list ]]; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi
sudo systemctl enable --now tailscaled

step "Google Chrome と Chrome Remote Desktop（リモート用のデスクトップは軽量な XFCE）"
if ! installed google-chrome-stable; then
  curl -fsSL -o "$TMP/chrome.deb" https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  sudo apt-get install -y "$TMP/chrome.deb"
fi
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y xfce4 xfce4-terminal dbus-x11 tmux
if ! installed chrome-remote-desktop; then
  curl -fsSL -o "$TMP/crd.deb" https://dl.google.com/linux/direct/chrome-remote-desktop_current_amd64.deb
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "$TMP/crd.deb"
fi
echo 'exec /etc/X11/Xsession /usr/bin/startxfce4' > "$HOME/.chrome-remote-desktop-session"
# 古い版だけがこのグループを使う（新しい版にはグループが無い）
if getent group chrome-remote-desktop >/dev/null; then
  sudo usermod -aG chrome-remote-desktop "$USER_NAME"
fi
# 登録済みなら、起動時に仮想デスクトップを立ち上げる（登録前は設定ファイルが無いので何もしない）
if compgen -G "$HOME/.config/chrome-remote-desktop/host#*.json" >/dev/null; then
  sudo systemctl enable "chrome-remote-desktop@$USER_NAME.service"
else
  echo "Chrome Remote Desktop が未登録のため、自動起動の設定はスキップ"
fi

step "画面の前の GNOME と仮想デスクトップは、コマンドで切り替える（同時には使えない）"
# 同じユーザーが GNOME と仮想デスクトップに同時に入ると、Chrome やセッションがぶつかる。
# GDM はパスワードを受けた直後に「同じユーザーのセッションが動いている」と断るので、ログインの前後のフックでは避けられない。
# ふだんは画面の前に GNOME を出さず、使うときだけ desktop-switch local / remote で切り替える
SRC=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# 画面の前の文字の画面からも確実に呼べるよう、PATH の設定に左右されない /usr/local/bin に置く
sudo install -m 0755 "$SRC/desktop-switch.sh" /usr/local/bin/desktop-switch
rm -f "$HOME/.local/bin/desktop-switch"
sudo systemctl set-default multi-user.target
# 以前の版が置いた GDM のフックと、ログイン画面から隠す設定を元に戻す
sudo rm -f /etc/gdm3/PostLogin/Default
printf '#!/bin/sh\n\nexit 0\n' | sudo tee /etc/gdm3/PostSession/Default >/dev/null
acct=/var/lib/AccountsService/users/$USER_NAME
if sudo test -f "$acct"; then
  sudo sed -i 's/^SystemAccount=true/SystemAccount=false/' "$acct"
fi
# どこから起動しても Chrome が鍵束を使わないようにする（使うと、仮想デスクトップ側で cookie が読めなくなる）
mkdir -p "$HOME/.local/share/applications"
sed 's|^Exec=/usr/bin/google-chrome-stable|Exec=/usr/bin/google-chrome-stable --password-store=basic|' \
  /usr/share/applications/google-chrome.desktop > "$HOME/.local/share/applications/google-chrome.desktop"

step "Docker（必要なときに使えるよう入れておく）"
# 入手元は毎回今のリリース向けに書き直す（リリースアップグレードで外れても戻る）
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER_NAME"
# 未使用イメージ等を溜めないよう、週1で掃除する
sudo tee /etc/cron.weekly/docker-prune >/dev/null <<'EOF'
#!/bin/sh
docker system prune -af --filter "until=168h" >/dev/null 2>&1 || true
EOF
sudo chmod +x /etc/cron.weekly/docker-prune

step "常駐（Chrome と Claude Code Remote Control）"
SRC=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
mkdir -p "$HOME/.local/bin" "$HOME/.config/autostart" "$HOME/.config/systemd/user"
install -m 0755 "$SRC/chrome-keepalive.sh" "$HOME/.local/bin/chrome-keepalive"
install -m 0755 "$SRC/claude-rc.sh" "$HOME/.local/bin/claude-rc"
# Chrome は Chrome Remote Desktop のデスクトップ（XFCE）だけで起こす。画面の前の GNOME では起こさない
cat > "$HOME/.config/autostart/chrome-keepalive.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Chrome keepalive
Exec=$HOME/.local/bin/chrome-keepalive
OnlyShowIn=XFCE;
DESKTOP
# Chrome の cookie を開く鍵束（gnome-keyring）は、既定では XFCE で自動起動しない
cat > "$HOME/.config/autostart/gnome-keyring-secrets-xfce.desktop" <<'DESKTOP'
[Desktop Entry]
Type=Application
Name=GNOME Keyring (secrets)
Exec=/usr/bin/gnome-keyring-daemon --start --components=secrets
OnlyShowIn=XFCE;
DESKTOP
# Remote Control はリポジトリごとに1つ動かす（claude.ai/code では、起動したフォルダごとに別の環境として出る）。
# claude-rc@<ホーム直下のフォルダ名>、tmux のセッション名は claude-rc-<フォルダ名>
cat > "$HOME/.config/systemd/user/claude-rc@.service" <<'UNIT'
[Unit]
Description=Claude Code Remote Control for ~/%i (tmux session: claude-rc-%i)
Wants=network-online.target
After=network-online.target

[Service]
# tmux のサーバーは全部の claude-rc@ で1つを共有するので、プロセスは見張らない（終了時の起動し直しは claude-rc の中で行う）
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/bin/tmux new-session -d -s claude-rc-%i %h/.local/bin/claude-rc %h/%i
ExecStop=/usr/bin/tmux kill-session -t claude-rc-%i

[Install]
WantedBy=default.target
UNIT
# 以前の版の、フォルダを1つだけ扱うサービスを片づける
if [[ -f "$HOME/.config/systemd/user/claude-rc.service" ]]; then
  systemctl --user disable --now claude-rc.service || true
  rm -f "$HOME/.config/systemd/user/claude-rc.service"
fi
# ログインしていなくても、起動時にユーザーサービスを動かす
sudo loginctl enable-linger "$USER_NAME"
if [[ -x "$HOME/.local/bin/claude" ]]; then
  systemctl --user daemon-reload
  # 対象は CLAUDE_RC_REPOS（ホーム直下のフォルダ名を空白区切り）。無いフォルダは飛ばす
  for repo in ${CLAUDE_RC_REPOS:-life-ops live-streaming}; do
    if [[ -d "$HOME/$repo" ]]; then
      systemctl --user enable --now "claude-rc@$repo.service"
    else
      echo "~/$repo が無いため、Remote Control はスキップ"
    fi
  done
else
  echo "Claude Code が未インストールのため、Remote Control の有効化はスキップ"
fi

step "完了"
echo "グループ（docker）の追加と常駐の設定を反映するため、再起動してください。"
if ! tailscale status >/dev/null 2>&1; then
  echo "Tailscale は未ログインです: sudo tailscale up --ssh"
fi
