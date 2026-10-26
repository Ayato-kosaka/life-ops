#!/usr/bin/env bash
# 画面の前の GNOME と、Chrome Remote Desktop の仮想デスクトップを切り替える（同時には使えないため）。
#   desktop-switch local   … 仮想デスクトップを止め、画面の前に GNOME のログイン画面を出す
#   desktop-switch remote  … 画面の前の GNOME を止め、仮想デスクトップに戻す（使い終わったら必ずこちら）
# 画面の前の文字のログイン画面（Ctrl+Alt+F3 など）や tailscale ssh から実行する。
set -euo pipefail
crd="chrome-remote-desktop@$(id -un).service"
case "${1:-}" in
  local)
    sudo systemctl stop "$crd"
    sudo systemctl start gdm
    echo "画面の前に GNOME のログイン画面を出しました（出ないときは Ctrl+Alt+F1）。使い終わったら desktop-switch remote"
    ;;
  remote)
    # GNOME の中から実行しても、gdm を止めた時点でこのシェルごと終わるので、systemd に続きを任せる
    echo "画面の前の GNOME を止め、仮想デスクトップに戻します（Chrome Remote Desktop から繋げるようになります）"
    sudo systemd-run --quiet --collect --unit=desktop-switch-remote \
      sh -c "systemctl stop gdm; systemctl start $crd"
    ;;
  *)
    echo "使い方: desktop-switch local|remote" >&2
    exit 2
    ;;
esac
