# Frontend Billing Wire-up Brief (naro-app)

> **PO kaynak:** PRODUCT-OWNER · 2026-04-22
> **Hedef sohbet:** UI-UX-FRONTEND-DEV (naro-app primary; naro-service-app minor)
> **Kardeş doc:** [backend-billing-servisi-brief.md](backend-billing-servisi-brief.md) — BE tarafı
> **Süre tahmini:** ~6-7 iş günü (BE Faz 3-4 bitince başlar; şimdi brief hazır)
> **Bağımlılık:** BE billing Faz 1 (şema + state) + Faz 2 (Iyzico V1.1 concrete) — onlar bitmeden FE wire-up gerçek endpoint tüketemez; mock ile başlanabilir

---

## 1. Context

Müşteri app ödeme akışı bugün **hiç yok**. Composer submit sonrası teklif seçilse de para akışı tetiklenmiyor. Şimdi BE tarafı ([backend-billing-servisi-brief.md](backend-billing-servisi-brief.md)) 7-8 gün sürecek; FE wire-up **paralel brief hazır**, BE sinyali gelince dev beklemez.

**FE'nin yazacağı 5 ana yüzey:**
1. **Payment initiation** — kart seçimi/ekleme + Iyzico 3DS WebView
2. **Parts approval modal** — usta "+X ₺ parça" talep edince müşteri onayı
3. **Invoice approval modal** — iş bitince final tutar onayı + capture trigger
4. **Billing summary** — case profile içinde "Fatura" seksiyonu (estimate → hold → final → iade → kasko)
5. **Cancellation + dispute** — iptal fee uyarısı, red akışı, refund tracking

Usta app tarafı minor: parts_request + invoice submit akışları zaten mevcut approval UI'da; tek eklenen payout summary ekranı (haftalık net kazanç).

---

## 2. 2026 mobile payment landscape — kritik bulgular

Brief yazımı öncesi güncel durum araştırıldı. Karar etkileyen 3 nokta:

### 2.1 Apple App Store — fiziksel hizmet için IAP gerekmez ✓

