# Tow Contract Matrix — 2026-04-23

## Kural

- Backend canonical contract kaynak kabul edildi.
- `towing` için nihai hedef yalnızca `cekici` eligibility.
- Durum etiketleri:
  - `OK`: backend ve tüketici uyumlu
  - `FE adapt`: backend canlı, tüketici yanlış route/shape veya eksik client kullanıyor
  - `BE fix`: frontend beklentisi makul ama backend route/shape yok
  - `Ürün kararı`: canonical rule net değil ya da mevcut kod ürün spec'i ile çelişiyor

## Tow Akışı

| Capability | Backend canonical | Customer app | Service app | Durum | Sahip |
|---|---|---|---|---|---|
| Fare quote | `POST /api/v1/tow/fare/quote` canlı | Local `buildFareQuote` kullanılıyor | Yok | FE adapt | Customer FE |
| Tow case create | `POST /api/v1/tow/cases` canlı | Local `useTowStore.createImmediate/createScheduled` | Yok | FE adapt | Customer FE |
| Tow snapshot | `GET /api/v1/tow/cases/{case_id}` canlı | `TowCaseScreen` local snapshot okuyor | Yok | FE adapt | Customer FE |
| Tow tracking | `GET /api/v1/tow/cases/{case_id}/tracking` canlı | Local store + WS overlay | Yok | FE adapt | Customer FE |
| Tow cancel | `POST /api/v1/tow/cases/{case_id}/cancel` canlı | Local store cancel | Yok | FE adapt | Customer FE |
| Tow rating | `POST /api/v1/tow/cases/{case_id}/rating` canlı | Local store rating | Yok | FE adapt | Customer FE |
| Dispatch response | `POST /api/v1/tow/cases/{case_id}/dispatch/response` canlı | Yok | Local accept/decline | FE adapt | Service FE |
| Live location | `POST /api/v1/tow/cases/{case_id}/location` canlı | Yok | `/tow/${caseId}/location` yanlış yol | FE adapt | Service FE |
| OTP issue | `POST /api/v1/tow/cases/{case_id}/otp/issue` canlı | Yok | Local OTP | FE adapt | Service FE |
| OTP verify | `POST /api/v1/tow/cases/{case_id}/otp/verify` canlı | Local verify | Local verify | FE adapt | Customer FE + Service FE |
| Evidence register | `POST /api/v1/tow/cases/{case_id}/evidence` canlı ama stub bağ | Yok | Local evidence | FE adapt | Service FE + Backend |
| Scheduled bid submit | `POST /api/v1/tow/bids` stub | Local accept/bid simülasyonu | Lokal teklif ekranı | BE fix | Backend |
| Scheduled bid accept | `POST /api/v1/tow/bids/{bid_id}/accept` stub | Local bid accept | Yok | BE fix | Backend |

## Billing ve Approval

| Capability | Backend canonical | Customer app | Durum | Sahip |
|---|---|---|---|---|
| Payment initiate | `POST /api/v1/cases/{case_id}/payment/initiate` canlı | Live hook + schema uyumlu | OK | — |
| Billing summary | `GET /api/v1/cases/{case_id}/billing/summary` canlı | Live hook + schema uyumlu | OK | — |
| Cancel billing | `POST /api/v1/cases/{case_id}/cancel-billing` canlı | Customer billing hook bunu değil `/cases/{id}/cancel` yolunu kullanıyor | FE adapt | Customer FE |
| Refund list | Route yok | `/cases/{caseId}/refunds` hook var | BE fix veya hook kaldırımı | Backend + Customer FE |
| Approval list | `GET /api/v1/cases/{case_id}/approvals` canlı | `/case-approvals/{approvalId}` bekleniyor | FE adapt | Customer FE |
| Approval decide | `POST /api/v1/cases/{case_id}/approvals/{approval_id}/decide` canlı | `/case-approvals/{approvalId}/decision` + wrapped response bekleniyor | FE adapt | Customer FE |
| Approval dispute | Route yok | `/case-approvals/{approvalId}/dispute` bekleniyor | BE fix veya feature erteleme | Backend + Customer FE |

## Pool / Offers / Appointments

| Capability | Backend canonical | Customer app | Service app | Durum | Sahip |
|---|---|---|---|---|---|
| Pool feed | `GET /api/v1/pool/feed` canlı | Yok | `useJobsStore` mock | FE adapt | Service FE |
| Pool detail | `GET /api/v1/pool/case/{id}` canlı | Yok | `useJobsStore` mock | FE adapt | Service FE |
| Offer submit | `POST /api/v1/offers` canlı | Yok | Local `submitOffer` | FE adapt | Service FE |
| Offer list for case | `GET /api/v1/offers/case/{id}` canlı | Local store offers | Local store offers | FE adapt | Customer FE + Service FE |
| Offer accept | `POST /api/v1/offers/{id}/accept` canlı | Local `selectOffer` | Yok | FE adapt | Customer FE |
| Appointment create | `POST /api/v1/appointments` canlı | Local `requestAppointment` | Yok | FE adapt | Customer FE |
| Appointment approve/decline/cancel | `/api/v1/appointments/*` canlı | Local store | Local store | FE adapt | Customer FE + Service FE |

## Canonical Rule Drift

| Kural | Backend | Service app | Durum | Sahip |
|---|---|---|---|---|
| `towing` yalnızca `cekici` görür | `KIND_PROVIDER_MAP` içinde `usta` da var | `CASE_KIND_PROVIDERS` içinde `usta` da var | Ürün kararı değil, doğrudan kural ihlali | Backend + Service FE |

## Notlar

- Route seviyesi smoke ile doğrulanan var/yok durumu ana rapordaki bulgularla uyumlu.
- Approval tarafında backend route ailesi mevcut, fakat customer FE yanlış endpoint ailesine bağlı.
- Tow payment tarafında settlement service var, ama create/capture zincirine bağlanmadığı için contract mevcut olsa bile launch path authoritative değil.
