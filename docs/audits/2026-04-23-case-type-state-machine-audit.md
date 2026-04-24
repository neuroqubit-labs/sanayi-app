# 2026-04-23 Case Type ve State Machine Audit

## Özet

Bu audit, dört vaka türünün (`towing`, `accident`, `breakdown`,
`maintenance`) bugün backend ve mobil tarafta gerçekten hangi lifecycle ile
çalıştığını çıkarmak ve bunun üstüne uygulanabilir bir canonical state machine
paketi yazmak için hazırlandı.

Ana sonuç: sistemde tek bir state machine yok. En az altı ayrı graph birlikte
çalışıyor:

- shared `ServiceCaseStatus`
- tow operasyonu için `TowDispatchStage`
- non-tow finans akışı için `BillingState`
- sigorta için `InsuranceClaimStatus`
- randevu için `AppointmentStatus`
- approval akışlarının case status'a etkileri

Sorun, bu graph'ların var olması değil; authoritative sınırlarının dağınık
olması. `ServiceCaseStatus` bugün hem generic workflow truth'ü, hem tow
projeksiyonu, hem de mobil UX progress spine'ı gibi davranıyor. Bu da aynı
`completed` ve `cancelled` kelimelerinin farklı kod yollarında farklı anlama
gelmesine yol açıyor.

Bu paket şu teslimatlarla birlikte okunmalı:

- `docs/audits/2026-04-23-transition-matrix.md`
- `docs/audits/2026-04-23-authoritative-transition-map.md`
- `docs/audits/2026-04-23-canonical-lifecycle-proposal.md`
- `docs/audits/2026-04-23-backend-mobile-lifecycle-drift.md`
- `docs/audits/2026-04-23-state-machine-fix-backlog.md`

## Audit Defaultları

Bu audit boyunca şu ürün kararları canonical kabul edildi:

- `tow` ortak case shell içinde görünür; operasyonel truth `tow_stage` olur.
- `insurance_claim` yalnızca `accident` vakasında açılır.
- `breakdown` içinde tow gerekiyorsa tow ayrı linked case/subflow olur; ana
  breakdown kapanmaz.
- `accident` içinde insurance opsiyonel branch'tir; teklif/repair akışı onun
  arkasına tamamen kilitlenmez.
- `completed`, iş + müşteri onayı + ödeme kapanışı ile terminal kabul edilir.
- `completed` ve `cancelled`, admin override hariç sink state kabul edilir.

## Kanıt Dayanakları

- Shared case status graph:
  `naro-backend/app/services/case_lifecycle.py:25-87`
- Tow stage graph ve shell sync:
  `naro-backend/app/services/tow_lifecycle.py:34-83`,
  `naro-backend/app/services/tow_lifecycle.py:104-182`,
  `naro-backend/app/services/tow_lifecycle.py:280-300`
- Tow dispatch accept bypass:
  `naro-backend/app/services/tow_dispatch.py:196-236`
- Billing graph ve direct case close:
  `naro-backend/app/services/case_billing_state.py:19-113`,
  `naro-backend/app/services/case_billing.py:466-527`
- Insurance graph:
  `naro-backend/app/services/insurance_claim_flow.py:67-311`,
  `naro-backend/app/api/v1/routes/insurance_claims.py:97-109`
- Appointment lifecycle:
  `naro-backend/app/services/appointment_flow.py:90-275`
- Offer acceptance ve direct first-offer transition:
  `naro-backend/app/services/offer_acceptance.py:49-149`,
  `naro-backend/app/api/v1/routes/offers.py:219-231`
- Approval lifecycle:
  `naro-backend/app/services/approval_flow.py:48-206`
- Generic cancel route:
  `naro-backend/app/api/v1/routes/cases.py:145-171`
- Review gate:
  `naro-backend/app/api/v1/routes/reviews.py:49-72`
- Shared/mobile status tipleri:
  `packages/domain/src/service-case.ts:193-241`,
  `packages/domain/src/tow.ts:33-50`
- Mobile tracking ve UI parity:
  `packages/mobile-core/src/tracking/engine.ts:455-528`,
  `naro-app/src/features/tow/screens/TowCaseScreenLive.tsx:129-132`,
  `naro-service-app/src/features/cases/screens/CaseProfileScreen.tsx:29-89`,
  `naro-app/src/features/cases/store.ts:176`

## Executive Summary

### P0

- Sistemde tek bir lifecycle yok; ama bu çoklu graph yapısının authoritative
  sınırı kodda net değil.
