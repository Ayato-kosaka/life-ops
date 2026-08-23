# 0001. 法人はエストニアOÜで設立する（Georgia LLC / VZPは作らない）

- ステータス: 提案中
- 決定日: —（承認時に記入）
- 関連: #84（検討Issue。調査の全文はIssueとAIセッションに帰属）
- 前提が変わったら見直す条件: 末尾「再検討トリガー」参照

## 決定

1. 法人は **エストニアOÜ（e-Residency経由・完全リモート）** で設立し、「なに食べよ」のIP・契約・アプリ収益・フリーランス・クリエイター収入の受け皿として一社に集約する（帳簿は App / Freelance / Creator の部門別）。
2. **Georgia LLCは設立しない。Virtual Zone（VZP）は申請しない。** UAE法人・米国LLCも現時点では作らない。
3. 設立を急がない。出国後1〜3か月かけて実施する（法人化の時間的期限は存在しないと確認済み）。
4. 生活費の引き出しは「役員報酬0＋エストニア国外勤務の給与」を基本とし（エストニア税0%）、配当は最小化する。
5. **EXIT（売却・現金化）が完了するまで日本に帰国して居住者に戻らない**ことを構造上の制約として受け入れる。

## 背景と選択肢

#84 の検討で Georgia LLC + VZP を第一候補としていたが、調査により前提が崩れた。

- **A. Georgia LLC + VZP → 棄却**：VZPの0%免税は「ジョージア国内で（居住する創業者または現地従業員が）実質的に開発したソフト」にのみ適用（歳入庁長官令№33544、2023年以降の執行実務）。来月出国して一人で国外開発する構成では維持不能、遡及課税リスクあり。
- **B. Georgia LLC（VZPなし）→ 棄却**：不在オーナーの実コストは年3,000〜7,000 GEL（16〜38万円）で安くない。Google Play販売者登録が国として非対応＝**アプリ内課金が売れない**、Stripe非対応。銀行口座の凍結・閉鎖事例あり。
- **C. Estonia OÜ → 採用**：完全リモート運営、留保利益0%・国外勤務給与0%・非居住者の株式売却益0%（EXITに足かせなし）、Stripe/Play課金/Paddle全対応、年間固定費5〜25万円。
- **D. UAE FZ → 見送り**：年90〜180万円の維持費は現規模に不釣り合い。EXIT前の「個人の居住地」としては将来有力。
- **E. US LLC → 見送り**：安価・決済最強だが、税務上は個人の延長でIP保有主体にならず、米国遺産税（非居住外国人の免税枠$60k）の構造的リスク。必要時に決済用パイプとして追加は可能。

なお「Meta APIのために今すぐ法人が必要」という当初前提は誤り：Metaビジネス認証は登記事業体の書類で足り、Apple/Googleサインイン採用なら当面不要。

## 根拠（要約）

- VZP実体要件・遡及課税：[TPsolution（長官令№33544解説）](https://tpsolution.ge/the-methodical-instruction-on-the-taxation-of-the-profit-tax-of-the-person-of-the-virtual-zone-2/) / [同・当局の新アプローチ](https://tpsolution.ge/virtual-zone-companies-in-georgia-the-new-approach-of-the-georgian-tax-authority/) / [ExpatHub](https://expathub.ge/virtual-zone-georgia-tax/)
- 決済レール：[Google Play対応国（販売者列でGeorgia非対応）](https://support.google.com/googleplay/android-developer/answer/9306917) / [Stripe対応国](https://stripe.com/global)
- Meta認証要件：[Business Verification](https://developers.facebook.com/docs/development/release/business-verification/) / [Access Levels](https://developers.facebook.com/docs/graph-api/overview/access-levels/)
- エストニア税制（2026年、セキュリティ税は施行前廃止・増税撤回）：[EMTA非居住者課税](https://www.emta.ee/en/business-client/registration-business/non-residents-e-residents/tax-liabilities-companies) / [EY](https://www.ey.com/en_gl/technical/tax-alerts/estonia-abolishes-temporary-defense-tax-increases-several-tax-rates) / [COBALT 2026](https://www.cobalt.legal/news-cases/key-tax-changes-for-2026/)
- 非居住者の持分売却エストニア非課税：[EMTA](https://www.emta.ee/en/private-client/foreigner-non-resident/non-residents/gains-transfer-property)
- 日本帰国時のCFC・出国税：[財務省CFC概要](https://www.mof.go.jp/tax_policy/summary/international/175.htm) / [国税庁 国外転出時課税](https://www.nta.go.jp/taxes/shiraberu/shinkoku/kokugai/01.htm)

## 影響と実行

- 出国前（ジョージア）：法人関連の手続きは行わない。2026年分の個人税務（1〜8月のジョージア国内遂行フリーランス収入の申告要否）を現地会計士に確認する。TIN・滞在記録・出国証憑を保存する。
- 出国後：e-Residency申請（受取大使館は旅程で選定）→ OÜ登記 → Wise/Revolut Business → IP・ドメイン・契約・ストアアカウントをOÜ名義へ集約（企業価値がほぼゼロのうちに実施）。
- 運用：各国滞在は目安90日未満に保ち滞在記録を残す（法人の管理支配地・PE論点を構造的に回避)。
- 実行タスクは別途Issue化する。

## 再検討トリガー

- どこかの国に半年以上定住する意思が生じたとき（法人管理支配地の再設計）
- 利益が年1,000万円規模に到達（個人の税務居住地を1つ確保する検討＝UAE等)
- VC調達・M&Aが具体化（Delawareフリップ／売却年のUAE 183日居住の設計)
- 日本帰国の意思が生じたとき（CFC・出国税・相続贈与10年ルールの事前設計が必須)
- エストニア税制の重要変更（年1回レビュー）
