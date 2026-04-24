# Tow Priority Audit Report — 2026-04-23

## Kapsam

- Tow öncelikli launch path denetimi yapıldı: backend dispatch/matching/payment/state machine, customer app, service app ve bunlarla aynı primitive'leri kullanan non-tow zincirler birlikte incelendi.
- Kanonik ürün kuralı audit boyunca sabit kabul edildi: `towing` vakaları yalnızca `provider_type=cekici` adaylarına görünür ve atanır.
- Scheduled tow bidding incelendi, ama immediate tow ana path'i bloklamadığı sürece ikinci faz backlog olarak ele alındı.

## Audit Harness

- Backend proje beyanı: [naro-backend/pyproject.toml](/home/alfonso/sanayi-app/naro-backend/pyproject.toml) `requires-python = ">=3.12"`.
- Shell default yorumlayıcı: `Python 3.10.12`.
- Doğrulanan güvenilir komut:
  - `cd naro-backend && uv sync --extra dev`
  - `env $(grep -v '^#' .env.example | grep -v '^$' | xargs) uv run --python 3.12 python -m pytest ...`
- Tuzak: `uv sync --extra dev` olmadan `pytest` sistemdeki 3.10 binary'sine düşüyor ve `StrEnum` / `datetime.UTC` import hataları üretiyor. Bu hata koddan değil, yanlış harness kullanımından kaynaklanıyor.

## Test Özeti

- Saf test seti 3.12 altında çalıştırıldı:
  - `tests/test_tow_dispatch.py`
  - `tests/test_tow_otp.py`
  - `tests/test_billing_invariants_pure.py`
  - `tests/test_billing_orchestrator_pure.py`
  - `tests/test_billing_iyzico_webhook_pure.py`
  - `tests/test_offers_appointments_pure.py`
  - `tests/test_case_create_schema.py`
  - `tests/test_case_create_service.py`
- Sonuç: `126 passed, 9 skipped, 1 failed`.
- Tek failure çevresel: `tests/test_case_create_service.py::test_create_case_happy_maintenance` `postgres` host'unu çözemediği için DB bağlantısında kaldı. Bu, DB-backed smoke için Docker/Postgres servisinin ayrıca ayağa kaldırılması gerektiğini gösteriyor.

## Route Smoke Özeti

### Doğrulanan canlı route'lar

- `/api/v1/cases/{case_id}/payment/initiate`
- `/api/v1/cases/{case_id}/billing/summary`
- `/api/v1/cases/{case_id}/cancel-billing`
- `/api/v1/tow/cases/{case_id}/location`
- `/api/v1/pool/feed`
- `/api/v1/technicians/me/payouts`

### Eksik veya farklı olan route'lar

- `/api/v1/cases/{case_id}/refunds` yok.
- Customer billing hook'larının beklediği `/api/v1/case-approvals/{approval_id}` ailesi yok.
- Approval route'ları gerçekte `/api/v1/cases/{case_id}/approvals` ve `/api/v1/cases/{case_id}/approvals/{approval_id}/decide`.

## Yönetici Özeti

- **P0:** 6
- **P1:** 5
- **P2:** 3

Ana sonuç:

- Tow backend tarafında önemli parçalar mevcut, ama immediate tow launch zinciri uçtan uca bağlı değil.
- Customer app ve service app tow akışlarının ana bölümü hâlâ local store/demo simülasyonu ile çalışıyor; bu yüzden backend düzeltmeleri gerçek kullanıcı deneyimine yansımıyor.
- En kritik mantık hataları ödeme ve dispatch occupancy tarafında.

## P0 Bulgular

### P0-1 — Tow cancel ücreti yanlış aşamadan yeniden hesaplanıyor

- Ürün kuralı: iptal ücreti `stage_at_cancel` üzerinden hesaplanmalı.
- Kod akışı:
  - [naro-backend/app/services/tow_lifecycle.py](/home/alfonso/sanayi-app/naro-backend/app/services/tow_lifecycle.py) `cancel_case` içinde `stage_at_cancel` kaydediliyor ve `cancellation_fee` bu aşamadan hesaplanıyor.
  - [naro-backend/app/api/v1/routes/tow.py](/home/alfonso/sanayi-app/naro-backend/app/api/v1/routes/tow.py) `cancel` endpoint'i aynı fee'yi tekrar `case.tow_stage` üzerinden hesaplıyor.