- `ServiceCaseStatus` tow dahil her şeyi temsil etmeye zorlandığı için shell
  status ile operasyonel subtype stage birbirine karışıyor.
- Guard'lı transition modeli parçalanmış durumda; birçok kritik geçiş service
  guard yerine route veya service içinde doğrudan `case.status = ...` ile
  yazılıyor.
- `completed` en az üç farklı kod yolunda üretilebiliyor: approval invoice
  onayı, approval completion onayı ve billing capture finalization.
- `cancelled` semantiği de aynı şekilde parçalı: generic cancel route, tow
  cancel, billing cancel ve appointment cancel aynı terminal anlamı
  taşımıyor.

### P1

- `insurance_claim` doğru biçimde `accident` bounded context'inde duruyor ve
  ayrı branch state machine gibi işliyor; bu sınır korunmalı.
- `breakdown` ve `maintenance` bugün ayrı subtype lifecycle taşımıyor; generic
  shell status graph'ına sıkışmış durumdalar.
- Mobile/shared domain katmanı backend'in çoklu graph yapısını büyük ölçüde
  tek bir progress spine'a indiriyor.

### P2

- Admin override açık bir istisna olarak ayrılmış; bu doğru. Sorun, normal
  user flow'daki direct write'ların da override benzeri davranması.

## Mevcut State Machine Haritası

| Graph | Source of truth | Terminal state'ler | `case.status` etkisi | Not |
| --- | --- | --- | --- | --- |
| `ServiceCaseStatus` | `case_lifecycle.transition_case_status()` | `completed`, `cancelled`, ardından `archived` | Doğrudan | Generic non-tow shell graph. |
| `TowDispatchStage` | `tow_lifecycle.transition_stage()` ve kısmen `tow_dispatch` | `delivered`, `cancelled` | `_sync_case_status()` ile projekte edilir | Tow operasyonunun asıl truth'ü olmalı. |
| `BillingState` | `case_billing_state` + `case_billing` | `settled`, `cancelled` | Kısmen; `case_billing` doğrudan shell kapatıyor | Non-tow finans graph'ı. |
| `InsuranceClaimStatus` | `insurance_claim_flow` | `paid`, `rejected` | Doğrudan etkilemez | `accident` için opsiyonel branch. |
| `AppointmentStatus` | `appointment_flow` | `approved`, `declined`, `cancelled`, `expired` | `transition_case_status()` çağırır | Randevu alt graph'ı. |
| Approval etkileri | `approval_flow` | approval kendi terminaline iner | Case status'u değiştirir | Aslında ayrı approval graph + shell transition etkisi var. |

## Bulgular

### P0-1 Tek bir state machine yok; altı graph birlikte çalışıyor

- Sınıf: `architecture gap`
- Etki:
  Bugünkü sistemde lifecycle tek bir graf üzerinde düşünülürse kararlar hatalı
  çıkıyor. Özellikle debug, analytics, mobile parity ve permission guard'ları
  yanlış soyutlamaya dayanıyor.
- Kanıt:
  `case_lifecycle.py:25-87`, `tow_lifecycle.py:34-300`,
  `case_billing_state.py:19-113`, `insurance_claim_flow.py:67-311`,
  `appointment_flow.py:90-275`, `approval_flow.py:48-206`
  birlikte okunduğunda birbirinden bağımsız ama case'e dokunan birden fazla
  graph görülüyor.
- Audit kararı:
  Tek graph varmış gibi davranmak bırakılmalı. Canonical model
  `shared shell + subtype stage + side branches` olarak resmileştirilmeli.

### P0-2 `ServiceCaseStatus` hem shell truth hem tow projeksiyonu hem UX spine gibi kullanılıyor

- Sınıf: `state boundary gap`
- Etki:
  Tow tarafında `searching`, `accepted`, `nearby`, `arrived`, `loading`,
  `in_transit`, `delivered` gibi operasyonel anlamı çok farklı stage'ler shell
  statüye sıkıştırılıyor. Bu da mobil ve raporlama katmanında yanlış
  genellemeler üretiyor.
- Kanıt:
  `tow_lifecycle._sync_case_status()` tow stage'leri yalnızca
  `matching/service_in_progress/completed/cancelled` eksenine map ediyor
  (`tow_lifecycle.py:280-300`).
  Mobil tow ekranı doğru olarak `snapshot.stage` ile çalışırken
  (`TowCaseScreenLive.tsx:129-132`), generic tracking engine tüm case'leri tek
  `repairFlow` üstünde yürüyor (`packages/mobile-core/src/tracking/engine.ts:455-528`).
