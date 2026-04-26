# Faz 10 — Case Refactor Backend Self-Audit

**Tarih:** 2026-04-26  
**Kapsam:** Faz 8-10 refactor zinciri sonrası backend sözleşmesi, endpoint davranışı ve naming gate kontrolü.  
**Referanslar:** `docs/naro-vaka-omurgasi.md`, `docs/naro-domain-glossary.md §22`, `docs/case-dossier-contract-2026-04-26.md`, `docs/audits/2026-04-26-case-refactor-omurga-drift-audit.md`.

Bu doküman implementation yapmaz. Amaç, vaka omurgasının backend tarafında gerçekten canonical yaşayıp yaşamadığını kanıtla kapatmaktır.

## 1. Sözlük §22 Invariants

| Invariant | Kod kanıtı | Sonuç | Not |
| --- | --- | --- | --- |
| `assigned_technician_id` katı semantik | `app/services/offer_acceptance.py:96`, `app/services/offer_acceptance.py:179`, `app/services/appointment_flow.py:107`, `app/services/tow_dispatch.py:266` | `ALIGNED` | Alan gerçek assignment noktalarında set ediliyor: offer accept, appointment approve veya tow dispatch accept. |
| `preferred_technician_id` müşteri niyeti | `app/repositories/case.py:215`, `app/services/case_create.py:299`, `app/models/case.py:143` | `ALIGNED_BE / PARTIAL_FE` | Backend tarafı niyet alanı olarak tutuyor. FE tracking legacy path'lerinde halen preferred/assigned beraber yorumlanabiliyor; açık borçta tutuldu. |
| `case_links` V1 parent çizgisi | `app/models/case_subtypes.py:68`, `app/models/case_subtypes.py:78`, `app/repositories/case.py:79`, `app/api/v1/routes/cases.py:320` | `ALIGNED` | Genel graph açılmadı; V1 `TowCase.parent_case_id` ile sınırlı. |
| `workflow_blueprint` backend canonical | `app/services/case_create.py:297`, `app/services/workflow_seed.py:234`, `app/api/v1/routes/cases.py:100`, `app/api/v1/routes/pool.py:164` | `ALIGNED` | Case create blueprint üretiyor; response'lar backend değerini taşıyor. Service app `workflowBlueprintFor` kaldırıldı. |
| `CaseTechnicianMatch` V1 read-model | `app/models/case_matching.py:46`, `app/services/case_matching.py:352`, `app/services/case_matching.py:338` | `ALIGNED` | Match teklif, notification veya assignment değil; score cap ve towing exclusion var. |
| `case_dossier` API / `case_profile` UI ayrımı | `app/api/v1/routes/case_dossier.py:19`, `app/services/case_dossier.py:75`, `app/schemas/case_dossier.py:297` | `ALIGNED` | API/system `case_dossier`; customer/service profile ekranları Faz 9'da bu contract'a bağlandı. |
| Planlı çekici scheduled dispatch | `app/models/case.py:67`, `app/services/tow_lifecycle.py:90`, `app/workers/tow/scheduled_payments.py:43`, `app/repositories/case.py:158` | `ALIGNED` | `scheduled_waiting/payment window/dispatch`; normal pool/offer yok. |
| Çekici cancel fee matrisi | `app/services/tow_dispatch.py:333`, `app/services/tow_dispatch.py:341`, `tests/test_tow_dispatch.py:63`, `tests/test_tow_dispatch.py:89`, `tests/test_tow_dispatch.py:110` | `ALIGNED` | `%0/%50/%100` bucket'ları ve `no_candidate_found=%0` testli. |

## 2. Endpoint Sözleşmesi

