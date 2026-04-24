# 2026-04-23 Matching Structural Audit

## Özet

Bu audit, tow immediate akışını referans alıp ortak matching primitive'lerini
backend, customer app ve service app boyunca read-only olarak inceledi.
Amaç, "hangi veri gerçekten toplanıyor, nereye yazılıyor, algoritma bunu
kullanabiliyor mu?" sorusuna karar verilebilir cevap üretmekti.

Ana sonuç: mevcut yapı şehir/district/kapasite/araç uyumluluğu gibi
eşleştirme zekasını taşıyacak veri modelini parçalı halde barındırıyor ama
karar motoruna bağlamıyor. Bazı sinyaller hiç toplanmıyor, bazıları sadece
store veya JSONB içinde kalıyor, bazıları ise backend tablolarında mevcut
olmasına rağmen mobil yüzeylerden canlıya hiç yazılamıyor.

Bu paket şu teslimatlarla birlikte okunmalı:

- `docs/audits/2026-04-23-signal-lifecycle-matrix.md`
- `docs/audits/2026-04-23-vehicle-media-readiness.md`
- `docs/audits/2026-04-23-matching-decision-table.md`
- `docs/audits/2026-04-23-matching-fix-backlog.md`

## Kanıt Dayanakları

- Tow dispatch SQL ve selection mantığı:
  `naro-backend/app/repositories/tow.py:113-205`
- Tow dispatch orchestration:
  `naro-backend/app/services/tow_dispatch.py:52-195`
- Generic pool feed:
  `naro-backend/app/repositories/case.py:75-106`
- Vehicle model ve schema:
  `naro-backend/app/models/vehicle.py:39-88`,
  `naro-backend/app/schemas/vehicle.py:13-84`
- Vehicle add UX ve payload adaptörü:
  `naro-app/src/features/vehicles/screens/VehicleAddScreen.tsx:63-340`,
  `naro-app/src/features/vehicles/api.ts:30-100`
- Customer tow compose:
  `naro-app/src/features/cases/screens/CaseComposerScreen.tsx:244-267`
- Customer tow local store:
  `naro-app/src/features/tow/store.ts:45-177`,
  `naro-app/src/features/tow/store.ts:232-320`
- Tow create backend contract:
  `naro-backend/app/api/v1/routes/tow.py:138-220`,
  `packages/domain/src/tow.ts:160-176`
- Service app onboarding data collection ve write path:
  `naro-service-app/src/features/onboarding/screens/ServiceAreaScreen.tsx:45-299`,
  `naro-service-app/src/features/onboarding/api/coverage.ts:12-27`,
  `naro-service-app/src/features/onboarding/store.ts:35-76`
- Technician write APIs:
  `naro-backend/app/api/v1/routes/technicians.py:391-607`
- Media policy:
  `naro-backend/app/services/media_policy.py:105-126`,
  `naro-backend/app/api/v1/routes/media.py:22-70`

## Executive Summary

### P0

- Customer tow compose canlı backend'i by-pass ediyor; pickup, incident reason,
  equipment ve attachment sinyalleri hardcoded/local store üzerinden ilerliyor.
- Vehicle CRUD, eşleştirme için kritik alanları taşımıyor; UI'da toplanan bazı
  alanlar da API payload'ına hiç girmiyor.
- Tow dispatch ve generic pool feed, service area, district, capacity, schedule,
  active role ve workload sinyallerini kullanmıyor.
- Technician tow equipment için DB source-of-truth var ama canlı write path yok;
  dispatch sorgusu yazılamayan bir tabloya güveniyor.
- Matching'i etkileyecek çok sayıda request alanı `request_draft` JSONB içinde
  kalıyor; sorgulanabilir top-level kolonlara çıkmıyor.

### P1

- Service app onboarding'de coverage canlıya gidiyor ama seçim motoru bunu
  kullanmıyor; "eşleştirme bu alanla çalışır" copy'si gerçeği yansıtmıyor.
- Vehicle media policy backend'te hazır ama vehicle API/UI sözleşmesine
  bağlanmamış; `tabThumbnailUri` sürekli `undefined`.
- Shared contracts eşleştirme zekasını küçültüyor: backend `required_equipment`
  dizisi beklerken domain/customer tarafı tekil enum taşıyor; ortak `Vehicle`
  domain tipi de çok dar.

## Bulgular

### P0-1 Customer tow compose canlı matching girişini by-pass ediyor

- Sınıf: `parity gap`, `collection gap`, `algorithm gap`
- Etki: Customer app üzerinden açılan tow case, gerçek backend dispatch
  kararına gerekli sinyalleri üretmiyor; ekipman, olay tipi, pickup koordinatı
  ve attachment verisi yanlış veya boş gidiyor.
