#!/usr/bin/env bash
# Chrome Remote Desktop のデスクトップ（XFCE）で Chrome を常に起動しておく。
# 落ちたり閉じられたりしたら、30秒以内に起動し直す。XFCE の自動起動から呼ばれる。
sleep 5  # デスクトップが立ち上がるのを待つ
while true; do
  if ! pgrep -u "$(id -u)" -x chrome >/dev/null; then
    # 鍵束（gnome-keyring）に頼らない。無人で再起動しても、鍵束の解除を求められて止まらない
    google-chrome --password-store=basic --no-first-run --restore-last-session >/dev/null 2>&1 &
  fi
  sleep 30
done