- Audit kararı:
  `ServiceCaseStatus` yalnızca coarse shell görünürlüğü taşımalı. Tow
  operasyonunda primary truth `TowDispatchStage` olarak kalmalı.

### P0-3 Authoritative transition guard parçalı; birçok kritik geçiş direct write ile yapılıyor

- Sınıf: `ops/concurrency gap`
- Etki:
  Aynı status ailesi için bazı geçişler guard'lı service katmanından, bazıları
  doğrudan route/service içinden yazıldığı için invariants tek yerde
  korunmuyor.
- Kanıt:
  `cases.py:163` generic cancel route doğrudan `case.status = cancelled`
  yazıyor.
  `offers.py:231` ilk teklifte `matching -> offers_ready` geçişini direct write
  ile yapıyor.
  `tow_dispatch.py:213` accept anında `case.status = service_in_progress`
  yazıyor.
  `case_billing.py:467`, `:505`, `:527` billing servisinde shell'i doğrudan
  kapatıyor.
  Buna karşılık `appointment_flow.py`, `offer_acceptance.py` ve
  `approval_flow.py` çoğu yerde `transition_case_status()` kullanıyor.
- Audit kararı:
  Admin override dışındaki bütün shell status yazımları tek authoritative
  service katmanına taşınmalı.

### P0-4 `completed` semantiği tutarsız; üç farklı business meaning aynı state'i üretiyor

- Sınıf: `workflow gap`
- Etki:
  Case'in gerçekten bittiği an ile kodda `completed` yazıldığı an aynı değil.
  Bu da review gate, payout, reporting ve müşteri deneyimini doğrudan bozar.
- Kanıt:
  `approval_flow.py:147-193` içinde hem `invoice approve` hem `completion
  approve` doğrudan `ServiceCaseStatus.COMPLETED` yazıyor.
  `case_billing.py:466-468` payment capture finalization sonrası da doğrudan
  `COMPLETED` yazıyor.
  `reviews.py:65-72` review açma kuralı yalnızca `case.status == completed`.
- Sonuç:
  Bugün `completed`, bazen fatura onayı, bazen teslim onayı, bazen de finansal
  kapanış anlamına geliyor.
- Audit kararı:
  Canonical anlam sabitlenmeli: `completed = operasyon bitti + müşteri onayı +
  ödeme kapanışı`. `invoice approve` tek başına case kapatmamalı.

### P0-5 `cancelled` semantiği de parçalı; tek terminal kelime birden çok anlam taşıyor

- Sınıf: `workflow gap`
- Etki:
  İptal, tow tarafında ücret/refund ve occupancy release içeren operasyonel bir
  akış; generic case tarafında ise kaba bir route-level terminal write. Aynı
  kavram farklı yan etkilerle yaşadığı için hata riski yüksek.
- Kanıt:
  Generic cancel route: `cases.py:145-171`
  Tow cancel: `tow_lifecycle.py:194-260`
  Billing cancel: `case_billing.py:488-527`
  Appointment cancel ise case'i terminal yapmıyor, varsayılan olarak
  `offers_ready`'ye döndürüyor (`appointment_flow.py:152-166`).
- Audit kararı:
  Cancel semantics case type bazında açıkça ayrılmalı. `cancelled` shell state
  yalnızca authoritative cancel orchestrator tarafından yazılmalı.

### P1-1 Insurance branch doğru bounded context'te; bu yön korunmalı

- Sınıf: `boundary strength`
- Etki:
  `insurance_claim` graph'ı doğru yerde. Buradaki hedef, bunu shell state'e
  eritmek değil; accident subtype'a bağlı ayrı branch olarak korumak.
- Kanıt:
  `insurance_claims.py:97-109` yalnızca `case.kind == accident` için claim
  açıyor.
  `insurance_claim_flow.py:67-311` claim transition'larını ayrı graph olarak
  yönetiyor ve case shell'i doğrudan kapatmıyor.
- Audit kararı:
  Insurance, `accident` için opsiyonel yan branch olarak kalmalı; teklif/repair
  akışı tamamen onun arkasına kilitlenmemeli.

### P1-2 `breakdown` ve `maintenance` subtype lifecycle olarak hâlâ ayrışmamış

- Sınıf: `subtype gap`
- Etki:
  Tow tarafında en azından `tow_stage` gibi ayrı bir truth var. Breakdown ve
  maintenance tarafında ise shell graph doğrudan subtype lifecycle yerine
  kullanılıyor.
