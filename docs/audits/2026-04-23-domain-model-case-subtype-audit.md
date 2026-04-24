# 2026-04-23 Domain Model ve Case Subtype Audit

## Özet

Bu audit, `service_case` merkezli bugünkü modelin dört vaka türünü
(`towing`, `accident`, `breakdown`, `maintenance`) first-class subtype olarak
taşıyıp taşıyamadığını read-only biçimde inceledi.

Ana sonuç: sistem bugün `shared shell + request_draft JSON + tow istisnaları`
şeklinde çalışıyor. `tow` için ayrı create route ve ayrı stage makinesi var,
ama hâlâ `service_cases` tablosu içine gömülü. `accident`, `breakdown` ve
`maintenance` tarafında ise subtype sınırı daha çok validation ve UI akışı
seviyesinde kalıyor; persistence, workflow ve shared domain tiplerinde tam
first-class ayrışma yok.

Bu paket şu teslimatlarla birlikte okunmalı:

- `docs/audits/2026-04-23-case-subtype-matrix.md`
- `docs/audits/2026-04-23-canonical-case-architecture.md`
- `docs/audits/2026-04-23-workflow-boundary-table.md`
- `docs/audits/2026-04-23-vehicle-snapshot-decision-table.md`
- `docs/audits/2026-04-23-domain-model-fix-backlog.md`

## Kanıt Dayanakları

- Shared case modeli:
  `naro-backend/app/models/case.py:106-227`
- Kind-bazlı request validation:
  `naro-backend/app/schemas/service_request.py:119-317`
- Generic case create servisi:
  `naro-backend/app/services/case_create.py:151-299`
- Tow create route:
  `naro-backend/app/api/v1/routes/tow.py:133-235`
- Workflow blueprint tabloları:
  `naro-backend/app/models/case_process.py:102-220`,
  `naro-backend/app/services/workflow_seed.py:1-210`
- Insurance boundary:
  `naro-backend/app/api/v1/routes/insurance_claims.py:93-170`,
  `naro-backend/app/models/insurance_claim.py:60-136`
- Customer shared draft ve case domain tipleri:
  `packages/domain/src/service-case.ts:193-227`,
  `packages/domain/src/service-case.ts:388-604`
- Customer create payload adaptörü:
  `naro-app/src/features/cases/api.ts:213-266`
- Customer composer:
  `naro-app/src/features/cases/screens/CaseComposerScreen.tsx:256-318`,
  `naro-app/src/features/cases/composer/AccidentFlow.tsx:123-131`,
  `naro-app/src/features/cases/composer/BreakdownFlow.tsx:166-175`
- Customer mock case store:
  `naro-app/src/features/cases/store.ts:165-260`
- Vehicle model ve mobile adaptörü:
  `naro-backend/app/models/vehicle.py:39-88`,
  `naro-backend/app/schemas/vehicle.py:13-84`,
  `naro-app/src/features/vehicles/api.ts:30-100`

## Executive Summary

### P0

- `service_cases` bugün subtype shell değil, subtype verilerinin önemli kısmını
  üzerinde ve `request_draft` içinde taşıyan karma model.
- Shared frontend domain, subtype verisinin bir bölümünü daha type seviyesinde
  kaybediyor; `damage_severity`, `maintenance_detail` ve attachment category
  zinciri canlı create payload'a güvenilir biçimde düşmüyor.
- `towing_required` şu an canonical relation değil; `accident/breakdown`
  içinden çekici ihtiyacı UI yönlendirmesi ve boolean flag ile temsil ediliyor.
- Workflow mimarisi niyet düzeyinde subtype-aware, implementasyonda ise kopuk:
  `breakdown/towing` generic create'de `maintenance_standard` fallback alıyor,
  `seed_blueprint()` devreye girmiyor, tow ise shared enum dışında
  `towing_immediate` / `towing_scheduled` string'leri yazıyor.
- Vehicle master ve immutable case snapshot sınırı net değil; case operasyonu
  ince vehicle kaydı ve request snapshot karışımıyla yaşıyor.

### P1

- Insurance v1 doğru biçimde `accident` ile sınırlı düşünülmüş, ama bu sınır
  subtype modelinden ziyade `case.kind='accident'` kontrolüyle enforce ediliyor.
- Shared `ServiceCase` contract'ı tow workflow gerçekliğini taşıyamıyor;
  domain enum seti tow blueprint'lerini kapsamıyor.
- Mock/store katmanı subtype farklarını düzleştiriyor; özellikle customer case
  store bütün non-maintenance vakaları aynı blueprint altında topluyor.

## Bulgular

### P0-1 `service_cases` subtype shell değil, karma veri modeli

- Sınıf: `storage gap`, `architecture gap`
- Etki:
  Dört vaka türü ortak kabuk altında yaşamak yerine, shared tablo ile subtype
  alanlarının karıştığı hibrit bir yapı oluşmuş. Bu durum migration, matching,
  reporting ve lifecycle güvenliğini zorlaştırıyor.
