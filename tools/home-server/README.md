# home-server

常設PC（`knowledge/assets/home-server.md`）を目標の構成にするスクリプト。

```bash
bash tools/home-server/setup.sh
```

- Ubuntu 24.04 LTS デスクトップ専用。一般ユーザーで実行する（内部で sudo を使う）
- 冪等。設定が崩れたときや、構成を変えたあとに再実行してよい
- GNOME の設定（`gsettings`）はデスクトップのセッション内でしか書けない。SSH 経由で実行したときは、その部分だけ飛ばす
  （スリープの防止は systemd の設定で効くので、実害はない）
- 実行後、グループ（`docker`・`chrome-remote-desktop`）を反映させるために再起動する

Tailscale へのログインと Chrome Remote Desktop の登録は、ブラウザで本人が行う（担当 Issue に手順を書く）。
