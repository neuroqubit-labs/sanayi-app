# 2026-04-23 Authoritative Transition Map

Bu tablo, hangi geçişin gerçekten hangi katman tarafından yönetildiğini ve
guard/audit/direct-write durumunu gösterir.

## Geçiş Envanteri

| Transition family | Örnek geçiş | Tetikleyen katman | Guard var mı | Audit event var mı | Direct write mı | Not |
| --- | --- | --- | --- | --- | --- | --- |
| Shared shell lifecycle | `matching -> offers_ready`, `scheduled -> service_in_progress`, `invoice_approval -> completed` gibi allowed geçişler | `case_lifecycle.transition_case_status()` | Evet; `ALLOWED_TRANSITIONS` | Evet | Hayır | Shell için canonical authority burası olmalı |
| Generic case cancel route | `* -> cancelled` | `api/v1/routes/cases.py` | Kısmi; yalnızca terminal kontrolü var | Evet | Evet | Lifecycle service bypass; P0 drift |
| Offer submit ilk teklif | `matching -> offers_ready` | `api/v1/routes/offers.py` | Hayır | Hayır | Evet | İlk teklif transition'ı lifecycle service'e bağlı değil |
| Offer accept | `pending offer -> appointment_pending` veya `scheduled` | `services/offer_acceptance.py` | Evet; atomic accept + lifecycle çağrısı | Evet | Hayır | Bu alan görece sağlıklı |
| Appointment approve/decline/cancel/counter | `appointment_pending -> scheduled/offers_ready` | `services/appointment_flow.py` | Evet; appointment status + lifecycle guard | Kısmen | Hayır | Cancel event'i zayıf ama shell guard doğru |
| Approval request | `scheduled -> service_in_progress`, sonra `parts_approval` veya `invoice_approval` | `services/approval_flow.py` | Evet | Evet | Hayır | Completion request shell'i değiştirmiyor |
| Approval approve/reject | `parts_approval -> service_in_progress`, `invoice_approval -> completed`, `completion -> completed` | `services/approval_flow.py` | Evet; pending approval guard | Evet | Hayır | `completed` semantiği burada fazla erken yazılıyor |
| Tow normal stage transition | `accepted -> en_route`, `arrived -> loading`, `in_transit -> delivered` | `services/tow_lifecycle.py` | Evet; stage graph + evidence gate + optimistic lock | Evet | Hibrit | Tow graph için doğru authority ama shell sync içeride direct set ile yapılıyor |
| Tow dispatch accept | `searching -> accepted` ve shell `service_in_progress` | `services/tow_dispatch.py` | Kısmen; lock var | Evet | Evet | `tow_lifecycle.transition_stage()` bypass ediliyor |
| Tow cancel | `stage -> cancelled` ve shell `cancelled` | `services/tow_lifecycle.cancel_case()` | Evet; stage + fee + lock | Evet | Evet | Tow için ayrı orchestrator gerekli ama shell authority dağınık |
| Billing capture finalize | Finansal `captured/settled` akışı + shell `completed` | `services/case_billing.py` | Evet; billing transition guard var | Evet; payment event'leri var | Evet | Finansal kapanış shell'i doğrudan kapatıyor |
| Billing cancel | Finansal `cancelled` + shell `cancelled` | `services/case_billing.py` | Evet; billing guard var | Kısmen | Evet | Generic cancel semantics ile çakışıyor |
| Insurance claim transition | `submitted -> accepted -> paid`, `submitted/accepted -> rejected` | `services/insurance_claim_flow.py` | Evet | Evet | Hayır | Ayrı branch olarak sağlıklı |
| Review gate | `completed` case üstünde review create | `api/v1/routes/reviews.py` | Evet; `case.status == completed` | Hayır | Hayır | `completed` anlamı yanlışsa review erken açılır |
| Admin override | `ANY -> ANY` | `services/admin_actions.py` + `/admin/cases/{id}/override` | Bilinçli bypass | Evet | Evet | İstisna olarak kalmalı |

## Toplu Değerlendirme

### Sağlıklı bölgeler

- `case_lifecycle.transition_case_status()`
- `appointment_flow`
- `offer_acceptance`
- `insurance_claim_flow`

### Riskli bölgeler

- Route-level direct writes:
  `cases.py`, `offers.py`
- Service-level direct writes:
  `tow_dispatch.py`, `case_billing.py`
- Hibrit authority:
  `tow_lifecycle` hem stage authority hem shell sync yapıyor

## Audit Kararı

- Admin override hariç hiçbir normal user flow, `case.status` alanına doğrudan
  yazmamalı.
- Shell transition authority tek yerde toplanmalı.
- Tow için stage authority ayrı kalmalı; fakat shell projection kuralı tek bir
  adapter/orchestrator katmanına çekilmeli.
- Billing, approval ve review kapıları aynı `completed` anlamını paylaşmalı.