| Endpoint | Kontrol | Kod kanıtı | Sonuç |
| --- | --- | --- | --- |
| `POST /cases/{id}/notify-technicians` | Ownership, non-tow, assigned case kapalı, match nullable, idempotent upsert | `app/api/v1/routes/cases.py:428`, `app/api/v1/routes/cases.py:443`, `app/api/v1/routes/cases.py:448`, `app/services/case_matching.py:164`, `app/services/case_matching.py:176` | `ALIGNED` |
| `GET /technicians/me/case-notifications` | Dismissed/expired filtre, soft-deleted case dışarıda, match yoksa notification dili | `app/api/v1/routes/technicians.py:327`, `app/api/v1/routes/technicians.py:343`, `app/api/v1/routes/technicians.py:367` | `ALIGNED` |
| `POST /cases/{case_id}/showcase/revoke` | Customer owner guard, başkası 404, service revoke kullanımı | `app/api/v1/routes/cases.py:330`, `app/api/v1/routes/cases.py:344`, `app/services/case_public_showcases.py:464` | `ALIGNED` |
| `POST /appointments` | Bakım/arıza/hasarda offer zorunlu, `direct_request` aktif akışta 422 | `app/api/v1/routes/appointments.py:55`, `app/api/v1/routes/appointments.py:216`, `app/api/v1/routes/appointments.py:224` | `ALIGNED` |
| `POST /offers` | Towing explicit 422, terminal guard, cap'te towing yok | `app/api/v1/routes/offers.py:162`, `app/api/v1/routes/offers.py:165`, `tests/test_offers_appointments_pure.py:150`, `tests/test_offer_terminal_guard_pure.py:89` | `ALIGNED` |
| `POST /cases/{id}/approvals` | Terminal guard, assigned technician guard, description min 10 Pydantic validator | `app/api/v1/routes/approvals.py:79`, `app/api/v1/routes/approvals.py:189`, `app/api/v1/routes/approvals.py:199` | `ALIGNED` |
| `GET /cases/{id}/dossier` | 3 viewer role, redaction, milestones/tasks | `app/api/v1/routes/case_dossier.py:19`, `app/services/case_dossier.py:148`, `app/services/case_dossier_redact.py:79`, `app/schemas/case_dossier.py:314` | `ALIGNED` |
| `GET /pool/feed` | Towing dışlanır, match/notification context taşır, workflow blueprint taşır | `app/repositories/case.py:158`, `app/api/v1/routes/pool.py:119`, `app/schemas/pool.py:31` | `ALIGNED` |
| `GET /cases/me` | Customer active offer count döner; home teklif gelenleri üste alabilir | `app/api/v1/routes/cases.py:106`, `app/api/v1/routes/cases.py:282`, `app/api/v1/routes/cases.py:298` | `ALIGNED` |

## 3. Naming Gate Sonucu

Komut:

```bash
rg -n "extra_payment|additional_payment|additional_amount|\bbid\b|direct_request" \
  naro-app/src naro-service-app/src naro-backend/app packages
```

Sonuç:

```text
packages/domain/src/case_dossier.ts:246:  "direct_request",
naro-backend/app/models/appointment.py:41:    DIRECT_REQUEST = "direct_request"   # Legacy compat; aktif üründe rejected
naro-backend/app/models/appointment.py:49:            "source IN ('offer_accept','direct_request','counter')",
naro-app/src/features/appointments/schemas.ts:28:  "direct_request",
```

Değerlendirme:

- `extra_payment`, `additional_payment`, `additional_amount`, `bid`: aktif app/backend/packages kullanımında `0 hit`.
- `direct_request`: yalnız compat enum/schema ve DB check constraint olarak kalıyor. Aktif route davranışı `422 direct_appointment_disabled`.

Sonuç: `ALIGNED / LEGACY_OK`.

## 4. OM-01 → OM-18 Statü