- Kanıt:
  `models/case.py:106-227` tek `ServiceCase` tablosunda ortak alanlarla birlikte
  tow'a özgü `tow_mode`, `tow_stage`, `tow_required_equipment`, pickup/dropoff
  kolonlarını tutuyor.
  Buna karşılık `accident`, `breakdown`, `maintenance` için fiziksel subtype
  tablosu yok; bunların verisi `request_draft` JSONB snapshot'ında kalıyor.
  `schemas/service_request.py:119-317` bu subtype alanlarını validation'da
  ayrıştırıyor ama persistence tarafı bunu takip etmiyor.
- Sonuç:
  Bugünkü model "shared shell + one special-case subtype (tow)" durumunda.
- Audit kararı:
  `service_case` ortak shell olarak kalmalı, fakat subtype verisi 1:1 subtype
  tablolara ayrılmalı.

### P0-2 Frontend ve shared domain subtype verisini create öncesi kaybediyor

- Sınıf: `contract gap`, `collection gap`
- Etki:
  Backend validation subtype ayrımı istese de customer tarafı bazı sinyalleri
  hiç taşıyamıyor veya submit anında sıfırlıyor. Bu, subtype-first mimariye
  geçişte en kritik kırıklardan biri.
- Kanıt:
  `packages/domain/src/service-case.ts:193-227` içindeki `ServiceRequestDraft`
  shared domain tipi `damage_severity` ve `maintenance_detail` alanlarını
  içermiyor.
  `naro-app/src/features/cases/api.ts:228-266` submit adaptörü
  `damage_severity: null`, `maintenance_detail: null`, `attachment.category: null`
  yazıyor.
  `MaintenanceFlow.tsx:131-178` kategori detayını backend'in beklediği typed
  `maintenance_detail` yerine `maintenance_items` listesine topluyor.
  `case_create.py:120-145` ve `:221-231` attachment category ve subtype detail
  bazlı zorunlu kanıt / detail kurallarını bekliyor.
- Sonuç:
  Shared domain tipi ve customer submit adaptörü subtype sınırını taşımıyor.
- Audit kararı:
  Subtype verisi shared summary tipinden ayrılmalı; create request yüzeyi
  subtype-specific request tiplerine bölünmeli.

### P0-3 `towing_required` canonical relation değil; tow ihtiyacı boolean flag ile taşınıyor

- Sınıf: `architecture gap`, `workflow gap`
- Etki:
  `accident` veya `breakdown` içinden doğan tow ihtiyacı ayrı operasyonel varlık
  olarak izlenemiyor; linked tow case yerine UI yönlendirmesi ve flag kullanımı
  var.
- Kanıt:
  `AccidentFlow.tsx:123-131` kullanıcıyı tow compose'a yönlendirirken sadece
  `vehicle_drivable=false`, `towing_required=true` yazıyor.
  `BreakdownFlow.tsx:166-175` aynı mantıkla `towing_required` toggle ediyor.
  Backend modellerinde `related_case`, `parent_case`, `linked_tow_case` benzeri
  bir ilişki yok; aramada sadece `media_assets.linked_case_id` bulunuyor.
  `schemas/service_request.py:152-153` `towing_required` alanını request'te
  tutuyor ama bu alanı gerçek tow relation'a bağlayan persistence yok.
- Sonuç:
  Tow ihtiyacı bir domain relation değil, UI niyet işareti gibi davranıyor.
- Audit kararı:
  `accident/breakdown -> linked tow case` relation canonical hale gelmeli;
  `towing_required` en fazla kısa ömürlü draft sinyali olmalı.

### P0-4 Workflow mimarisi subtype-aware tasarlanmış ama implementasyonda kopuk

- Sınıf: `workflow gap`, `parity gap`
- Etki:
  Ortak shell workflow ile subtype workflow arasında tek bir gerçeklik yok.
  Bu da hem backend süreç tablolarını hem mobile case contract'ını kararsız
  bırakıyor.
- Kanıt:
  `case_create.py:151-172` `accident` için `damage_*`, `maintenance` için
  `maintenance_*` blueprint döndürüyor; `breakdown + towing` için ise doğrudan
  `maintenance_standard` fallback kullanıyor.
  `workflow_seed.py:1-210` yalnızca dört blueprint tanımlıyor ve dosya içinde
  `create_case()` sonrası `seed_blueprint()` çağrısı bekleniyor diyor.
  `case_create.py:247-299` içinde bu seed çağrısı yok.
  `tow.py:166-169` tow create route ise shared enum dışında
  `towing_immediate` / `towing_scheduled` string'leri yazıyor.
  `packages/domain/src/service-case.ts:388-396` shared domain yalnızca dört
  blueprint'i kabul ediyor; tow blueprint'leri burada temsil edilemiyor.
  `naro-app/src/features/cases/store.ts:246-248` mock case store bütün
  non-maintenance vakaları `damage_uninsured` altında topluyor.
