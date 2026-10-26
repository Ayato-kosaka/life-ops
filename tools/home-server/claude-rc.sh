#!/usr/bin/env bash
# Claude Code の Remote Control を動かし続ける（claude.ai/code から操作し、このPCの Chrome を使う）。
# 使い方: claude-rc <フォルダ>。systemd のユーザーサービス claude-rc@<フォルダ名> が tmux の中で動かす。
# 様子を見る・初回の確認に答えるときは `tmux attach -t claude-rc-<フォルダ名>`（抜けるのは Ctrl-b d）。
# ホームフォルダは信頼が保存されず、起動のたびに確認で止まるので使わない
dir="${1:?フォルダを指定してください}"
cd "$dir"
while true; do
  "$HOME/.local/bin/claude" remote-control --chrome --permission-mode auto --name "home-server-$(basename "$dir")"
  echo "Remote Control が終了しました（$?）。10秒後に起動し直します"
  sleep 10
done