| ID | Faz 7.5 bulgusu | Güncel statü | Kanıt / not |
| --- | --- | --- | --- |
| `OM-01` | Matching lokasyonu `request_draft` okuyor | `FIX_LANDED` | `_case_location_text` typed alanlara çekildi; test: `tests/test_case_matching_pure.py::test_case_location_text_uses_typed_fields_not_request_draft`. |
| `OM-02` | Tow misc route `request_draft` mutasyonu | `OPEN_P2` | `app/api/v1/routes/tow/misc.py:89` ve `:112` hâlâ snapshot'ı storage gibi kullanıyor. Karar üretmiyor ama sözlük semantiğini kirletiyor. |
| `OM-03` | Offer'sız appointment backend'de kapalı | `ALIGNED` | `offer_required_for_appointment` ve `direct_appointment_disabled` route guard'ları duruyor. |
| `OM-04` | `direct_request` compat/legacy | `LEGACY_OK` | Naming gate yalnız compat hits gösteriyor. |
| `OM-05` | Pool feed çekiciyi dışlıyor | `ALIGNED` | `app/repositories/case.py:158` `ServiceCase.kind != TOWING`. |
| `OM-06` | Tow fallback pool conversion | `FIX_LANDED` | `no_candidate_found` stage eklendi; `app/services/tow_dispatch.py:295`; testler `test_transition_to_no_candidate_found_keeps_case_retryable`, `test_decline_after_three_dispatch_attempts_moves_to_no_candidate`. |
| `OM-07` | Offer endpoint towing explicit kapalı değil | `FIX_LANDED` | `app/api/v1/routes/offers.py:162` `tow_offer_disabled`; `_KIND_OFFER_CAP` towing dışı testli. |
| `OM-08` | Mobile tracking engine workflow kararı üretiyor | `FIX_LANDED/PARTIAL` | `determineBlueprint/buildMilestones/buildTasks` kaldırıldı; engine `caseItem.milestones/tasks` okuyor. Legacy tracking'de preferred/assigned yorum borcu OM-16 altında açık. |
| `OM-09` | Service app `workflowBlueprintFor` karar üretiyor | `FIX_LANDED` | `workflowBlueprintFor` artık yok; backend `workflow_blueprint` response'lara eklendi. |
| `OM-10` | `case_dossier` milestones/tasks eksik | `FIX_LANDED` | `app/schemas/case_dossier.py:314`, `app/services/case_dossier.py:104`, `app/services/case_dossier.py:135`. |
| `OM-11` | Customer/service profile dossier okumuyor | `FIX_LANDED` | `CustomerCaseProfileScreen.tsx` ve service `CaseProfileScreen.tsx` `useCaseDossier` kullanıyor. |
| `OM-12` | Notification match yokken patlıyor | `FIX_LANDED` | `match_id = match.id if match else None`; test: `test_notify_case_to_technician_allows_notification_without_match`. |
| `OM-13` | Customer showcase revoke eksik | `FIX_LANDED` | `POST /cases/{case_id}/showcase/revoke`; pure testler owner/404. |
| `OM-14` | Composer UX basitten zora ilkesinden kopuyor | `FIX_LANDED` | Accident reorder, breakdown description deferral, maintenance manual navigation Faz 8 FE commitinde yapıldı. |
| `OM-15` | Naming gate temiz kalmalı | `ALIGNED` | Naming gate yukarıda; sadece `direct_request` compat. |
| `OM-16` | Assignment semantiği FE'de bulanık | `PARTIAL_OPEN` | Backend aligned. `packages/mobile-core/src/tracking/engine.ts:740` hâlâ `assigned_technician_id || preferred_technician_id` ile bazı legacy tracking izinlerini yorumluyor. |
| `OM-17` | Pool/match coverage kalitesi sınırlı | `PARTIAL_OPEN` | V1 read-model var; scoring city/district ve domain sinyaliyle başladı. Daha geniş coverage/ranking V1.1. |
| `OM-18` | Backend baseline yeşil kalmalı | `ALIGNED` | Faz 10 sonunda full backend pytest ve ruff temiz çalıştı. |

## 5. Açık Tech Debt

| Borç | Öncelik | Neden açık kaldı |
| --- | --- | --- |
| `OM-02` tow misc `request_draft` mutasyonu | `P2` | Kasko/rating storage ayrı typed alana taşınmalı. Karar üretmediği için Faz 8/10 critical path'e alınmadı. |
| `OM-16` FE preferred/assigned tracking semantiği | `P1` | Backend doğru; legacy tracking engine bazı mock/live yorumlarında preferred'i assignment gibi görebiliyor. Faz 10 sonrası tersine FE audit konusu. |
| `OM-17` match coverage genişletme | `P1/P2` | V1 açıklanabilir match var; daha iyi city/district/service-domain coverage ve customer home kartları iyileştirilecek. |
| Production media asset backfill | `P2` | Önceki baseline smoke'ta processing asset riski teknik veri bakımı olarak kaldı. |
| Step-up auth | `V1.1` | Payout/admin hassas aksiyonları için security fazı. |
| Notification channel genişletme | `V1.1` | Şu an intent/inbox yeterli; push/SMS delivery ayrı ops fazı. |

## 6. Refactor Genel Sonuç

Backend açısından vaka omurgası artık canonical olarak yaşıyor:

- Ana süreç nesnesi `case`; request/draft/job alias'ları aktif karar katmanından ayrıştı.
- Bakım/arıza/hasar için offer'sız appointment kapalı.
- `CaseTechnicianMatch` ve `CaseTechnicianNotification` ayrı kavramlar olarak çalışıyor.
- Immediate/scheduled towing V1'de dispatch ailesinde kalıyor; normal offer/pool'a sızmıyor.
- `case_dossier` role-safe tek sözleşme olarak müşteri ve servis profil ekranlarını besliyor.
- Workflow blueprint ve milestone/task kaynaklığı backend tarafında.
- Naming gate, yasaklı ödeme/offer dilini aktif yüzeyden temiz tutuyor.

Kapanış notu: Refactor "ürün omurgası" yönünden doğru hatta. Kalan riskler artık temel contract drift'i değil; FE legacy tracking yorumu, tow misc snapshot storage temizliği ve match coverage kalitesi gibi ikinci katman borçlar.
