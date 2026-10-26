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
if ! command -v tailscale >/dev/null; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi
sudo systemctl enable --now tailscaled

step "Google Chrome と Chrome Remote Desktop（リモート用のデスクトップは軽量な XFCE）"
if ! installed google-chrome-stable; then
  curl -fsSL -o "$TMP/chrome.deb" https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  sudo apt-get install -y "$TMP/chrome.deb"
fi
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y xfce4 xfce4-terminal dbus-x11
if ! installed chrome-remote-desktop; then
  curl -fsSL -o "$TMP/crd.deb" https://dl.google.com/linux/direct/chrome-remote-desktop_current_amd64.deb
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "$TMP/crd.deb"
fi
echo 'exec /etc/X11/Xsession /usr/bin/startxfce4' > "$HOME/.chrome-remote-desktop-session"
sudo usermod -aG chrome-remote-desktop "$USER_NAME"

step "Docker（必要なときに使えるよう入れておく）"
if ! installed docker-ce; then
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
sudo usermod -aG docker "$USER_NAME"
# 未使用イメージ等を溜めないよう、週1で掃除する
sudo tee /etc/cron.weekly/docker-prune >/dev/null <<'EOF'
#!/bin/sh
docker system prune -af --filter "until=168h" >/dev/null 2>&1 || true
EOF
sudo chmod +x /etc/cron.weekly/docker-prune

step "完了"
echo "グループ追加（docker, chrome-remote-desktop）を反映するため、一度ログアウトするか再起動してください。"
if ! tailscale status >/dev/null 2>&1; then
  echo "Tailscale は未ログインです: sudo tailscale up --ssh"
fi
