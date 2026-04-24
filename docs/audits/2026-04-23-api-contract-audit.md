# 2026-04-23 API Contract Audit

## Özet

Bu audit, backend route/schemas ile customer app ve service app API
katmanlarını sınıf bazında karşılaştırır. Amaç, "endpoint var mı?",
"payload uyuşuyor mu?", "response parse edilebilir mi?", "yoksa sınıf
tamamen mock/store üstünde mi çalışıyor?" sorularını tek dokümanda
yanıtlamaktır.

Ana sonuç: sistemde tek bir API gerçekliği yok. Bazı sınıflar canonical
backend sözleşmesine hizalanmış durumda, bazıları store/mock'ta yaşamaya
devam ediyor, bazıları ise aynı feature içinde hem canlı hem mock iki ayrı
gerçeklik taşıyor. Bu da sürekli validasyon hatası, parse kırığı ve ekipler
arası bağımsız karar hissi üretiyor.

Bu paket şu teslimatlarla birlikte okunmalı:

- `docs/audits/2026-04-23-api-contract-matrix.md`
- `docs/audits/2026-04-23-api-validation-hotlist.md`
- `docs/audits/2026-04-23-api-fix-backlog.md`

## Kanıt Dayanakları

- Backend route seti:
  `naro-backend/app/api/v1/routes/*.py`
- Customer app API katmanı:
  `naro-app/src/features/*/api.ts`
- Service app API katmanı:
  `naro-service-app/src/features/*/api.ts`
- Ortak domain ve frontend schema katmanı:
  `packages/domain/src/*.ts`,
  `naro-app/src/features/*/schemas.ts`,
  `naro-service-app/src/features/*/schemas.ts`

## Executive Summary

### P0

- `appointments` create payload'ı frontend'de backend'in kabul etmediği
  alanlar gönderiyor (`offer_id`, `expires_at`, `source`) ve bu doğrudan
  `422 extra_forbidden` üretebilir.
- `offers` customer schema'sı backend'in dönmediği zorunlu alanları
  (`submitted_at`, `accepted_at`, `rejected_at`, `expires_at`, `created_at`,
  `updated_at`) bekliyor; parse kırığı riski yüksek.
- `billing` refund schema'sı backend response'unda olmayan `case_id` alanını
  zorunlu istiyor; billing summary parse'ı bu yüzden kırılabilir.
- `approvals` create payload frontend schema'sında backend'in zorunlu
  `title` alanı yok; service-side approval create wire-up bu haliyle 422 üretir.
- `cases` ve `jobs` sınıflarında canlı ve mock API'ler aynı feature içinde
  paralel duruyor; ekipler farklı gerçekliklere göre geliştirme yapmış.

### P1

- `tow` tarafında customer app ve service app halen büyük ölçüde local store
  mantığıyla çalışıyor; route parity düzelse bile iş akışı canonical değil.
- `service app onboarding` içinde coverage canlı, ama `service-area`,
  `schedule`, `capacity` sınıfları için client mutation yok.
- `home`, `notifications`, `jobs`, `search` gibi sınıflarda backend endpoint
  hiç yok veya client canlıya bağlanmıyor; ürün yüzeyinde "API varmış gibi"
  algı oluşuyor.

## Sınıf Bazlı İnceleme

### 1. Auth

- Durum: `Uyumlu`
- Backend:
  `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/refresh`
- Client:
  `packages/mobile-core/src/auth.ts`, `naro-app/src/runtime.ts`,
  `naro-service-app/src/runtime.ts`
- Not:
  `TokenPair` shape backend ve domain'de aynı:
  `access_token`, `refresh_token`, `token_type="bearer"`.
- Sonuç:
  Auth sınıfı parity açısından en temiz katmanlardan biri.

### 2. Vehicles

- Durum: `Kısmen uyumlu`
- Backend canonical:
  `routes/vehicles.py`, `schemas/vehicle.py`
- Customer app:
  `features/vehicles/api.ts`, `features/vehicles/schema.ts`
- Güçlü taraf:
  CRUD path'leri (`/vehicles`, `/vehicles/me`, `/vehicles/{id}`,
  `/vehicles/{id}/dossier`, `/history-consent`) canlı ve isim olarak uyumlu.
