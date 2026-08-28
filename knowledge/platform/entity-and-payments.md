# プラットフォームの事業体要件と決済レール

最終更新: 2026-08-28 ／ 根拠: [life-ops#84](https://github.com/Ayato-kosaka/life-ops/issues/84) の調査、`decisions/0001`
性質: 現在有効な参照情報。各社の規約は変わるため、着手時に一次情報を再確認する。

## 結論：法人がないとできないことは、ほぼ無い

日本の個人事業主（開業届あり）で、以下はすべて可能。

| やりたいこと | 個人事業主で可能か |
|---|---|
| App Store / Google Play でのアプリ公開 | ○ |
| Apple からの売上受取 | ○ |
| Google Play のアプリ内課金・有料販売 | ○（日本は販売者登録対応国） |
| Stripe（日本） | ○ |
| AdMob / AdSense / YouTube収益化 | ○ |
| Meta広告の出稿 | ○（ビジネス認証すら不要） |
| Meta ビジネス認証 | ○（開業届・確定申告書控えで通った実例あり） |
| Instagram の投稿を表示（oEmbed） | ○（2026年6月にトークンレス化、登録不要） |
| Instagram の他店アカウントの投稿取得（Business Discovery） | ○（自分のトークンで使う限り Standard Access で審査不要） |

**法人の実利があるのは3つだけ**で、いずれも今すぐ必要なものではない。

1. Google Play の個人アカウントに課される「テスター12名×14日」要件の回避
2. EU DSA のトレーダー表示（個人だと自宅住所・電話がEUストアに公開される）
3. 買い手・投資家が株式を買える器になること（→ これが本命。`decisions/0001`）

## Meta

### ビジネス認証（Business Verification）

- 要求されるのは**法人格ではなく「登記された事業体の書類」**。受理される書類は①設立証明書、②事業登録・許認可書類、③政府発行の事業税書類、④事業名義の銀行明細、⑤公共料金請求書（住所・電話の確認用のみ）。
- 日本の個人事業主が**開業届（受付印付き）＋確定申告書控え（受付番号付き）**で通過した実例が複数報告されている。日本語はMetaのサポート言語なので翻訳不要。
- **Business Manager の登録名と書類上の事業者名が完全一致していること**が最頻出の却下理由。
- Metaには「Not yet registered（未登記／個人が代表）」の経路も公式に存在し、メール・電話・ドメイン認証で確認する。
- ⚠️ **非居住者の住所証明が未検証のリスク。** 屋号名義の公共料金明細を用意できない。この壁は法人化（バーチャルオフィス）でも解決しない。非居住者の日本人個人事業主が通過／失敗した報告は成功例・失敗例ともゼロ件。

### アクセスレベル

- **Standard Access**: アプリにロール（admin/developer/tester）を持つ人のデータのみ。**審査もビジネス認証も不要。**
- **Advanced Access**: 一般ユーザーのデータ。2023年2月以降の新規アプリはビジネス認証が必須。

### Instagram（用途別の可否）

| やりたいこと | 必要なもの |
|---|---|
| 投稿を埋め込み表示（oEmbed） | **なし**。2026年6月15日にトークンレス化され、審査・登録・トークンとも不要に回帰 |
| 他店のビジネスアカウントの投稿を取得（Business Discovery） | 自分のトークンで使う限り **Standard Access で足り、審査・認証とも不要**。要: 自分のFacebookページ＋リンク済みIGプロアカウント |
| ハッシュタグ検索 | Advanced Access＋ビジネス認証＋Instagram Public Content Access。**7日間で30ユニークハッシュタグ**の上限があり実用性が低い |
| Instagram Basic Display API | 2024年12月4日に廃止済み |

⚠️ Business Discovery が返す `media_url` は**1〜2日で失効する署名付きURL**。恒久保存せず、定期再取得するか表示時にoEmbed経由にする。

### Facebook ページ（第三者の公開コンテンツ）

- 任意の飲食店ページの写真・投稿を読むには **Page Public Content Access（PPCA）** が必要。`pages_read_engagement` では不可。
- **PPCAは法人化しても通りやすくならない。** ビジネス認証は前提条件にすぎず承認理由ではない。
- Metaが認める用途は実質「集約・匿名化された競合分析／ベンチマーク／Page検索」。消費者向けアプリでの写真表示は枠外で、**個人開発アプリの承認事例は確認できていない**。
- 審査前は「そのページの管理者がアプリのadmin/developer/testerでもある」ページしか叩けないため、第三者ページの実演ができないという catch-22 がある。
- 仮に承認されても **PPCAは著作権ライセンスではない**（写真の権利は店またはカメラマンにある）。またPlatform Terms §3.d は「正当な業務目的に必要でなくなった時」「**Metaが要求した時**」の削除義務を課す。
- **歩留まりの事前測定は手動閲覧で可能。** 自動収集はToS 3.2.3 と Automated Data Collection Terms（2024年10月発効、ログイン状態でも禁止）で明確に違反。人がブラウザで公開ビジネスページを見て数えるのは可。ログアウト状態では写真タブが見えないため要ログイン。

## Apple / Google

| 項目 | Apple | Google Play |
|---|---|---|
| 個人アカウント | 可（開発者名として本名が表示される） | 可 |
| 法人アカウント | D-U-N-S番号が必須（取得無料・最大30日） | D-U-N-S番号が必須（2023年8月以降） |
| 個人アカウント固有の制約 | — | 2023年11月以降に作成した個人アカウントは、本番公開前に**テスター12名が14日間継続オプトイン**するクローズドテストが必要 |
| EU DSA トレーダー要件 | 有料/IAPありのアプリは住所・電話・メールがEUストア商品ページに公開される | 同様 |
| アカウント種別の変更 | **不可**。新規Organizationアカウント＋App Transfer | **不可**。同上 |

### App Transfer（法人化時に必ず通る道）

- **移管される**: Bundle ID、レビュー・評価・履歴、IAPと自動更新サブスクリプション、iCloudコンテナ、App ID
- **移管されない**: TestFlightデータ、APNs証明書、Provisioning Profile、Sign in with Apple の Service ID、Game Center設定、プロモコード
- ⚠️ **Sign in with Apple**: 移管は可能（TN3159）だが、ユーザーごとの `transfer_sub` を取得するAPIは**移管完了から60日間しか呼べない**。かつ**自社DBに Apple の `sub` を保存していないと遡って取得できず、該当ユーザーは新規扱いになりアカウントを失う**。
- ⚠️ **Google Play**: 移管には**双方のアカウントの「登録トランザクションID」**（開設時の$25決済ID）が必要。年数が経つと探すのが困難。移管されないもの: 各種レポート、テストグループ、Firebase/Analytics/AdMobの統合サービス権限。

## 決済レールの国別可否

| レール | 🇯🇵 日本 | 🇬🇪 ジョージア | 🇪🇪 エストニア |
|---|---|---|---|
| Stripe | ○ | **✗ 非対応国** | ○ |
| Google Play 開発者登録 | ○ | ○ | ○ |
| **Google Play 販売者登録（IAP・有料販売）** | ○ | **✗ 国として非対応** | ○ |
| Apple 有料/IAP・payout | ○ | ○（SWIFT/USD） | ○ |
| Paddle（MoR） | ○ | ○ | ○ |
| Lemon Squeezy | ○ | △（PayPal payoutのみ） | ○ |
| AdMob / AdSense | ○ | ○ | ○ |
| YouTube 米国源泉税 | 0%（日米条約） | 0%（旧米ソ条約承継、将来リスクあり） | 10% |

→ ジョージアは**Stripe と Play 課金の両方が使えない**ため、消費者向けアプリの器としては構造的に不適。`decisions/0001` でGeorgia LLCを棄却した実務上の決め手。

## 主要出典

- [Meta Business Verification（開発者向け）](https://developers.facebook.com/docs/development/release/business-verification/)
- [Meta Access Levels](https://developers.facebook.com/docs/graph-api/overview/access-levels/)
- [Page Public Content Access](https://developers.facebook.com/docs/features-reference/page-public-content-access)
- [Instagram Platform Overview](https://developers.facebook.com/docs/instagram-platform/overview/) / [oEmbed](https://developers.facebook.com/docs/instagram-platform/oembed/)
- [Meta Platform Terms](https://developers.facebook.com/terms/) / [Automated Data Collection Terms](https://www.facebook.com/legal/automated_data_collection_terms)
- [Apple App Transfer の要件](https://www.developer.apple.com/help/app-store-connect/transfer-an-app/app-transfer-criteria) / [TN3159 Sign in with Apple の移行](https://developer.apple.com/documentation/technotes/tn3159-migrating-sign-in-with-apple-users-for-an-app-transfer)
- [Google Play 対応国一覧（開発者/販売者の別）](https://support.google.com/googleplay/android-developer/answer/9306917) / [アプリの移管](https://support.google.com/googleplay/android-developer/answer/6230247)
- [Stripe 対応国](https://stripe.com/global)