- Kanıt:
  Backend tarafında tow dışında subtype-specific stage enum'u yok.
  Generic create ve generic status graph bütün non-tow vakaları aynı shell
  ekseninde taşıyor (`case_lifecycle.py:25-87`).
- Audit kararı:
  Orta vadede `accident`, `breakdown` ve `maintenance` için subtype-aware stage
  veya en azından subtype workflow family tanımı gerekli.

### P1-3 Mobile/shared domain backend'in çoklu graph yapısını düzleştiriyor

- Sınıf: `parity gap`
- Etki:
  Backend'in gerçek lifecycle zenginliği, shared schema ve mobil sunum
  katmanında tek boyutlu hale geliyor. Bu, doğru API kullansak bile yanlış UX
  üretebilir.
- Kanıt:
  Shared domain `ServiceCaseStatusSchema` tek enum sunuyor
  (`packages/domain/src/service-case.ts:229-241`).
  Tracking engine tüm case'ler için ortak `repairFlow` hesaplıyor
  (`packages/mobile-core/src/tracking/engine.ts:455-528`).
  Service app ekranı context ve sticky kararlarını yalnızca `case.status`
  üzerinden veriyor (`CaseProfileScreen.tsx:29-89`).
  Tow live ekranı ise stage bazlı gittiği için daha doğru çalışıyor
  (`TowCaseScreenLive.tsx:129-132`).
- Audit kararı:
  Mobile tarafında lifecycle sunumu case kind ve subtype stage aware hale
  getirilmeli.

### P2-1 Admin override doğru biçimde istisna olarak ayrılmış

- Sınıf: `expected exception`
- Etki:
  Bu yolun varlığı problem değil; çünkü override bilinçli olarak
  `ALLOWED_TRANSITIONS` bypass ediyor ve audit trail üretiyor.
- Kanıt:
  `admin_actions.py:209-247` ve `admin.py:310-335`
- Audit kararı:
  Admin override kalmalı; fakat normal akışta buna benzeyen direct write'lar
  temizlenmeli.

## Case Type Bazlı Lifecycle Snapshot

### `towing`

- Create:
  `/tow/cases` shell'de bir `service_case` açıyor ve stage'i
  `searching` veya `scheduled_waiting` başlatıyor.
- Update:
  Asıl operasyon `tow_stage` üzerinde akıyor; evidence gate ve optimistic lock
  var.
- Cancel:
  Tow-specific cancel servisi ücret/refund ve lock release ile çalışıyor.
- Complete:
  Bugün `delivered -> case.status=completed` eşleşmesi var; canonical hedefte
  bu kapanış payment closure ile uyumlu hale getirilmeli.

### `accident`

- Create:
  Generic `/cases` path'i ile shell `matching` başlıyor.
- Update:
  Offer, appointment, approval ve billing zinciri generic shell üstünden
  yürüyor.
- Insurance:
  Ayrı `insurance_claim` branch'i yalnızca accident için açılıyor.
- Complete:
  Bugün invoice approval, completion approval ve billing capture bu shell'i
  ayrı ayrı kapatabiliyor.

### `breakdown`

- Create:
  Generic `/cases` path'i ile shell `matching` başlıyor.
- Update:
  Fiilen maintenance benzeri generic shell üzerinde yaşıyor.
- Tow ihtiyacı:
  Şu an canonical linked case değil; audit default'unda ayrı tow child olarak
  ele alınmalı.
- Complete:
  Maintenance ile aynı generic kapanış risklerini taşıyor.

### `maintenance`

- Create:
  Generic `/cases` path'i ile shell `matching` başlıyor.
- Update:
  Offer, appointment, service, approval ve billing zinciri bu tip için en
  doğal haliyle shared shell üzerinde çalışıyor.
- Complete:
  Yine de invoice/completion/billing üçlüsünün aynı `completed` state'ine
  yazması bu tip için de sorun.

## Sonuç

Bu audit'in en net çıktısı şu: sorun "status enum'ları fazla" değil; sorun
"hangi graph hangi business meaning'i taşıyor" sorusunun kodda tek cevabı
olmaması.

Canonical yön şu olmalı:

- `ServiceCaseStatus`: coarse shell görünürlüğü
- subtype stage'ler: operasyonel truth
- `BillingState`, `InsuranceClaimStatus`, `AppointmentStatus`: yan branch
  graph'ları
- `completed/cancelled`: tek anlamlı sink state'ler

Bir sonraki uygulama fazı, burada üretilen canonical lifecycle önerisini ve
fix backlog'u doğrudan implementation backlog'una çevirmek olmalı.