- Problem: lifecycle service aşamayı `cancelled` yaptıktan sonra route tekrar `compute_cancellation_fee(case.tow_mode, case.tow_stage)` çağırıyor. `cancelled` stage için helper 0 dönüyor, dolayısıyla `refund_cancellation` tam iade tarafına kayıyor.
- Etki: `accepted / en_route / nearby / arrived` gibi ücretli iptallerde ücret tutulmadan tam iade riski var.
- Düzeltme yönü: route katmanı yeniden hesap yapmamalı; lifecycle service'in oluşturduğu `tow_cancellations.cancellation_fee` kullanılmalı ya da service bu fee'yi return etmelidir.
- Sahip ekip: Backend.

### P0-2 — Dispatch accept sonrasında teknisyen occupancy lock'ı bırakılıyor

- Ürün kuralı: accepted tow bir çekiciyi terminal stage'e kadar ikinci işe açık bırakmamalı.
- Kod akışı:
  - [naro-backend/app/services/tow_dispatch.py](/home/alfonso/sanayi-app/naro-backend/app/services/tow_dispatch.py) `record_dispatch_response` accept durumunda da `release_technician_offer(...)` çağırıyor.
  - [naro-backend/app/repositories/tow.py](/home/alfonso/sanayi-app/naro-backend/app/repositories/tow.py) aday seçiminde `tp.current_offer_case_id IS NULL` filtresi kullanıyor.
- Problem: kabul edilen çekici lock'tan çıkıyor ama availability/occupancy başka alanla da tutulmuyor.
- Etki: aynı çekici ikinci immediate tow case için yeniden seçilebilir.
- Düzeltme yönü: accepted durumda `current_offer_case_id` tutulmalı ya da active-case occupancy için ayrı authoritative alan ve filtre kullanılmalı.
- Sahip ekip: Backend.

### P0-3 — Immediate tow create path'te preauth hiç bağlanmamış

- Ürün kuralı: immediate tow cap-price ödeme koruması preauth ile başlamalı.
- Kod kanıtı:
  - [naro-backend/app/services/tow_payment.py](/home/alfonso/sanayi-app/naro-backend/app/services/tow_payment.py) içinde `authorize_preauth` ve `capture_final` var.
  - Repo taramasında `authorize_preauth(` çağrısı tow route/service path'inde kullanılmıyor; sadece tanım seviyesinde duruyor.
  - [naro-backend/app/api/v1/routes/tow.py](/home/alfonso/sanayi-app/naro-backend/app/api/v1/routes/tow.py) `create_case` yalnızca case oluşturup dispatch başlatıyor.
- Etki: settlement oluşturulmadan dispatch başlayabilir; cancellation/capture/kasko ledger'ı authoritative olmaz.
- Düzeltme yönü: immediate tow create akışına preauth giriş noktası eklenmeli ve settlement yoksa dispatch başlamamalı.
- Sahip ekip: Backend.

### P0-4 — Customer app tow launch path backend'i tamamen bypass ediyor

- Kod kanıtı:
  - [naro-app/src/features/cases/screens/CaseComposerScreen.tsx](/home/alfonso/sanayi-app/naro-app/src/features/cases/screens/CaseComposerScreen.tsx) `kind === "towing"` için `useTowStore.getState().createImmediate/createScheduled` kullanıyor.
  - [naro-app/src/features/tow/store.ts](/home/alfonso/sanayi-app/naro-app/src/features/tow/store.ts) local dispatch, bid, cancel, OTP ve rating simülasyonu yapıyor.
  - [naro-app/src/features/tow/screens/TowCaseScreen.tsx](/home/alfonso/sanayi-app/naro-app/src/features/tow/screens/TowCaseScreen.tsx) veriyi local store'dan okuyor; canlı WS yalnızca additive overlay.
- Etki: gerçek `/tow/cases`, `/tracking`, `/cancel`, `/otp`, `/rating` backend davranışı launch path'te hiç kullanılmıyor.
- Düzeltme yönü: tow customer flow backend snapshot/tabanlı hale getirilmeli; demo store sadece açıkça etiketlenmiş preview modunda kalmalı.
- Sahip ekip: Customer FE + Backend.

### P0-5 — Service app tow dispatch zinciri demo store'da; canlı location path'i de yanlış