- Kanıt:
  `CaseComposerScreen.tsx:244-267` towing branch'inde `useTowStore` çağrılıyor.
  `pickup_lat_lng` varsayılan sabit, `incident_reason="not_running"`,
  `required_equipment="flatbed"`, `attachments=[]`.
  `tow/store.ts:232-245` local matching sadece equipment eşitliği + mesafeyle
  seed teknisyen seçiyor.
  Buna karşılık backend `tow.py:159-185` gerçek payload'tan `tow_required_equipment`,
  `incident_reason`, pickup/dropoff ve fare snapshot bekliyor.
- Sonuç: Immediate tow için müşteri uygulaması bugün canlı algoritmayı test eden
  giriş noktası değil.
- Önerilen düzeltme türü: `mock kaldır`, `frontend collect et`, `contract adapt`

### P0-2 Vehicle CRUD matchability için yetersiz; bazı UI alanları da düşüyor

- Sınıf: `collection gap`, `contract gap`, `storage gap`
- Etki: Araç uyumluluğu, ağır araç ayrımı, çekici tipi seçimi, hasar/erişim
  değerlendirmesi ve araç görseli tabanlı kararlar için gerekli veri yok.
- Kanıt:
  `models/vehicle.py:44-87` yalnızca plaka, marka/model, yıl, renk, yakıt, VIN,
  km, not ve lifecycle alanlarını tutuyor.
  `schemas/vehicle.py:13-84` aynı yüzeyi dışarı açıyor.
  `VehicleAddScreen.tsx:72-81` ve `:128-145` UI'da `transmission`, `engine`,
  `chronicNotes` topluyor.
  `vehicles/api.ts:30-45` bunları payload'a hiç koymuyor.
  `vehicles/api.ts:74-100` adaptörde `transmission`, `engine`,
  `tabThumbnailUri` ve çok sayıda alan `undefined` veya boş diziye dönüyor.
- Sonuç: UI ile persistence arasında veri kaybı var; ayrıca araç sınıfı,
  gövde tipi, drivetrain, ağırlık sınıfı gibi matching-critical alanlar
  baştan tanımlı değil.
- Önerilen düzeltme türü: `schema ekle`, `frontend collect et`, `normalizasyon yap`

### P0-3 Dispatch ve pool selection toplanan operasyon sinyallerini kullanmıyor

- Sınıf: `algorithm gap`
- Etki: Sistem "yakın ama uygun olmayan" teknisyeni seçebilir; kapasitesi dolu,
  vardiyası kapalı veya district dışı teknisyenler eşleştirmeye girebilir.
- Kanıt:
  `repositories/tow.py:165-180` tow candidate SQL sadece
  `provider_type='cekici'`, `availability='available'`, taze live location,
  `current_offer_case_id IS NULL`, radius ve opsiyonel equipment filtresi
  uyguluyor.
  Skor `proximity + evidence_discipline_score + fairness placeholder`
  (`repositories/tow.py:153-164`).
  `repositories/case.py:83-106` pool feed sadece `kind` ve `status` bazlı
  filtreliyor; şehir, district, coverage veya capacity yok.
  Buna rağmen backend technician sinyal modeli `service_area`, `working_districts`,
  `schedule`, `capacity` tablolarını tanımlıyor:
  `models/technician_signal.py:131-245`.
- Sonuç: Elde bulunan operasyon verisi karar motorundan kopuk.
- Önerilen düzeltme türü: `dispatch query değiştir`, `normalizasyon yap`

### P0-4 Tow equipment için source-of-truth var ama canlı write path yok

- Sınıf: `contract gap`, `algorithm gap`
- Etki: Dispatch sorgusu equipment filtresine güveniyor ama bu veriyi müşteri
  ya da teknisyen uygulamalarından canlı biçimde üretmek mümkün görünmüyor.
- Kanıt:
  `models/technician.py:318-335` `technician_tow_equipment` tablosunu tanımlıyor.
  `repositories/tow.py:128-139` SQL bu tabloyu equipment filtresi için kullanıyor.
  Buna karşılık `technicians.py:391-607` içinde tow equipment yazan bir payload
  veya endpoint yok.
  Service app aramasında equipment yalnızca tow demo store ve demo UI içinde
  görünüyor: `naro-service-app/src/features/tow/store.ts`, `TowDispatchSheet.tsx`.
- Sonuç: "required_equipment" canlıda güvenilir bir constraint değil; tablo
  varsa bile populate edilme stratejisi eksik.
- Önerilen düzeltme türü: `schema ekle`, `frontend collect et`, `ürün kararı gerekli`

### P0-5 Matching'i etkileyen sinyaller JSONB içinde kalıyor

- Sınıf: `storage gap`, `algorithm gap`
- Etki: `vehicle_drivable`, `damage_severity`, `symptoms`, `price_preference`,
  attachment kategorileri gibi sinyaller mevcut ama SQL sorgularında kullanılmıyor.
- Kanıt:
  `schemas/service_request.py:119-180` request modelinde geniş alan seti var.
  `case_create.py:247-259` bunların tamamını `request_draft` JSONB olarak yazıyor.
  `case_create.py:261-269` yalnızca towing pickup/dropoff koordinatları top-level
  kolonlara çıkarılıyor.
  `models/case.py:148-205` top-level kolon seti sınırlı; çoğu sinyal indexlenebilir
  alana taşınmıyor.