Naro'nun ödeme modeli (araç tamiri / çekici / bakım = fiziksel hizmet, app dışı ifa) Apple'ın **IAP istisnası** kapsamında. 30 Nisan 2025 Epic v. Apple kararı sonrası external payment kuralları daha da gevşedi:
- Apple komisyonu yok (external payment'larda)
- "Scare screen" uyarıları kalktı
- Neutral "siteden çıkıyorsunuz" mesajı yeterli
- Link kısıtlamaları yok

**Sonuç:** Naro güvenle Iyzico (ya da herhangi bir TR PSP) ile direkt ödeme alabilir, IAP gerekmez. App Store review'da reddedilme riski yok — "physical service" kategorisi net.

### 2.2 React Native 3DS standart pattern

- `react-native-webview` + Iyzico checkout form URL
- 3DS redirect → bank SMS OTP sayfası → callback URL (`narocom://billing/3ds-callback?...`)
- Deep link app'e döner → WebView kapatılır → sonuç state machine'e yazılır

**Standart** (2023-2026 boyunca değişmemiş, Iyzico doc teyitli). Ama compliance-complex pattern — doğru kurmak şart.

### 2.3 PCI scope — SAQ A (bizim durumumuz)

**Kart verisi hiçbir zaman Naro kod tabanına dokunmaz:**
- Mobile app WebView açar → Iyzico sayfası yüklenir → kullanıcı kart bilgisini **Iyzico'nun sayfasına** yazar → Iyzico bank'a yönlendirir → callback Naro app'e döner (sadece `payment_id + status`)
- Naro app/backend **hiçbir zaman** PAN, CVV, expiry görmez
- **PCI DSS SAQ A** — outsourced e-commerce merchants için en hafif kapsam

Şart: WebView **manipüle edilmemiş** olmalı (JS injection, postMessage attack). `originWhitelist` + `onShouldStartLoadWithRequest` URL validation zorunlu.

### 2.4 Riskler + mitigation

| Risk | Mitigation |
|---|---|
| WebView JS manipulation (kart verisi çalma) | `originWhitelist` sadece `iyzico.com` + `*.iyzico.com` domains; `injectedJavaScript` **yazılmaz**; `onMessage` handler sadece expected callback URL pattern'i kabul eder |
| Deep link intercept (başka app callback'i alır) | iOS Universal Links (associated domains) + Android App Links (digital asset links) — custom scheme `narocom://` yerine / yanında |
| 3DS timeout / network drop | WebView yükleme 60s timeout; user-facing "Bankanız yanıt vermiyor, tekrar dene" + state rollback |
| App background'a düşerse (iOS 3DS SMS okurken) | `AppState` listener — reconnect WebView if expired |
| Chargeback / fraud flag | Backend responsibility, FE sadece dispute state'ini göster |

---

## 3. Ekran + komponent mimarisi

### 3.1 Paylaşılan komponentler (`packages/ui/billing/` — yeni dizin)

| Komponent | Kullanım |
|---|---|
| `<ThreeDSWebView>` | Iyzico checkout URL + deep link callback + loading + error states — tüm billing akışları kullanır |
| `<CardMethodCard>` | Kayıtlı kart gösterimi (V2) veya "yeni kart ekle" CTA |
| `<PaymentStatusBadge>` | Pending / authorized / captured / refunded / disputed |
| `<MoneyAmount>` | Formatlı tutar (₺1.450,00 — thousand separator + locale) |
| `<FeeWarningCard>` | İptal/dispute durumunda "Bu iptal size X ₺ ek tahakkuk ettirir" uyarısı |
| `<RefundTrackingRow>` | "İade işleme alındı · 3-5 iş günü" — müşteri refund status takip |
| `<KaskoStatusBadge>` | `kasko_pending / reimbursed / rejected` state chip |

### 3.2 Hook'lar (`packages/mobile-core/src/billing/` — yeni dizin)

| Hook | Amaç |
|---|---|
| `useInitiatePayment(caseId)` | POST /cases/{id}/payment/initiate → 3DS URL + payment_id |
| `use3DSFlow({url, onSuccess, onFail, onCancel})` | WebView lifecycle + callback parsing + timeout |
| `usePartsApproval(approvalId)` | GET + POST approve/reject |
| `useInvoiceApproval(approvalId)` | GET + POST approve/reject (dispute path) |
| `useBillingSummary(caseId)` | GET /cases/{id}/billing/summary |
| `useRefundTracking(caseId)` | Polling refund + kasko state (case profile'da) |
| `useCancellationFeeCompute(caseId, reason)` | Client-side estimate; server nihai hesaplar |

### 3.3 Ekran dosyaları

```
naro-app/src/features/billing/
├── screens/
│   ├── PaymentInitiateScreen.tsx     — kart seçimi + "devam et"
│   ├── ThreeDSFlowScreen.tsx         — WebView host (modal veya stack)
│   └── BillingDetailScreen.tsx       — standalone billing detail (case profile'dan tap)
├── components/
│   ├── BillingSummaryCard.tsx        — case profile section
│   ├── PartsApprovalSheet.tsx        — bottom sheet modal
│   ├── InvoiceApprovalSheet.tsx      — bottom sheet modal
│   ├── CancellationSheet.tsx         — iptal akışı + fee warning
│   └── DisputeSheet.tsx              — red akışı (V2)
└── api.ts                             — endpoint wrappers (TanStack Query)
```

---

## 4. Payment initiation akışı (detay)

### 4.1 Trigger
Offer accept edildi → backend `POST /offers/{id}/accept` → case status `appointment_pending` veya `scheduled` olur. Aynı API response'da:
```json
{
  "case_id": "uuid",
  "payment": {
    "required": true,
    "status": "preauth_requested",
    "redirect_url": "https://checkout.iyzico.com/..." | null
  }
}
```
Eğer `redirect_url != null` → FE `ThreeDSFlowScreen` push eder.

### 4.2 ThreeDSFlowScreen

```tsx
<Screen backgroundClassName="bg-app-bg">
  <Header>
    <BackButton />
    <Title>Güvenli Ödeme</Title>
    <PaymentStatusBadge status="authorizing" />
  </Header>
  
  <WebView
    source={{ uri: redirect_url }}
    originWhitelist={["https://*.iyzico.com", "https://checkout.iyzico.com"]}
    onShouldStartLoadWithRequest={handleCallback}  // deep link catch
    onMessage={handleBridgeMessage}                // Iyzico postMessage (opsiyonel)
    incognito={true}                               // kart bilgisi cache olmasın
    cacheEnabled={false}
    sharedCookiesEnabled={false}                   // SSO leak engeli
    javaScriptEnabled={true}
    onError={handleWebViewError}
  />
  
  <BottomSheet if errorState>
    <ErrorCard reason={errorState} retryAction={retry} />
  </BottomSheet>
</Screen>
```

**Callback handling:**
```tsx
const handleCallback = (event) => {
  const url = event.url;
  if (url.startsWith("narocom://billing/3ds-callback")) {
    const params = parseCallbackParams(url);
    if (params.status === "success") {
      props.onSuccess(params.payment_id);
    } else {
      props.onFail(params.error_code, params.error_message);
    }
    return false;  // WebView'in bu URL'e gitmesini engelle
  }
  return true;  // diğer tüm URL'ler WebView içinde kalır
};
```

### 4.3 Deep link scheme + Universal Link

**iOS Universal Links** (production):
- Apple App Site Association file: `https://naro.com.tr/.well-known/apple-app-site-association`
- Path pattern: `/billing/3ds-callback`
- Info.plist associated domains

**Android App Links:**
- Digital Asset Links: `https://naro.com.tr/.well-known/assetlinks.json`
- `AndroidManifest.xml` intent filter `autoVerify="true"`
- URL: `https://naro.com.tr/billing/3ds-callback`

**Dev + fallback:** Custom scheme `narocom://billing/...` hem dev'de hem Universal Link fail durumunda.

**Expo config:**
```json
// app.json
{
  "expo": {
    "scheme": "narocom",
    "ios": {
      "associatedDomains": ["applinks:naro.com.tr"]
    },
    "android": {
      "intentFilters": [{
        "action": "VIEW",
        "autoVerify": true,
        "data": [{ "scheme": "https", "host": "naro.com.tr", "pathPrefix": "/billing/" }],
        "category": ["BROWSABLE", "DEFAULT"]
      }]
    }
  }
}
```

### 4.4 Timeout + abandon
- 60s WebView yüklenemez → error state + retry
- Kullanıcı back/close → cancel akışı (pre-auth release)
- 10 dk inaktivite → "Ödeme oturumu zaman aşımına uğradı, tekrar başlat"

---

## 5. Parts approval modal

### 5.1 Trigger
BE parts_request approval oluşturdu → push notification → müşteri tap → app `PartsApprovalSheet` açar.

### 5.2 UX yapısı

```
┌─────────────────────────────────────┐
│   ——                                 │
│                                      │
│   [icon]  Ek parça onayı bekliyor    │
│                                      │
│   AutoPro Servis                     │
│   "Süspansiyon rotili değiştirilmeli"│
│                                      │
│   ┌──────────────────────────────┐  │
│   │ 📷 [foto]                     │  │
│   │ Gizli hasar rot ucu           │  │
│   └──────────────────────────────┘  │
│                                      │
│   ─ Önceden onaylanan ─              │
│   Periyodik bakım            1.450 ₺ │
│                                      │
│   ─ Ek istenen ─                     │
│   Rot ucu sağ                  520 ₺ │
│   Rot ucu sol                  520 ₺ │
│   İşçilik                     240 ₺  │
│                          ───────     │
│   Ek tutar                  1.280 ₺  │
│                                      │
│   ⚠️ Kartınızdan ek 1.280 ₺          │
│   otomatik tutulacak                 │
│                                      │
│   [ Reddet ]    [ Onayla + Öde ]     │
│                                      │
│   [ Usta ile konuş ]                 │
└─────────────────────────────────────┘
```

### 5.3 Davranışlar
- **Onayla + Öde:** POST approve → backend ek pre-auth tetikler → `redirect_url` varsa 3DS flow (yeterli olmayan hold durumu) → success → modal kapanır + toast "Onaylandı"
- **Reddet:** POST reject → opsiyonel reason → case dispute state'e girer (müzakere modu)
- **Usta ile konuş:** case thread'e git (mevcut messaging)
- **48h timeout:** otomatik reject (BE cron); müşteri 45 saat sonra reminder push

---

## 6. Invoice approval modal

Benzer pattern — usta iş bitti diyor, invoice_approval açtı. Müşteri görür:

```
İş özeti + final tutar + yapılan işlem listesi
+ "Onayla + Öde" → capture trigger (gerek yoksa ek hold)
+ "İtiraz et" → dispute (admin arabulucu)
+ Rate + yorum (opsiyonel, invoice onaydan sonra)
```

### 6.1 Otomatik onay
Invoice approval 72h içinde müşteri yanıt vermezse otomatik onay (BE cron). UI'da timer gösterilir: *"48 saat içinde itiraz etmezsen otomatik onaylanır"*.

### 6.2 İtiraz (dispute)
`DisputeSheet` açılır:
- Sorun tipi: `İş yapılmadı / Tahminden farklı / Kalite problemi / Diğer`
- Detay yaz
- Foto/video opsiyonel
- POST → case `invoice_dispute` state'e girer
- Admin arabulucu (V1 manuel — 3-5 iş günü SLA)
- UI'da tracking: "İtirazın admin incelemesinde" badge

---

## 7. Billing summary (case profile section)

Case profile sayfasında yeni section — [b7544cc](#) sonrası card registry pattern'e eklenir.

```
┌──────────────────────────────────────┐
│  Fatura                               │
│                                       │
│  Tahmini      1.450 ₺                 │
│  Ek parça     1.280 ₺                 │
│  ───                                  │
│  Toplam       2.730 ₺                 │
│                                       │
│  [●] Pre-auth tutuluyor               │
│  Kart: •••• 4242                      │
│                                       │
│  İşlem bittiğinde nihai tutar         │
│  yansıyacak.                          │
│                                       │
│  [ Faturayı indir (PDF) ]             │
│  [ Kasko tracking  →]   (varsa)       │
└──────────────────────────────────────┘
```

### 7.1 State'e göre varyasyon
- `preauth_held` — hold gösterimi + "nihai tutar sonra"
- `captured` — nihai tutar + komisyon gösterilmez (müşteri görmemeli) + PDF link
- `partial_refunded` — iade edildi satırı
- `kasko_pending` — kasko tracking CTA
- `disputed` — dispute state badge + admin inceleme bilgisi

### 7.2 PDF indirme
E-arşiv fatura URL `case_commission_settlements.invoice_url` (BE §9) → WebView veya native share.

---

## 8. Cancellation + fee flow

Mevcut case iptal UI'ı `CancellationSheet` ile zenginleştirilir:

```
┌─────────────────────────────────────┐
│   Vakayı iptal et                    │
│                                      │
│   Sebep seç:                         │
│   [ Vazgeçtim ]                      │
│   [ Fiyat değişti ]                  │
│   [ Usta cevap vermedi ]             │
│   [ Diğer ]                          │
│                                      │
│   ⚠️ İptal ücreti                    │
│   Şu anki aşamada iptal ücretin:     │
│   75 ₺                                │
│   (Kartından bu tutar çekilecek,     │
│    kalan hold iptal edilecek)        │
│                                      │
│   [ Vazgeç ]    [ İptal et ]         │
└─────────────────────────────────────┘
```

### 8.1 Fee compute
`useCancellationFeeCompute(caseId, stage)` — client-side estimate (UX feedback için). Sunucu nihai hesaplar. Stage'e göre matrix:
- Pre-auth öncesi: 0 ₺
- Pre-auth sonrası, iş başlamadan: 0 ₺ (bakım/hasar/arıza); tow için ayrı matris
- İş başladı: orantılı fee
- Invoice onay sonrası: iptal YOK (refund path'e girer)

### 8.2 Tow cancellation (mevcut)
Faz 10'da tow için K-4 fee matrisi shipped. FE tow cancellation'da aynı pattern reuse.

---

## 9. Error handling matrix

| Durum | UI | Recovery |
|---|---|---|
| 3DS `card_declined` | "Kart reddedildi. Farklı kart dene." | Kart seçim ekranına dön |
| 3DS `insufficient_funds` | "Kartında yeterli bakiye yok." | Farklı kart / farklı zaman |
| 3DS `3ds_timeout` | "3D Secure süresi doldu. Tekrar dene." | Aynı flow retry |
| 3DS `3ds_fail` | "Bankanız onay vermedi. Bankanla görüş veya farklı kart." | Recovery path |
| WebView network fail | "Bağlantı hatası. Tekrar dene." | Retry buton |
| PSP down (backend) | "Ödeme sistemi geçici olarak kullanılamıyor. Birkaç dakika sonra tekrar dene." | Manual retry |
| Pre-auth expired (10+ dk) | "Ödeme oturumun doldu, baştan başlayalım." | Restart flow |
| Duplicate payment (idempotency) | "Bu işlem zaten yapıldı." | Show existing payment status |
| Backend 409 (case state değişti) | "Vakan başka bir durumda. Yeniden yükleyelim." | Refetch case |

### 9.1 i18n mapping
BE response'ta `type` kodu gelir (ör. `payment.3ds_declined`). Mobile'da key'le i18n kataloğundan metin okunur. BE `msg` alanı developer-facing; kullanıcıya gösterilmez.

---

## 10. Accessibility

- `<ThreeDSWebView>` içinde WebView accessibility label set: "Ödeme güvenlik sayfası"
- Loading state screen reader: "Banka onayı bekleniyor"
- Tutarlar ses okuması: "bin dört yüz elli lira" (`accessibilityLabel` formatted)
- Sheet'lerde focus management — modal açılınca ilk odaklanabilir element onay butonu
- Dark/light theme kontrast: %4.5+ WCAG AA

---

## 11. Analytics + observability

### 11.1 Mobile analytics events
- `billing_initiate_started` (case_id, amount_estimated)
- `billing_3ds_success` (payment_id, latency_ms)
- `billing_3ds_failed` (error_code)
- `billing_3ds_abandoned` (user close WebView)
- `billing_parts_approval_approved` / `rejected`
- `billing_invoice_approval_approved` / `disputed`
- `billing_cancellation_initiated` (stage, fee)

Backend PostHog veya Sentry Breadcrumbs.

### 11.2 Sentry error tracking
- WebView load error → Sentry error with URL hash (URL hash'li — kart verisi sızıntısı yok)
- API 5xx error → Sentry transaction
- Idempotency conflict → breadcrumb only (non-fatal)

---

## 12. Offline + network resilience

### 12.1 Offline behavior
- **Payment initiation offline:** "İnternet bağlantın yok. Bağlandığında devam edelim." — local queue YOK (PSP hold gerçek zamanlı)
- **Parts/invoice approval offline:** Local queue (Zustand persist); connectivity dönünce auto-submit
- **Billing summary offline:** Son cached version göster + "Bağlantı kurulunca güncellenir" badge

### 12.2 Network drop during 3DS
- WebView connection lost → 3s retry → 10s fail modal "Bankanla bağlantı koptu, tekrar dene"
- Pre-auth backend'de mevcut ise devam edilebilir (idempotency key ile aynı flow'a dönülür)

---

## 13. Test senaryoları

### 13.1 Unit
- `test_ThreeDSWebView_callback_parse` — valid callback URL → success; malformed → reject
- `test_ThreeDSWebView_origin_whitelist` — non-iyzico URL → blocked
- `test_useCancellationFeeCompute` — stage matrix
- `test_BillingSummaryCard_renders_per_state` — 6 state için görsel snapshot

### 13.2 Integration (mock API)
- Happy path: initiate → 3DS success → invoice approve → captured
- Parts approval: initiate → parts_request → approve → ek 3DS → invoice approve → captured
- Cancel: initiate → cancel → refund tracking
- Dispute: invoice approve reddet → dispute state
- 3DS fail: card_declined → error → retry → success

### 13.3 E2E (Detox — opsiyonel V2)
- Iyzico sandbox kartıyla full flow staging'de

---

## 14. Platform-specific dikkat noktaları

### 14.1 iOS
- **ATS (App Transport Security):** Iyzico domain'leri HTTPS zorunlu (zaten)
- **App Tracking Transparency:** 3DS WebView için değil, Mapbox/analytics için gerek (mevcut mu kontrol edilsin)
- **Background app refresh:** 3DS sırasında user app'i arka plana atabilir (SMS okumak için) — `AppState` listener reconnect
- **Apple Pay opsiyonel (V2):** Iyzico Apple Pay support var; V2 feature

### 14.2 Android
- **Cleartext traffic:** sadece HTTPS; `usesCleartextTraffic=false` default
- **WebView version:** minimum Android 7+ (Chrome WebView güncel); eski WebView 3DS sayfası render edemeyebilir
- **SafetyNet attestation:** V2 anti-fraud opsiyonel
- **Google Pay opsiyonel (V2):** Iyzico Google Pay support

### 14.3 Expo + build
- `react-native-webview` Expo Go'da çalışır (Mapbox'un aksine). Dev cycle temiz.
- `expo-web-browser` alternatifi: in-app browser (SFSafariViewController / Chrome Custom Tabs) — daha güvenli ama WebView'den az kontrol. **Karar: react-native-webview** (Iyzico Turkish support ile tutarlı pattern)
- Expo config plugin gerekmez

---

## 15. Apple + Google Store compliance

### 15.1 Apple App Store Review

Naro **fiziksel hizmet** (araç tamiri / çekici / bakım) → IAP gerekmez. Bu 2026 itibarıyla net, review'da risk yok. Ama Apple review notları:
- "Service reviewed and performed outside app" açıklama yap (case description)
- Review submission'da "This is a marketplace app for physical vehicle services" metnini not et
- Screenshot'larda ödeme UI gösterilebilir (IAP değil, kart ödeme)
- App Privacy (Privacy Nutrition Label) kart bilgisi = "Not collected" (bizim uygulama kart görmez — Iyzico görür)

### 15.2 Google Play Review

Benzer — external payment allowed. Ek:
- Payments policy: Physical services allowed, gambling/digital goods ayrı

### 15.3 Compliance risk flag

- Eğer V2'de "Naro Premium" gibi **digital subscription** eklenirse → Apple IAP + Google Play Billing zorunlu olabilir
- Pilot launch'ta ise digital sub yok → risk yok

---

## 16. Faz planı

### Faz A — Shared infra (1.5 gün)
- `packages/ui/billing/` dizini + 7 component
- `packages/mobile-core/src/billing/` 7 hook
- TanStack Query wrapper (`api.ts`)
- Error mapping katalog (i18n)
- TypeScript types (`@naro/domain/billing.ts` Zod paralel)

### Faz B — 3DS flow + payment initiation (1.5 gün)
- `ThreeDSFlowScreen.tsx` WebView + deep link
- Universal Links + App Links config
- Mock BE backend'e karşı smoke
- Error state'leri (card_declined, timeout, abandon)

### Faz C — Approval + summary (1.5 gün)
- `PartsApprovalSheet.tsx`
- `InvoiceApprovalSheet.tsx`
- `BillingSummaryCard.tsx` (case profile'a entegrasyon)

### Faz D — Cancel + dispute + kasko tracking (1 gün)
- `CancellationSheet.tsx`
- `DisputeSheet.tsx`
- Refund/kasko tracking row'ları

### Faz E — Test + analytics + a11y polish (1 gün)
- Unit + integration testler
- Sentry + analytics events
- Accessibility audit

**Toplam: ~6.5 iş günü** (buffer ile 7).

---

## 17. Acceptance criteria

- [ ] 5 ana yüzey (initiate, parts, invoice, summary, cancel) wire-up + mock smoke
- [ ] Iyzico sandbox ile staging'de E2E başarılı (happy path + card_declined)
- [ ] Universal Links + App Links verified (iOS AASA + Android digital asset links)
- [ ] `originWhitelist` sadece iyzico.com (güvenlik)
- [ ] WebView `incognito` + `cacheEnabled=false` + `sharedCookiesEnabled=false`
- [ ] Error matrix (§9) tümü ele alındı
- [ ] typecheck + lint clean
- [ ] Jest unit + integration tests green
- [ ] Dark/light + a11y smoke
- [ ] Analytics events 8 tane emit ediyor
- [ ] i18n mesaj kataloğu BE `type` kodlarıyla eşleşti

---

## 18. Açık sorular

1. **Kart tokenization V1 vs V2** — mevcut kart kaydetme (V2 — Iyzico Card Storage) yok; her ödeme yeni 3DS. UX kötü ama V1 yeter. V2'de implementasyon?
2. **Apple Pay / Google Pay V2** — Iyzico destekliyor ama UI kurulumu ayrı (Iyzico Apple Pay session). V1 scope dışı.
3. **Dispute tracking V1 manuel** — admin arabulucu manuel; FE ui sadece state badge + "admin inceliyor". V2'de chat + upload ekle?
4. **E-arşiv provider** — BE PDF URL üretiyor; mobile WebView/share mı, download mı? Öneri: native share (iOS UIActivityViewController / Android share intent).

---

## 19. Referanslar

### İç
- [docs/backend-billing-servisi-brief.md](backend-billing-servisi-brief.md) — BE tarafı manifest
- [docs/backend-is-mantigi-hiyerarsi.md §12](backend-is-mantigi-hiyerarsi.md#12-financial-flow) — umbrella
- [docs/cekici-modu-urun-spec.md §4](cekici-modu-urun-spec.md) — tow K-4 cancellation matrix
- [packages/domain/src/service-case.ts](../packages/domain/src/service-case.ts) — CaseApproval enum

### Dış (2026 araştırması)
- [Iyzico 3DS Implementation EN](https://docs.iyzico.com/en/payment-methods/direct-charge/3ds/3ds-implementation)
- [React Native WebView (github)](https://github.com/react-native-webview/react-native-webview)
- [Iyzico React Native form entegrasyonu (Medium 2024-2025)](https://mhmttanas.medium.com/react-native-iyzico-form-entegrasyonu-e76bdbd1f7cd)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) — Section 3.1.1 Physical services exception
- [Epic v. Apple 2025 ruling](https://adapty.io/blog/new-us-ruling-on-external-ios-payments/) — external payment freedom
- [App-to-web payment guidelines (RevenueCat)](https://www.revenuecat.com/blog/engineering/app-to-web-purchase-guidelines/)
- [Mobile Commerce & PCI DSS — Feroot](https://www.feroot.com/blog/mobile-commerce-pci-dss-security/)
- [Expo deep link documentation](https://docs.expo.dev/guides/deep-linking/)

---

**v1.0 — 2026-04-22** · Frontend billing wire-up · UI-UX-FRONTEND-DEV brief · BE billing Faz 3-4 sonrası başlar

Sources:
- [Iyzico 3DS Implementation](https://docs.iyzico.com/en/payment-methods/direct-charge/3ds/3ds-implementation)
- [React Native Iyzico Integration (Medium)](https://mhmttanas.medium.com/react-native-iyzico-form-entegrasyonu-e76bdbd1f7cd)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple External Payment 2025 ruling (Adapty)](https://adapty.io/blog/new-us-ruling-on-external-ios-payments/)
- [App-to-web purchases (RevenueCat)](https://www.revenuecat.com/blog/engineering/app-to-web-purchase-guidelines/)
- [Mobile Commerce & PCI DSS (Feroot)](https://www.feroot.com/blog/mobile-commerce-pci-dss-security/)
- [React Native WebView](https://github.com/react-native-webview/react-native-webview)