- Sorun:
  UI'da toplanan `transmission`, `engine`, `chronicNotes`, `tabThumbnailUri`
  gibi alanlar API contract'ta yok; bu nedenle "parse hatası" değil ama
  yapısal veri kaybı var.
- Sonuç:
  Endpoint parity var, semantic parity zayıf.

### 3. Taxonomy

- Durum: `Uyumlu`
- Backend canonical:
  `/taxonomy/service-domains`, `/procedures`, `/brands`, `/districts`,
  `/drivetrains`
- Customer app:
  `features/ustalar/api.ts`
- Service app:
  `features/onboarding/api/taxonomy.ts`
- Not:
  Her iki mobil tarafta da canlı fetch kullanılıyor; schema yüzeyi backend
  ile genel olarak hizalı.

### 4. Technicians Public

- Durum: `Uyumlu`
- Backend canonical:
  `/technicians/public/feed`, `/technicians/public/{id}`
- Customer app:
  `features/ustalar/api.ts`, `features/ustalar/schemas.ts`
- Not:
  Feed ve detail response shape'i PII mask mantığıyla uyumlu.
- Sonuç:
  Public discovery sınıfı canlı contract tarafında stabil.

### 5. Cases Core

- Durum: `Çift gerçeklik`
- Backend canonical:
  `POST /cases`, `GET /cases/me`, `GET /cases/{id}`, `POST /cases/{id}/cancel`
- Customer app:
  `features/cases/api.ts`
- Güçlü taraf:
  `useSubmitCase`, `useMyCasesLive`, `useCaseSummaryLive`, `useCancelCaseLive`
  canlı route'lara bağlı.
- Sorun:
  Aynı dosyada `useCasesFeed`, `useCaseDetail`, `useCaseOffers`,
  `useCaseThread`, `useRefreshCaseMatching`, `useSelectCaseOffer`,
  `useRequestAppointment`, `useCancelCase` gibi çok sayıda hook tamamen
  `useCasesStore` üzerinden çalışıyor.
- Sonuç:
  Cases sınıfında canonical route var ama feature-level tüketim parçalı.
  Bu, backend ve mobil ekiplerinin farklı gerçekliklerde çalışmasına yol açıyor.

### 6. Tow

- Durum: `Kırık / mock-heavy`
- Backend canonical:
  `/tow/fare/quote`, `/tow/cases`, `/tow/cases/{id}`, `/tow/cases/{id}/location`
  ve devam eden stage endpoint'leri
- Customer app:
  `CaseComposerScreen.tsx`, `features/tow/store.ts`
- Service app:
  `features/tow/store.ts`, `useTechTowBroadcaster.ts`
- Sorun:
  Customer app tow create hâlâ local store üstünden akıyor.
  Service app dispatch ve aktif iş akışı da büyük ölçüde demo store tabanlı.
  Route parity kısmen düzelmiş olsa bile feature parity yok.
- Sonuç:
  Tow sınıfı "API mevcut ama ürün akışı canonical değil" kategorisinde.

### 7. Billing

- Durum: `Kısmen uyumlu, schema drift var`
- Backend canonical:
  `/cases/{id}/payment/initiate`,
  `/cases/{id}/billing/summary`,
  `/cases/{id}/cancel-billing`,
  `/technicians/me/payouts`
- Customer app:
  `features/billing/api.ts`, `features/billing/schemas.ts`
- Service app:
  `features/revenue/api.ts`, `features/revenue/schemas.ts`
- Güçlü taraf:
  Route isimleri customer ve service app'te canonical backend'e hizalanmış.
- Sorun:
  `RefundOutSchema` frontend'de `case_id` zorunlu istiyor ama backend
  `RefundOut` bunu döndürmüyor.
  Customer billing schema'sı backend `settlement` alanını görmezden geliyor,
  bu parse için sorun değil ama contract eksik.
- Sonuç:
  Billing sınıfında endpoint parity iyi, response schema parity orta.

### 8. Approvals

- Durum: `Kısmen uyumlu, create tarafı drift`
- Backend canonical:
  `/cases/{case_id}/approvals`,
  `/cases/{case_id}/approvals/{approval_id}/decide`
- Customer app:
  `features/approvals/api.ts`, `features/approvals/schemas.ts`
- Güçlü taraf:
  Customer list ve decide path'leri artık canonical route'ları kullanıyor.
