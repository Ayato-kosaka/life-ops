#!/usr/bin/env bash
# Chrome Remote Desktop のデスクトップ（XFCE）で Chrome を常に起動しておく。
# 落ちたり閉じられたりしたら、30秒以内に起動し直す。XFCE の自動起動から呼ばれる。
while true; do
  if ! pgrep -u "$(id -u)" -x chrome >/dev/null; then
    google-chrome --no-first-run --restore-last-session >/dev/null 2>&1 &
  fi
  sleep 30
done