- Kod kanıtı:
  - [naro-service-app/src/features/tow/store.ts](/home/alfonso/sanayi-app/naro-service-app/src/features/tow/store.ts) `SAMPLE_DISPATCH`, local OTP ve earnings tutuyor.
  - [naro-service-app/src/features/tow/components/TowCapabilityCard.tsx](/home/alfonso/sanayi-app/naro-service-app/src/features/tow/components/TowCapabilityCard.tsx) açıkça `Demo: test dispatch'i gönder` aksiyonu sunuyor.
  - [naro-service-app/src/features/tow/hooks/useTechTowBroadcaster.ts](/home/alfonso/sanayi-app/naro-service-app/src/features/tow/hooks/useTechTowBroadcaster.ts) POST yolunu `/tow/${caseId}/location` olarak kuruyor.
  - Backend canonical route: `/api/v1/tow/cases/{case_id}/location`.
- Etki:
  - incoming dispatch accept/decline gerçek backend'e gitmiyor,
  - OTP/evidence/finalize zinciri local kalıyor,
  - prod/staging'de live broadcaster açılırsa location POST 404/route drift'e düşecek.
- Düzeltme yönü: provider tow flow için gerçek API client katmanı yazılmalı; location path canonical route ile hizalanmalı.
- Sahip ekip: Service FE + Backend.

### P0-6 — Towing eligibility kuralı hem backend hem service app tarafında yanlış

- Kanonik kural: `towing` yalnızca `cekici`.
- Kod kanıtı:
  - [naro-backend/app/services/pool_matching.py](/home/alfonso/sanayi-app/naro-backend/app/services/pool_matching.py) `KIND_PROVIDER_MAP[TOWING] = {CEKICI, USTA}`.
  - [naro-backend/app/api/v1/routes/offers.py](/home/alfonso/sanayi-app/naro-backend/app/api/v1/routes/offers.py) provider gate için aynı map'i kullanıyor.
  - [naro-service-app/src/features/jobs/store.ts](/home/alfonso/sanayi-app/naro-service-app/src/features/jobs/store.ts) `CASE_KIND_PROVIDERS.towing = ["cekici", "usta"]`.
- Etki: tow vakaları yanlış role'lere görünür; non-çekici aday teklif verebilir.
- Düzeltme yönü: backend ve service-app provider matrices tek canonical rule'a çekilmeli.
- Sahip ekip: Backend + Service FE.

## P1 Bulgular

### P1-1 — Customer billing hook'ları yanlış ya da olmayan route'lara bağlı

- [naro-app/src/features/billing/api.ts](/home/alfonso/sanayi-app/naro-app/src/features/billing/api.ts) şu çağrıları yapıyor:
  - `/cases/{caseId}/refunds` → backend'de yok.
  - `/case-approvals/{approvalId}` → backend'de yok.
  - `/case-approvals/{approvalId}/decision` → backend'de yok.
  - `/case-approvals/{approvalId}/dispute` → backend'de yok.
- Backend tarafında gerçek approval route ailesi:
  - `/cases/{case_id}/approvals`
  - `/cases/{case_id}/approvals/{approval_id}/decide`
- Etki: billing approval/refund ekranları wire-up edildiği anda 404 alacak.
- Sahip ekip: Customer FE.

### P1-2 — Approval response shape beklentisi gerçek backend ile uyuşmuyor

- Customer billing schema `ApprovalDecisionResponse = { approval, payment? }` bekliyor.
- [naro-backend/app/api/v1/routes/approvals.py](/home/alfonso/sanayi-app/naro-backend/app/api/v1/routes/approvals.py) `decide` endpoint'i plain `ApprovalResponse` dönüyor.
- Route doc'u ayrıca payment bridge'in sonraki fazda bağlanacağını söylüyor.
- Etki: path düzelse bile parse kırılacak.
- Sahip ekip: Customer FE + gerekirse ürün kararı.

### P1-3 — Customer non-tow case detail/actions hâlâ store tabanlı

- [naro-app/src/features/cases/api.ts](/home/alfonso/sanayi-app/naro-app/src/features/cases/api.ts) `useSubmitCase` live POST yapıyor.
- Aynı dosyada `useCaseDetail`, `useCaseOffers`, `useCaseThread`, `useSelectCaseOffer`, `useRequestAppointment`, `useCancelCase`, `useShortlistCaseOffer`, `useRejectCaseOffer` ve benzerleri `useCasesStore` üzerinden local çalışıyor.
- Etki: tow dışında da offer/appointment/cancel mantık bug'ları mock zinciri altında gizleniyor.
- Sahip ekip: Customer FE.