- Sorun:
  Frontend `ApprovalRequestPayloadSchema` içinde backend'in zorunlu `title`
  alanı yok.
  Response tarafında frontend `resolved_at` / `resolver_note` beklerken backend
  `responded_at` / `requested_at` / `service_comment` dönüyor.
- Sonuç:
  Customer consume tarafı çalışabilir, technician create wire-up bu haliyle
  422 riski taşır.

### 9. Appointments

- Durum: `Kırık`
- Backend canonical:
  `POST /appointments`,
  `GET /appointments/case/{id}`,
  `POST /appointments/{id}/approve`,
  `decline`, `cancel`, `counter-propose`, `confirm-counter`, `decline-counter`
- Customer app:
  `features/appointments/api.ts`, `features/appointments/schemas.ts`
- Service app:
  jobs/appointments ekranları ama gerçek API yok, store/mock var
- Sorun:
  Customer `AppointmentRequestPayloadSchema` `offer_id`, `expires_at`, `source`
  alanlarını gönderiyor; backend `AppointmentRequest` `extra="forbid"` ile
  bunları reddeder.
  Service app approve/decline aksiyonları da gerçek `/appointments/{id}/approve`
  yerine jobs store üstünde çalışıyor.
- Sonuç:
  Appointments sınıfı validasyon hatası ve parity kopukluğunun en net
  örneklerinden biri.

### 10. Offers

- Durum: `Kırık`
- Backend canonical:
  `GET /offers/case/{id}`,
  `POST /offers/{id}/accept|shortlist|reject|withdraw`,
  `POST /offers`
- Customer app:
  `features/offers/api.ts`, `features/offers/schemas.ts`
- Service app:
  gerçek submit API yok, jobs store kullanıyor
- Sorun:
  Frontend `OfferResponseSchema` backend'in dönmediği zorunlu alanları
  bekliyor.
  Service app submit offer aksiyonu canlı `/offers` endpoint'ine bağlı değil.
- Sonuç:
  Offers sınıfında hem response parse drift'i hem de service app mock bağı var.

### 11. Technicians Me / Onboarding

- Durum: `Parçalı`
- Backend canonical:
  `/technicians/me/profile`, `/shell-config`, `/coverage`,
  `/service-area`, `/schedule`, `/capacity`, `...`
- Service app:
  `onboarding/api/coverage.ts` canlı
  ama `service-area`, `schedule`, `capacity` için mutation client yok
- Sonuç:
  Backend zengin, mobil client yüzeyi eksik.

### 12. Media

- Durum: `Uyumlu ama sınırlı kullanım`
- Backend canonical:
  `/media/uploads/intents`, `/media/uploads/{id}/complete`, `/media/assets/{id}`
- Client:
  `createMediaApi` + attachment picker akışları
- Sorun:
  Vehicle/tow gibi sınıflarda ürün yüzeyine tam bağlanmamış.
- Sonuç:
  Media sözleşmesi sağlam, feature entegrasyonu zayıf.

### 13. Home / Notifications / Search / Jobs / Records

- Durum: `Mock veya derived class`
- Customer:
  `records` canlı `/cases/me` üstünden türetiliyor.
  `search` tamamen local rehber verisi.
  `notifications` tamamen runtime fixture.
- Service:
  `home`, `jobs`, `notifications` büyük ölçüde store/mock.
- Sonuç:
  Bu sınıflar backend parity beklentisi yaratmamalı; audit'te açıkça
  "mock-derived" olarak işaretlenmeli.

## Sonuç

Bugünkü ana kopukluk, backend route'larının varlığı değil; bu route'ların
mobil feature sınıfları tarafından tutarlı ve tekil şekilde tüketilmemesi.
Ekipler bazı alanlarda canonical route üretmiş, ama mobil tarafta eski
store/mock katmanı ve yeni canlı wrapper'lar birlikte yaşamaya devam etmiş.

Bu yüzden API audit'te öncelik sırası şu olmalı:

1. Doğrudan 422 veya parse kırığı üreten sınıfları temizlemek.
2. Aynı feature içindeki mock ve live katmanlardan birini seçmek.
3. Sınıf bazında canonical owner tanımlamak:
   backend schema mı, shared domain mi, feature-local zod mu?
