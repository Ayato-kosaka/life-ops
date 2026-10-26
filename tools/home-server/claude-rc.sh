#!/usr/bin/env bash
# Claude Code の Remote Control を動かし続ける（claude.ai/code から操作し、このPCの Chrome を使う）。
# systemd のユーザーサービス claude-rc が tmux の claude-rc セッションの中で動かす。
# 様子を見る・初回の確認に答えるときは `tmux attach -t claude-rc`（抜けるのは Ctrl-b d）。
cd "$HOME"
while true; do
  "$HOME/.local/bin/claude" remote-control --chrome --permission-mode auto --name home-server
  echo "Remote Control が終了しました（$?）。10秒後に起動し直します"
  sleep 10
done