### P1-4 — Service app havuz/offer/appointment zinciri store tabanlı

- [naro-service-app/src/features/jobs/api.ts](/home/alfonso/sanayi-app/naro-service-app/src/features/jobs/api.ts) `useCasePool`, `useSubmitOffer`, `useApproveIncomingAppointment` ve benzeri çağrıları `useJobsStore` üzerinden local çalıştırıyor.
- [naro-service-app/src/features/jobs/store.ts](/home/alfonso/sanayi-app/naro-service-app/src/features/jobs/store.ts) başlangıç verisini `seedTrackingCases()` ile kuruyor.
- Etki: pool feed, teklif verme, appointment ve mesajlaşma backend'den kopuk.
- Sahip ekip: Service FE.

### P1-5 — Non-tow offer acceptance hâlâ check-then-update yarışına açık

- [naro-backend/app/services/offer_acceptance.py](/home/alfonso/sanayi-app/naro-backend/app/services/offer_acceptance.py) önce offer'ı okuyor, sonra `mark_accepted`, ardından sibling reject yapıyor.
- Atomic `UPDATE ... WHERE status IN (...) RETURNING` koruması yok.
- Etki: retry / çift tıklama / concurrency durumunda double accept veya duplicate event zinciri oluşabilir.
- Sahip ekip: Backend.

## P2 Bulgular

### P2-1 — Scheduled tow bid endpoint'leri gerçek iş mantığı yerine stub

- [naro-backend/app/api/v1/routes/tow.py](/home/alfonso/sanayi-app/naro-backend/app/api/v1/routes/tow.py) `/tow/bids` ve `/tow/bids/{bid_id}/accept` için açıkça `10f integration pending` dönüyor.
- Immediate tow ana yolunu bloklamıyor, ama scheduled tow gerçek launch scope'una alınırsa yükseltilmeli.
- Sahip ekip: Backend.

### P2-2 — Tow domain schema drift'i var

- Backend tow schema'larında `preauth_failed`, `preauth_stale`, `kasko_rejected` gibi ek stage/status değerleri var.
- [packages/domain/src/tow.ts](/home/alfonso/sanayi-app/packages/domain/src/tow.ts) bunları tanımıyor.
- Şu an primary path store tabanlı olduğu için görünmüyor; live contract tam bağlandığında parse riski doğurur.
- Sahip ekip: Shared domain + FE.

### P2-3 — DB-backed smoke için ops runbook eksik

- Pure testlerin çoğu 3.12 altında geçti.
- DB-backed smoke `postgres` host'unun ayağa kaldırılmasını bekliyor.
- Audit için önerilen standart: `docker compose up -d postgres redis` + `.env.example` üstünden smoke komutları.
- Sahip ekip: Backend / DevEx.

## Hemen Düzelt Backlog'u

1. Tow cancel refund hesabını `stage_at_cancel` bazlı authoritative fee ile değiştir.
2. Accepted tow için occupancy lock'ını terminal stage'e kadar koru.
3. Immediate tow create akışına preauth/settlement gate ekle.
4. Customer tow composer ve tow case ekranını gerçek `/tow/*` route'larına bağla.
5. Service-app tow dispatch/OTP/evidence/location zincirini gerçek backend route'larına bağla.
6. Backend ve service-app provider maps'ten `towing -> usta` yolunu kaldır.

## Launch Öncesi Backlog

1. Customer billing API path ve response shape'lerini backend canonical route'a hizala.
2. Customer case detail offer/appointment/cancel aksiyonlarını live endpoint'lere taşı.
3. Service app pool/offer/appointment/messages zincirini live endpoint'lere taşı.
4. Offer acceptance yarışını atomic update ile kapat.

## Sonraki Sprint

1. Scheduled tow bid wiring.
2. Tow domain schema parity cleanup.
3. DB-backed smoke ve audit harness runbook'unu dokümante et.

## Ek Deliverable'lar

- Contract matrix: [2026-04-23-tow-contract-matrix.md](/home/alfonso/sanayi-app/docs/audits/2026-04-23-tow-contract-matrix.md)
- Mock-to-live map: [2026-04-23-tow-mock-to-live-map.md](/home/alfonso/sanayi-app/docs/audits/2026-04-23-tow-mock-to-live-map.md)
- Invariant checklist: [2026-04-23-tow-invariant-checklist.md](/home/alfonso/sanayi-app/docs/audits/2026-04-23-tow-invariant-checklist.md)