- Sonuç:
  Workflow altyapısı tasarım olarak subtype-first, çalışma biçimi olarak değil.
- Audit kararı:
  Shared shell status'ları ayrı, subtype lifecycle enum / workflow'ları ayrı
  tanımlanmalı; tow için de bu sınır canonical hale getirilmeli.

### P0-5 Vehicle master ve immutable case snapshot sınırı yok

- Sınıf: `storage gap`, `algorithm gap`
- Etki:
  Matching ve operasyon için kritik araç sinyalleri ya hiç modeledilmemiş ya da
  case açılışında immutable snapshot'a bağlanmamış. Bu, ileride daha zeki
  eşleşme ve sigorta akışları için zayıf temel bırakıyor.
- Kanıt:
  `models/vehicle.py:44-87` vehicle master yalnızca plaka, make/model, yıl,
  renk, yakıt, VIN, km, not ve reminder alanlarını tutuyor.
  `schemas/vehicle.py:13-84` aynı dar yüzeyi dışarı açıyor.
  `models/case.py:109-151` case tarafında araç için sadece `vehicle_id` var;
  immutable vehicle snapshot yapısı yok.
  `tow.py:144-146` tow create path araç sahipliğini değil sadece varlığını
  kontrol ediyor; generic `case_create.py:204-206` ise ownership kontrolü yapıyor.
- Sonuç:
  Araç master ve case açılış snapshot mantığı ortak bir domain kuralı değil.
- Audit kararı:
  Araç ana kaydı source of truth kalmalı; matching ve operasyonu etkileyen
  alanlar subtype seviyesinde immutable snapshot ile dondurulmalı.

### P1-1 Insurance boundary doğru ama subtype yerine generic kind check ile kurulmuş

- Sınıf: `boundary gap`
- Etki:
  Bugün insurance v1 doğru biçimde `accident` tarafında tutuluyor, fakat bu
  karar subtype modeli yerine generic case kind bağı üzerinden enforce ediliyor.
- Kanıt:
  `insurance_claims.py:104-109` claim create sadece `case.kind == accident`
  iken çalışıyor.
  `insurance_claim.py:88-100` claim doğrudan `service_cases.id`'ye bağlanıyor;
  `accident_case` benzeri subtype tablo yok.
- Sonuç:
  Kapsam kararı doğru, model sınırı zayıf.
- Audit kararı:
  Insurance v1 `accident` subtype bounded context'i olarak düşünülmeli;
  generic case tablosuna bağımlılık azaltılmalı.

### P1-2 Shared `ServiceCase` sözleşmesi tow gerçeğini ve subtype ayrımını tam taşıyamıyor

- Sınıf: `contract gap`
- Etki:
  Mobile/shared type sistemi subtype-first mimariye hazırlanmış değil; tow ve
  subtype detail tarafı generic `request` alanına sıkışıyor.
- Kanıt:
  `packages/domain/src/service-case.ts:558-604` `ServiceCaseSchema` ortak bir
  `request: ServiceRequestDraftSchema` alanı taşıyor.
  Aynı shared draft tipi tow-specific request surface'i ve subtype detail
  alanlarını birlikte modellemiyor.
  Workflow enum seti tow blueprint'lerini de içermiyor.
- Sonuç:
  Public contract katmanı shared shell ile subtype detail union'una ayrılmamış.
- Audit kararı:
  Gelecek implementation fazında summary/detail union ve subtype request/response
  tipleri ayrılmalı.

## Ana Karar

Repo gerçeği, hedeflenen mimariyi destekleyen üç önemli işaret veriyor:

- Tow zaten ayrı create contract ve ayrı lifecycle ile düşünülmüş.
- Backend validation subtype mantığını biliyor.
- Insurance ve maintenance detail gibi alanlarda subtype-aware kurallar mevcut.

Ama bu işaretler henüz ortak bir canonical model oluşturmuyor.

Bu audit'in net kararı:

- `service_case` ortak kabuk olarak kalmalı.
- `tow_case`, `accident_case`, `breakdown_case`, `maintenance_case` 1:1 subtype
  varlıkları first-class hale gelmeli.
- `request_draft` veya benzeri JSON alanlar immutable trace ve UI snapshot için
  kalmalı; matching, lifecycle veya reporting kaynağı sayılmamalı.
- `accident/breakdown` içindeki tow ihtiyacı ayrı `tow case` relation'ı ile
  temsil edilmeli.
- Vehicle verisi master + immutable subtype snapshot modeliyle ele alınmalı.

Detaylı sınıflandırma ve uygulanabilir sıra için destek dokümanları kullanın:

- `docs/audits/2026-04-23-case-subtype-matrix.md`
- `docs/audits/2026-04-23-canonical-case-architecture.md`
- `docs/audits/2026-04-23-workflow-boundary-table.md`
- `docs/audits/2026-04-23-vehicle-snapshot-decision-table.md`
- `docs/audits/2026-04-23-domain-model-fix-backlog.md`
