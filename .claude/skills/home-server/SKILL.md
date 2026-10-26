---
name: home-server
description: 自宅に常設するノートPC（Ubuntu 24.04 LTS）の初期設定・点検・軽量化を行う。「常設PCをセットアップして」「常設PCが重い」「再インストール後の設定」などの依頼で使う。
---

# 常設PC（Ubuntu 24.04 LTS）

日本の自宅に置き、蓋を閉じたまま24時間動かすノートPCの構成と、AIが行う設定・点検の手順。

## 構成の定義

機材と目標の構成は `knowledge/assets/home-server.md` を正とする。構成を変えたら、そのファイルと
`tools/home-server/setup.sh` を一緒に直す。

## 初期設定

`tools/home-server/setup.sh` が目標の構成をまとめて作る。冪等なので、設定が崩れたときに再実行してよい。

1. 前提を確認する: `cat /etc/os-release` が Ubuntu 24.04 であること
2. 一般ユーザーで `bash tools/home-server/setup.sh` を実行する。sudo のパスワードが必要なので、
   AIのセッションから実行するときは、ユーザーにプロンプトで `! bash tools/home-server/setup.sh` と打ってもらう
3. 完了後に下の「点検」を行い、結果を担当 Issue にコメントする

Tailscale のログインと Chrome Remote Desktop の登録はブラウザでの本人操作が必要なので、担当 Issue の手順に従ってもらう。

## 点検（軽量化・状態確認）

次の項目を確認し、目標の構成から外れているものを報告する。直すときは `setup.sh` を再実行する。

```bash
cat /etc/os-release; uname -r
df -hT -x tmpfs -x devtmpfs -x squashfs; free -h
systemctl --failed --no-pager
systemctl list-units --type=service --state=running --no-pager --no-legend
systemd-analyze cat-config systemd/logind.conf | grep -E '^HandleLid'
systemctl is-enabled sleep.target suspend.target          # masked であること
tailscale status | head -5
systemctl status 'chrome-remote-desktop@*' --no-pager | head -5
journalctl --disk-usage; docker system df; snap list --all | grep disabled
du -xh --max-depth=1 ~ 2>/dev/null | sort -rh | head -15
ps -eo pid,rss,pcpu,comm --sort=-rss | head -15
```

- 使用率が80%を超えていたら、大きいものから順に、消してよいかユーザーに確認してから削除する（ゴミ箱・キャッシュ・Docker・古いsnap）
- Docker のボリュームにはコードやデータが入っていることがあるので、削除前に必ず確認する