- Sonuç: Veri "var" ama karar motoru için operasyonalize edilmemiş.
- Önerilen düzeltme türü: `normalizasyon yap`, `schema ekle`

### P1-1 Service app onboarding veriyi topluyor ama büyük bölümü store'da kalıyor

- Sınıf: `parity gap`, `contract gap`
- Etki: Teknik olarak mevcut sinyaller canlı matching'e ulaşmadan kayboluyor.
- Kanıt:
  `ServiceAreaScreen.tsx:45-91` service area ve district bilgisi local store'a
  yazılıyor.
  `store.ts:42-49` `service_area`, `working_schedule`, `capacity` store state'inde.
  Fakat onboarding altında yalnızca `api/coverage.ts` mevcut; `service-area`,
  `schedule` ve `capacity` için service app API dosyası yok.
  Backend'te ise bu write endpoint'leri hazır:
  `technicians.py:520-607`.
- Sonuç: Backend capability yüzeyi ile service app implementasyonu arasında
  ciddi parity açığı var.
- Önerilen düzeltme türü: `frontend collect et`, `contract adapt`

### P1-2 Coverage canlıya gidiyor ama selection motoru kullanmıyor

- Sınıf: `algorithm gap`, `parity gap`
- Etki: Kullanıcıya "coverage eşleştirmede kullanılıyor" mesajı verilirken
  gerçek seçim yalnızca provider type düzeyinde çalışıyor.
- Kanıt:
  `CoverageScreen.tsx:79-99` coverage verisini canlı `/technicians/me/coverage`
  endpoint'ine gönderiyor.
  Aynı ekranda `CoverageScreen.tsx:124-125` "Havuz eşleştirmesi bu 4 boyut
  üstünden çalışır" metni var.
  Ancak `case.py:83-106` pool feed query'si service domain, procedure, brand
  veya drivetrain alanlarını hiç kullanmıyor.
- Sonuç: Ürün copy'si, veri toplama ve backend selection aynı şeyi anlatmıyor.
- Önerilen düzeltme türü: `dispatch query değiştir`, `ürün kararı gerekli`

### P1-3 Vehicle media altyapısı hazır ama vehicle sözleşmesine bağlı değil

- Sınıf: `contract gap`, `parity gap`
- Etki: Araç görseli ve ruhsat görseli ile yapılabilecek doğrulama veya daha
  iyi matching açıklaması ürün yüzeyine çıkmıyor.
- Kanıt:
  `media_policy.py:105-126` `vehicle_license_photo` ve `vehicle_photo`
  purpose'larını tanımlıyor.
  `routes/media.py:22-70` genel upload intent/complete uçlarını sunuyor.
  Buna rağmen vehicle schema ve response'larında asset alanı yok:
  `schemas/vehicle.py:13-84`.
  Vehicle add UI'da attachment picker yok:
  `VehicleAddScreen.tsx:63-340`.
  Customer app `tabThumbnailUri`yı gösterebiliyor ama `vehicles/api.ts:77`
  bunu her zaman `undefined` yapıyor.
- Sonuç: Özellik altyapı düzeyinde var, ürün sözleşmesinde yok.
- Önerilen düzeltme türü: `media wire-up yap`, `schema ekle`

### P1-4 Shared contracts eşleştirme zekasını küçültüyor

- Sınıf: `contract gap`
- Etki: Backend'in çoklu equipment ve daha zengin vehicle/tow sinyali desteği
  mobil ortak kontratta sadeleşip kayboluyor.
- Kanıt:
  Backend `TowCreateCaseRequest` `required_equipment: list[...]` bekliyor:
  `schemas/tow.py`, `tow.py:173-175`.
  Shared domain `TowRequestSchema` tekil `required_equipment` taşıyor:
  `packages/domain/src/tow.ts:160-176`.
  Shared domain `VehicleSchema` ise sadece id/user_id/plate/make/model/year
  içeriyor: `packages/domain/src/vehicle.ts:3-11`.
- Sonuç: Ortak kontratlar gelecekteki algoritma v2 için dar bir taban sunuyor.
- Önerilen düzeltme türü: `contract adapt`, `schema ekle`

## Sonuç

Bugünün matching mimarisi "veri toplama", "canlı contract" ve "karar motoru"
katmanları arasında hizalı değil. Özellikle tow immediate tarafında customer app
gerçek algoritmayı beslemiyor; generic pool tarafında ise teknik olarak toplanan
coverage ve service area sinyalleri selection'a hiç girmiyor.

Bu nedenle "şehir bazlı eşleştirme"yi iyileştirmekten önce şu üç temel adım
zorunlu görünüyor:

1. Canlı giriş yüzeylerini store/mock'tan ayırmak.
2. Matching-critical sinyalleri normalize ve queryable hale getirmek.
3. Dispatch ve pool selection query'lerini mevcut veri modeliyle gerçekten
   konuşur hale getirmek.
