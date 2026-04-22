# Naro API — Canonical

**Version:** 0.1.0
**Base URL:** `/api/v1` (production), `http://localhost:8000/api/v1` (dev)
**Auth:** Bearer JWT (Authorization header), OTP login üzerinden
**Content-Type:** `application/json`

**Kapsam:** 115 endpoint, 108 unique path, 19 tag.

> Bu dokümana `scripts/export_openapi.py` + `scripts/render_api_readme.py`
> ile `docs/api/openapi.json`'dan üretilir — manuel düzenleme YAPMA;
> kod değişince script'leri yeniden çalıştır.

## İçindekiler

- [admin](#admin) (11 endpoint)
- [appointments](#appointments) (8 endpoint)
- [approvals](#approvals) (3 endpoint)
- [auth](#auth) (5 endpoint)
- [billing](#billing) (12 endpoint)
- [cases](#cases) (4 endpoint)
- [health](#health) (1 endpoint)
- [insurance-claims](#insurance-claims) (7 endpoint)
- [media](#media) (4 endpoint)
- [observability](#observability) (1 endpoint)
- [offers](#offers) (7 endpoint)
- [pool](#pool) (2 endpoint)
- [reviews](#reviews) (3 endpoint)
- [taxonomy](#taxonomy) (5 endpoint)
- [technicians-me](#technicians-me) (17 endpoint)
- [technicians-public](#technicians-public) (2 endpoint)
- [tow](#tow) (14 endpoint)
- [vehicles](#vehicles) (7 endpoint)
- [webhooks](#webhooks) (2 endpoint)

---

## admin

Admin operasyon yüzeyi (teknisyen onay + cert review + case override + audit).

### GET /api/v1/admin/audit-log

- **Auth:** admin
- **Özet:** Admin aksiyon audit log (AuthEvent reuse)
- **Query:** `action`, `from`, `to`, `cursor`, `limit`
- **Responses:**
  - `200` — PaginatedResponse_AdminAuditItem_ Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/admin/cases/{case_id}/override

- **Auth:** admin
- **Özet:** Case status override — ALLOWED_TRANSITIONS bypass (son çare)
- **Request:** `CaseOverrideRequest`
- **Responses:**
  - `200` — CaseSummaryResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/admin/certificates

- **Auth:** admin
- **Özet:** Admin sertifika kuyruğu (status filter + cursor)
- **Query:** `status`, `cursor`, `limit`
- **Responses:**
  - `200` — PaginatedResponse_CertificatePendingItem_ Successful Response
  - `422` — HTTPValidationError Validation Error

### PATCH /api/v1/admin/certificates/{certificate_id}/approve

- **Auth:** admin
- **Özet:** Sertifika onayla (+ recompute verified_level)
- **Responses:**
  - `200` — CertificatePendingItem Successful Response
  - `422` — HTTPValidationError Validation Error

### PATCH /api/v1/admin/certificates/{certificate_id}/reject

- **Auth:** admin
- **Özet:** Sertifika reddet
- **Request:** `CertificateRejectRequest`
- **Responses:**
  - `200` — CertificatePendingItem Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/admin/technicians

- **Auth:** admin
- **Özet:** Admin teknisyen kuyruğu (status filter + cursor)
- **Query:** `status`, `cursor`, `limit`
- **Responses:**
  - `200` — PaginatedResponse_TechnicianPendingItem_ Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/admin/technicians/{technician_id}/approve

- **Auth:** admin
- **Özet:** Teknisyen onayla (approval_status=ACTIVE)
- **Request:** `TechnicianApproveRequest`
- **Responses:**
  - `200` — UserAdminView Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/admin/technicians/{technician_id}/reject

- **Auth:** admin
- **Özet:** Teknisyen reddet (approval_status=REJECTED)
- **Request:** `TechnicianRejectRequest`
- **Responses:**
  - `200` — UserAdminView Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/admin/technicians/{technician_id}/suspend

- **Auth:** admin
- **Özet:** Teknisyen KYC askıya al (approval_status=SUSPENDED)
- **Request:** `TechnicianSuspendRequest`
- **Responses:**
  - `200` — UserAdminView Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/admin/users/{user_id}/suspend

- **Auth:** admin
- **Özet:** User suspend (user.status=SUSPENDED — full lockout)
- **Request:** `UserSuspendRequest`
- **Responses:**
  - `200` — UserAdminView Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/admin/users/{user_id}/unsuspend

- **Auth:** admin
- **Özet:** User unsuspend (status=ACTIVE)
- **Responses:**
  - `200` — UserAdminView Successful Response
  - `422` — HTTPValidationError Validation Error

---

## appointments

Randevu yaşam döngüsü (request/accept/counter/cancel).

### POST /api/v1/appointments

- **Auth:** role-dependent (see route)
- **Özet:** Direct randevu talebi (müşteri → teknisyen, offer'sız)
- **Request:** `AppointmentRequest`
- **Responses:**
  - `201` — AppointmentResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/appointments/case/{case_id}

- **Auth:** role-dependent (see route)
- **Özet:** Vakanın randevuları (case owner + assigned tech)
- **Responses:**
  - `200` — list[AppointmentResponse] Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/appointments/{appointment_id}/approve

- **Auth:** role-dependent (see route)
- **Özet:** Teknisyen: randevuyu onayla
- **Responses:**
  - `200` — AppointmentResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/appointments/{appointment_id}/cancel

- **Auth:** role-dependent (see route)
- **Özet:** Müşteri/admin: randevuyu iptal et
- **Responses:**
  - `200` — AppointmentResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/appointments/{appointment_id}/confirm-counter

- **Auth:** role-dependent (see route)
- **Özet:** Müşteri: counter-offer onay
- **Responses:**
  - `200` — AppointmentResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/appointments/{appointment_id}/counter-propose

- **Auth:** role-dependent (see route)
- **Özet:** Teknisyen: counter-offer slot önerisi
- **Request:** `AppointmentCounterPayload`
- **Responses:**
  - `200` — AppointmentResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/appointments/{appointment_id}/decline

- **Auth:** role-dependent (see route)
- **Özet:** Teknisyen: randevuyu reddet
- **Request:** `AppointmentReasonPayload`
- **Responses:**
  - `200` — AppointmentResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/appointments/{appointment_id}/decline-counter

- **Auth:** role-dependent (see route)
- **Özet:** Müşteri: counter-offer reddet
- **Request:** `AppointmentReasonPayload`
- **Responses:**
  - `200` — AppointmentResponse Successful Response
  - `422` — HTTPValidationError Validation Error

---

## approvals

### GET /api/v1/cases/{case_id}/approvals

- **Auth:** role-dependent (see route)
- **Özet:** Case approval listesi (participant: customer + assigned tech + admin)
- **Responses:**
  - `200` — list[ApprovalResponse] Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/cases/{case_id}/approvals

- **Auth:** role-dependent (see route)
- **Özet:** Usta onay talebi aç (parts_request / invoice / completion)
- **Request:** `ApprovalRequestPayload`
- **Responses:**
  - `201` — ApprovalResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/cases/{case_id}/approvals/{approval_id}/decide

- **Auth:** role-dependent (see route)
- **Özet:** Customer decide — approve/reject (parts_request / invoice / completion)
- **Request:** `ApprovalDecidePayload`
- **Responses:**
  - `200` — ApprovalResponse Successful Response
  - `422` — HTTPValidationError Validation Error

---

## auth

OTP + JWT authentication + session lifecycle.

### POST /api/v1/auth/logout

- **Auth:** role-dependent (see route)
- **Özet:** Logout
- **Responses:**
  - `200` — LogoutResponse Successful Response

### POST /api/v1/auth/logout_all

- **Auth:** role-dependent (see route)
- **Özet:** Logout All
- **Responses:**
  - `200` — LogoutResponse Successful Response

### POST /api/v1/auth/otp/request

- **Auth:** role-dependent (see route)
- **Özet:** Request Otp
- **Request:** `OtpRequest`
- **Responses:**
  - `200` — OtpRequestResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/auth/otp/verify

- **Auth:** role-dependent (see route)
- **Özet:** Verify Otp
- **Request:** `OtpVerify`
- **Responses:**
  - `200` — TokenPair Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/auth/refresh

- **Auth:** role-dependent (see route)
- **Özet:** Refresh
- **Request:** `RefreshRequest`
- **Responses:**
  - `200` — TokenPair Successful Response
  - `422` — HTTPValidationError Validation Error

---

## billing

Ödeme akışı — 3DS checkout, capture, refund, kasko reimburse, payout. Customer/technician/admin endpoint'leri tek namespace.

### GET /api/v1/admin/billing/commission-report

- **Auth:** admin
- **Özet:** Platform komisyon raporu (from/to filter)
- **Query:** `from`, `to`
- **Responses:**
  - `200` — object Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/admin/billing/kasko-pending

- **Auth:** admin
- **Özet:** Kasko reimbursement bekleyenler (ops queue)
- **Responses:**
  - `200` — list[KaskoSummary] Successful Response

### POST /api/v1/admin/billing/payouts/mark-completed

- **Auth:** admin
- **Özet:** Batch payout complete (manuel banka transfer sonrası)
- **Request:** `MarkPayoutCompletedRequest`
- **Responses:**
  - `200` — list[CommissionSettlementOut] Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/admin/billing/pending-payouts

- **Auth:** admin
- **Özet:** Payout bekleyen commission settlement'ları (haftalık cron öncesi)
- **Responses:**
  - `200` — list[CommissionSettlementOut] Successful Response

### GET /api/v1/admin/billing/settlements

- **Auth:** admin
- **Özet:** Admin settlements listesi (cursor)
- **Query:** `cursor`, `limit`
- **Responses:**
  - `200` — PaginatedResponse_CommissionSettlementOut_ Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/admin/cases/{case_id}/capture-override

- **Auth:** admin
- **Özet:** Acil admin capture override (I-BILL-12 audit zorunlu)
- **Request:** `CaptureOverrideRequest`
- **Responses:**
  - `200` — BillingSummary Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/admin/cases/{case_id}/kasko-reimburse

- **Auth:** admin
- **Özet:** Kasko reimburse — müşteri kartına iade (I-BILL-8)
- **Request:** `KaskoReimburseRequest`
- **Responses:**
  - `200` — BillingSummary Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/admin/cases/{case_id}/refund

- **Auth:** admin
- **Özet:** Admin dispute / override refund (I-BILL-6)
- **Request:** `RefundRequest`
- **Responses:**
  - `200` — BillingSummary Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/cases/{case_id}/billing/summary

- **Auth:** role-dependent (see route)
- **Özet:** Billing özet (case owner ya da admin)
- **Responses:**
  - `200` — BillingSummary Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/cases/{case_id}/cancel-billing

- **Auth:** role-dependent (see route)
- **Özet:** Pre-auth void + case iptal (case owner, V1 %0 fee non-tow)
- **Responses:**
  - `204` — object Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/cases/{case_id}/payment/initiate

- **Auth:** role-dependent (see route)
- **Özet:** Ödeme başlat — 3DS checkout form URL (case owner)
- **Request:** `PaymentInitiateRequest`
- **Responses:**
  - `201` — PaymentInitiateResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/technicians/me/payouts

- **Auth:** technician
- **Özet:** Ustanın kendi payout kayıtları
- **Responses:**
  - `200` — list[TechnicianPayoutItem] Successful Response

---

## cases

Müşteri vaka (ServiceCase) CRUD + cancel.

### POST /api/v1/cases

- **Auth:** role-dependent (see route)
- **Özet:** Yeni vaka oluştur (müşteri)
- **Request:** `ServiceRequestDraftCreate`
- **Responses:**
  - `201` — CaseCreateResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/cases/me

- **Auth:** customer/technician
- **Özet:** Müşterinin vakaları
- **Responses:**
  - `200` — list[CaseSummaryResponse] Successful Response

### GET /api/v1/cases/{case_id}

- **Auth:** role-dependent (see route)
- **Özet:** Vaka detay (participant-only)
- **Responses:**
  - `200` — CaseSummaryResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/cases/{case_id}/cancel

- **Auth:** role-dependent (see route)
- **Özet:** Vaka iptal (müşteri/admin)
- **Responses:**
  - `200` — CaseSummaryResponse Successful Response
  - `422` — HTTPValidationError Validation Error

---

## health

Sistem health check.

### GET /api/v1/health

- **Auth:** public
- **Özet:** Health
- **Responses:**
  - `200` — object Successful Response

---

## insurance-claims

Kaza kasko/trafik sigorta claim yaşam döngüsü. Customer submit/list/detail + admin accept/reject/mark-paid/list.

### GET /api/v1/admin/insurance-claims

- **Auth:** admin
- **Özet:** Admin claim kuyruğu (status filter + cursor)
- **Query:** `status`, `cursor`, `limit`
- **Responses:**
  - `200` — PaginatedResponse_InsuranceClaimResponse_ Successful Response
  - `422` — HTTPValidationError Validation Error

### PATCH /api/v1/admin/insurance-claims/{claim_id}/accept

- **Auth:** admin
- **Özet:** Sigortacı onayı kaydet (admin, submitted→accepted)
- **Request:** `InsuranceClaimAcceptRequest`
- **Responses:**
  - `200` — InsuranceClaimResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### PATCH /api/v1/admin/insurance-claims/{claim_id}/mark-paid

- **Auth:** admin
- **Özet:** Ödeme kaydet (admin, accepted→paid)
- **Request:** `InsuranceClaimPayOutRequest`
- **Responses:**
  - `200` — InsuranceClaimResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### PATCH /api/v1/admin/insurance-claims/{claim_id}/reject

- **Auth:** admin
- **Özet:** Sigorta dosyası reddet (admin, submitted|accepted→rejected)
- **Request:** `InsuranceClaimRejectRequest`
- **Responses:**
  - `200` — InsuranceClaimResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/insurance-claims

- **Auth:** role-dependent (see route)
- **Özet:** Sigorta dosyası aç (case owner, case.kind='accident')
- **Request:** `InsuranceClaimSubmit`
- **Responses:**
  - `201` — InsuranceClaimResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/insurance-claims/case/{case_id}

- **Auth:** role-dependent (see route)
- **Özet:** Case'deki tüm claim'ler (participant or admin)
- **Responses:**
  - `200` — list[InsuranceClaimResponse] Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/insurance-claims/{claim_id}

- **Auth:** role-dependent (see route)
- **Özet:** Tek claim detay (claim owner or admin)
- **Responses:**
  - `200` — InsuranceClaimResponse Successful Response
  - `422` — HTTPValidationError Validation Error

---

## media

Medya upload intent + presigned URL + preview + retention.

### GET /api/v1/media/assets/{asset_id}

- **Auth:** customer/technician
- **Özet:** Get Asset
- **Responses:**
  - `200` — MediaAssetEnvelope Successful Response
  - `422` — HTTPValidationError Validation Error

### DELETE /api/v1/media/assets/{asset_id}

- **Auth:** customer/technician
- **Özet:** Delete Asset
- **Responses:**
  - `200` — MediaAssetEnvelope Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/media/uploads/intents

- **Auth:** customer/technician
- **Özet:** Create Upload Intent
- **Request:** `UploadIntentRequest`
- **Responses:**
  - `200` — UploadIntentResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/media/uploads/{upload_id}/complete

- **Auth:** customer/technician
- **Özet:** Complete Upload
- **Request:** `CompleteUploadRequest`
- **Responses:**
  - `200` — MediaAssetEnvelope Successful Response
  - `422` — HTTPValidationError Validation Error

---

## observability

Prometheus metrics scrape endpoint.

### GET /metrics

- **Auth:** customer/technician
- **Özet:** Prometheus Metrics
- **Responses:**
  - `200` — object Successful Response

---

## offers

Teklif yaşam döngüsü (technician submit/withdraw, customer accept/reject).

### POST /api/v1/offers

- **Auth:** role-dependent (see route)
- **Özet:** Teklif gönder (teknisyen)
- **Request:** `OfferSubmitPayload`
- **Responses:**
  - `201` — OfferResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/offers/case/{case_id}

- **Auth:** role-dependent (see route)
- **Özet:** Vakanın teklifleri (case owner + admin)
- **Responses:**
  - `200` — list[OfferResponse] Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/offers/me

- **Auth:** customer/technician
- **Özet:** Teknisyenin teklifleri (cursor paginated)
- **Query:** `cursor`, `limit`, `status_in`
- **Responses:**
  - `200` — PaginatedResponse_OfferResponse_ Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/offers/{offer_id}/accept

- **Auth:** role-dependent (see route)
- **Özet:** Teklif kabul (müşteri — atomic)
- **Responses:**
  - `200` — OfferResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/offers/{offer_id}/reject

- **Auth:** role-dependent (see route)
- **Özet:** Teklifi reddet (müşteri)
- **Request:** `OfferCustomerRejectPayload`
- **Responses:**
  - `200` — OfferResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/offers/{offer_id}/shortlist

- **Auth:** role-dependent (see route)
- **Özet:** Teklifi kısa listeye al (müşteri)
- **Request:** `OfferShortlistPayload`
- **Responses:**
  - `200` — OfferResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/offers/{offer_id}/withdraw

- **Auth:** role-dependent (see route)
- **Özet:** Teklif geri çek (teknisyen)
- **Request:** `OfferWithdrawPayload`
- **Responses:**
  - `200` — OfferResponse Successful Response
  - `422` — HTTPValidationError Validation Error

---

## pool

Teknisyen havuz feed — kendine uygun case'leri listeler (admission gate).

### GET /api/v1/pool/case/{case_id}

- **Auth:** role-dependent (see route)
- **Özet:** Havuz case detay önizleme (customer PII-masked)
- **Responses:**
  - `200` — PoolCaseDetail Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/pool/feed

- **Auth:** role-dependent (see route)
- **Özet:** Havuz case feed (teknisyen, kind filter + cursor)
- **Query:** `cursor`, `limit`
- **Responses:**
  - `200` — PaginatedResponse_PoolCaseItem_ Successful Response
  - `422` — HTTPValidationError Validation Error

---

## reviews

Vaka bitişi sonrası puanlama (customer → technician V1).

### POST /api/v1/reviews

- **Auth:** role-dependent (see route)
- **Özet:** Vaka sonrası usta puanla (customer)
- **Request:** `ReviewCreate`
- **Responses:**
  - `201` — ReviewResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/reviews/me

- **Auth:** customer/technician
- **Özet:** Kendi review'lerim (customer: yazdıklarım / tech: aldıklarım)
- **Responses:**
  - `200` — list[ReviewResponse] Successful Response

### GET /api/v1/reviews/technician/{technician_id}

- **Auth:** role-dependent (see route)
- **Özet:** Teknisyen public review listesi (reviewer masked)
- **Query:** `cursor`, `limit`
- **Responses:**
  - `200` — PaginatedResponse_TechnicianReviewItem_ Successful Response
  - `422` — HTTPValidationError Validation Error

---

## taxonomy

Service domain + procedure + brand + city/district + drivetrain master data.

### GET /api/v1/taxonomy/brands

- **Auth:** role-dependent (see route)
- **Özet:** Get Brands
- **Responses:**
  - `200` — list[BrandOut] Successful Response

### GET /api/v1/taxonomy/districts

- **Auth:** role-dependent (see route)
- **Özet:** Get Districts
- **Query:** `city`
- **Responses:**
  - `200` — list[DistrictOut] Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/taxonomy/drivetrains

- **Auth:** role-dependent (see route)
- **Özet:** Get Drivetrains
- **Responses:**
  - `200` — list[DrivetrainOut] Successful Response

### GET /api/v1/taxonomy/procedures

- **Auth:** role-dependent (see route)
- **Özet:** Get Procedures
- **Query:** `domain`
- **Responses:**
  - `200` — list[ProcedureOut] Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/taxonomy/service-domains

- **Auth:** role-dependent (see route)
- **Özet:** Get Service Domains
- **Responses:**
  - `200` — list[ServiceDomainOut] Successful Response

---

## technicians-me

Teknisyen kendi profil + cert + capability + availability yönetimi.

### PATCH /api/v1/technicians/me/availability

- **Auth:** technician
- **Özet:** Patch Me Availability
- **Request:** `AvailabilityPatchPayload`
- **Responses:**
  - `200` — TechnicianProfileResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### PATCH /api/v1/technicians/me/business

- **Auth:** technician
- **Özet:** Patch Me Business
- **Request:** `BusinessPatchPayload`
- **Responses:**
  - `200` — TechnicianProfileResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### PATCH /api/v1/technicians/me/capabilities

- **Auth:** technician
- **Özet:** Patch Me Capabilities
- **Request:** `CapabilitiesPatchPayload`
- **Responses:**
  - `200` — TechnicianCapabilityResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### PATCH /api/v1/technicians/me/capacity

- **Auth:** technician
- **Özet:** Patch Me Capacity
- **Request:** `CapacityPayload`
- **Responses:**
  - `204` — object Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/technicians/me/certificates

- **Auth:** technician
- **Özet:** Get Me Certificates
- **Responses:**
  - `200` — list[TechnicianCertificateResponse] Successful Response

### POST /api/v1/technicians/me/certificates

- **Auth:** technician
- **Özet:** Yeni sertifika yükle
- **Request:** `CertSubmitPayload`
- **Responses:**
  - `201` — TechnicianCertificateResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### PATCH /api/v1/technicians/me/certificates/{cert_id}

- **Auth:** technician
- **Özet:** Rejected sertifika için resubmit
- **Request:** `CertResubmitPayload`
- **Responses:**
  - `200` — TechnicianCertificateResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### PUT /api/v1/technicians/me/coverage

- **Auth:** technician
- **Özet:** Coverage atomic replace (I-PR4-7)
- **Request:** `CoveragePayload`
- **Responses:**
  - `200` — CoverageSnapshotResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/technicians/me/profile

- **Auth:** technician
- **Özet:** Get Me Profile
- **Responses:**
  - `200` — TechnicianProfileResponse Successful Response

### PATCH /api/v1/technicians/me/profile

- **Auth:** technician
- **Özet:** Patch Me Profile
- **Request:** `ProfilePatchPayload`
- **Responses:**
  - `200` — TechnicianProfileResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### PATCH /api/v1/technicians/me/provider-mode

- **Auth:** technician
- **Özet:** provider_mode transition — büyük cascade
- **Request:** `ProviderModePayload`
- **Responses:**
  - `200` — ProviderModeTransitionResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### PUT /api/v1/technicians/me/schedule

- **Auth:** technician
- **Özet:** Put Me Schedule
- **Request:** `SchedulePayload`
- **Responses:**
  - `204` — object Successful Response
  - `422` — HTTPValidationError Validation Error

### PUT /api/v1/technicians/me/service-area

- **Auth:** technician
- **Özet:** Put Me Service Area
- **Request:** `ServiceAreaPayload`
- **Responses:**
  - `204` — object Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/technicians/me/shell-config

- **Auth:** technician
- **Özet:** Get Me Shell Config
- **Responses:**
  - `200` — ShellConfig Successful Response

### POST /api/v1/technicians/me/switch-active-role

- **Auth:** technician
- **Özet:** Multi-role kişi: active_provider_type değiştir
- **Request:** `SwitchActiveRolePayload`
- **Responses:**
  - `200` — TechnicianProfileResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/technicians/me/tow-equipment

- **Auth:** technician
- **Özet:** Teknisyenin çekici ekipman listesi
- **Responses:**
  - `200` — TowEquipmentResponse Successful Response

### PUT /api/v1/technicians/me/tow-equipment

- **Auth:** technician
- **Özet:** Çekici ekipmanları atomic replace (I-PR4-7 pattern)
- **Request:** `TowEquipmentPayload`
- **Responses:**
  - `200` — TowEquipmentResponse Successful Response
  - `422` — HTTPValidationError Validation Error

---

## technicians-public

Public keşif yüzeyi — PII masked (Çarşı ekranı).

### GET /api/v1/technicians/public/feed

- **Auth:** any auth
- **Özet:** Public teknisyen feed — admission quick-check filter + tier sort
- **Query:** `cursor`, `limit`
- **Responses:**
  - `200` — PaginatedResponse_TechnicianFeedItem_ Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/technicians/public/{technician_id}

- **Auth:** any auth
- **Özet:** Get Public Profile
- **Responses:**
  - `200` — TechnicianPublicView Successful Response
  - `422` — HTTPValidationError Validation Error

---

## tow

Çekici auto-dispatch + stage + OTP + evidence + fare.

### POST /api/v1/tow/bids

- **Auth:** role-dependent (see route)
- **Özet:** Scheduled tow bidding — teknisyen teklifi
- **Request:** `object`
- **Responses:**
  - `200` — object Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/tow/bids/{bid_id}/accept

- **Auth:** role-dependent (see route)
- **Özet:** Müşteri — locked_price bid kabul
- **Responses:**
  - `200` — object Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/tow/cases

- **Auth:** role-dependent (see route)
- **Özet:** Çekici talebi oluştur + (immediate) ilk aday atama
- **Request:** `TowCreateCaseRequest`
- **Responses:**
  - `201` — object Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/tow/cases/{case_id}

- **Auth:** role-dependent (see route)
- **Özet:** Vaka snapshot
- **Responses:**
  - `200` — TowCaseSnapshot Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/tow/cases/{case_id}/cancel

- **Auth:** role-dependent (see route)
- **Özet:** Vaka iptal (aşamaya göre fee)
- **Request:** `TowCancelInput`
- **Responses:**
  - `200` — object Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/tow/cases/{case_id}/dispatch/response

- **Auth:** role-dependent (see route)
- **Özet:** Teknisyen accept/decline attempt
- **Request:** `TowDispatchResponseInput`
- **Responses:**
  - `200` — TowDispatchResponseOutput Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/tow/cases/{case_id}/evidence

- **Auth:** role-dependent (see route)
- **Özet:** Kanıt kaydı (fotoğraf link)
- **Query:** `kind`, `media_asset_id`
- **Responses:**
  - `200` — object Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/tow/cases/{case_id}/kasko

- **Auth:** role-dependent (see route)
- **Özet:** Kasko beyan — müşteri tarafı
- **Request:** `TowKaskoDeclareInput`
- **Responses:**
  - `200` — object Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/tow/cases/{case_id}/location

- **Auth:** role-dependent (see route)
- **Özet:** GPS ping — 5s moving / 15s stationary
- **Request:** `TowLocationInput`
- **Responses:**
  - `204` — object Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/tow/cases/{case_id}/otp/issue

- **Auth:** role-dependent (see route)
- **Özet:** Arrival/delivery OTP ver (teknisyen tarafı)
- **Request:** `TowOtpIssueInput`
- **Responses:**
  - `200` — object Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/tow/cases/{case_id}/otp/verify

- **Auth:** role-dependent (see route)
- **Özet:** OTP doğrula
- **Request:** `TowOtpVerifyInput`
- **Responses:**
  - `200` — object Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/tow/cases/{case_id}/rating

- **Auth:** role-dependent (see route)
- **Özet:** Müşteri puanı + review
- **Request:** `TowRatingInput`
- **Responses:**
  - `200` — object Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/tow/cases/{case_id}/tracking

- **Auth:** role-dependent (see route)
- **Özet:** Tracking — WS fallback polling
- **Responses:**
  - `200` — TowTrackingSnapshot Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/tow/fare/quote

- **Auth:** role-dependent (see route)
- **Özet:** Fare quote — cap/locked price hesap
- **Request:** `TowFareQuoteRequest`
- **Responses:**
  - `200` — TowFareQuoteResponse Successful Response
  - `422` — HTTPValidationError Validation Error

---

## vehicles

Müşteri araç kaydı + owner link + history consent (audit P1-1).

### POST /api/v1/vehicles

- **Auth:** role-dependent (see route)
- **Özet:** Yeni araç + owner link (customer)
- **Request:** `VehicleCreate`
- **Responses:**
  - `201` — VehicleResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/vehicles/me

- **Auth:** customer/technician
- **Özet:** Kendi araçlarım (aktif link'ler)
- **Responses:**
  - `200` — list[VehicleResponse] Successful Response

### GET /api/v1/vehicles/{vehicle_id}

- **Auth:** role-dependent (see route)
- **Özet:** Araç detayı (owner ya da admin)
- **Responses:**
  - `200` — VehicleResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### PATCH /api/v1/vehicles/{vehicle_id}

- **Auth:** role-dependent (see route)
- **Özet:** Araç kısmi güncelleme (owner)
- **Request:** `VehicleUpdate`
- **Responses:**
  - `200` — VehicleResponse Successful Response
  - `422` — HTTPValidationError Validation Error

### DELETE /api/v1/vehicles/{vehicle_id}

- **Auth:** role-dependent (see route)
- **Özet:** Araç soft delete + aktif link'leri kapat (owner)
- **Responses:**
  - `204` — object Successful Response
  - `422` — HTTPValidationError Validation Error

### GET /api/v1/vehicles/{vehicle_id}/dossier

- **Auth:** role-dependent (see route)
- **Özet:** Araç geçmiş + lifecycle özet (consent gate'li)
- **Responses:**
  - `200` — VehicleDossierView Successful Response
  - `422` — HTTPValidationError Validation Error

### POST /api/v1/vehicles/{vehicle_id}/history-consent

- **Auth:** role-dependent (see route)
- **Özet:** Araç geçmişi izin aç/kapat (audit P1-1)
- **Request:** `HistoryConsentRequest`
- **Responses:**
  - `200` — VehicleResponse Successful Response
  - `422` — HTTPValidationError Validation Error

---

## webhooks

PSP webhook callback'leri (Iyzico 3DS + chargeback V2).

### POST /api/v1/webhooks/iyzico/chargeback

- **Auth:** PSP (HMAC)
- **Özet:** Chargeback webhook — V2 (I-BILL-14)
- **Responses:**
  - `501` — object Successful Response

### POST /api/v1/webhooks/iyzico/payment

- **Auth:** PSP (HMAC)
- **Özet:** Iyzico 3DS callback / payment status update (HMAC verify)
- **Responses:**
  - `200` — object Successful Response
  - `422` — HTTPValidationError Validation Error

---

## Şema referansı

OpenAPI JSON içindeki tüm response/request şemaları. Her
şemanın alan listesi için `docs/api/openapi.json` içindeki
`components.schemas.<SchemaName>` path'ine bak.

- `AccidentReportMethod`
- `AdminAuditItem`
- `AppointmentCounterPayload`
- `AppointmentReasonPayload`
- `AppointmentRequest`
- `AppointmentResponse`
- `AppointmentSlotKind`
- `AppointmentStatus`
- `ApprovalDecidePayload`
- `ApprovalLineItemInput`
- `ApprovalLineItemOut`
- `ApprovalRequestPayload`
- `ApprovalResponse`
- `AuthEventType`
- `AvailabilityPatchPayload`
- `BillingState`
- `BillingSummary`
- `BrandBindingPayload`
- `BrandOut`
- `BrandTier`
- `BreakdownCategory`
- `BusinessPatchPayload`
- `CapabilitiesPatchPayload`
- `CapacityPayload`
- `CaptureOverrideRequest`
- `CaseApprovalKind`
- `CaseApprovalStatus`
- `CaseAttachmentDraft`
- `CaseAttachmentKind`
- `CaseCreateResponse`
- `CaseKaskoState`
- `CaseOfferStatus`
- `CaseOverrideRequest`
- `CaseRefundReason`
- `CaseRefundState`
- `CaseSummaryResponse`
- `CertResubmitPayload`
- `CertSubmitPayload`
- `CertificatePendingItem`
- `CertificateRejectRequest`
- `CommissionSettlementOut`
- `CompleteUploadRequest`
- `CoveragePayload`
- `CoverageSnapshotResponse`
- `DamageSeverity`
- `DistrictOut`
- `DrivetrainOut`
- `HTTPValidationError`
- `HistoryConsentRequest`
- `HomeLayout`
- `InsuranceClaimAcceptRequest`
- `InsuranceClaimPayOutRequest`
- `InsuranceClaimRejectRequest`
- `InsuranceClaimResponse`
- `InsuranceClaimStatus`
- `InsuranceClaimSubmit`
- `InsuranceCoverageKind`
- `KaskoReimburseRequest`
- `KaskoSummary`
- `LatLng-Output`
- `LocationSummary`
- `LogoutResponse`
- `MaintenanceCategory`
- `MarkPayoutCompletedItem`
- `MarkPayoutCompletedRequest`
- `MediaAssetEnvelope`
- `MediaAssetResponse`
- `MediaPurpose`
- `MediaStatus`
- `MediaVisibility`
- `OfferCustomerRejectPayload`
- `OfferResponse`
- `OfferShortlistPayload`
- `OfferSubmitPayload`
- `OfferWithdrawPayload`
- `OtpRequest`
- `OtpRequestResponse`
- `OtpVerify`
- `OwnerKind`
- `PaginatedResponse_AdminAuditItem_`
- `PaginatedResponse_CertificatePendingItem_`
- `PaginatedResponse_CommissionSettlementOut_`
- `PaginatedResponse_InsuranceClaimResponse_`
- `PaginatedResponse_OfferResponse_`
- `PaginatedResponse_PoolCaseItem_`
- `PaginatedResponse_TechnicianFeedItem_`
- `PaginatedResponse_TechnicianPendingItem_`
- `PaginatedResponse_TechnicianReviewItem_`
- `PaymentInitiateRequest`
- `PaymentInitiateResponse`
- `PoolCaseDetail`
- `PoolCaseItem`
- `PricePreference`
- `ProcedureBindingPayload`
- `ProcedureOut`
- `ProfilePatchPayload`
- `ProviderMode`
- `ProviderModePayload`
- `ProviderModeTransitionResponse`
- `ProviderType`
- `QuickAction`
- `RefreshRequest`
- `RefundOut`
- `RefundRequest`
- `ReviewCreate`
- `ReviewResponse`
- `SchedulePayload`
- `ScheduleSlotPayload`
- `ServiceAreaPayload`
- `ServiceCaseStatus`
- `ServiceDomainOut`
- `ServicePickupPreference`
- `ServiceRequestDraftCreate`
- `ServiceRequestKind`
- `ServiceRequestUrgency`
- `ShellConfig`
- `SwitchActiveRolePayload`
- `TechnicianApproveRequest`
- `TechnicianAvailability`
- `TechnicianCapabilityResponse`
- `TechnicianCertificateKind`
- `TechnicianCertificateResponse`
- `TechnicianCertificateStatus`
- `TechnicianFeedItem`
- `TechnicianPayoutItem`
- `TechnicianPendingItem`
- `TechnicianProfileResponse`
- `TechnicianPublicView`
- `TechnicianRejectRequest`
- `TechnicianReviewItem`
- `TechnicianSuspendRequest`
- `TechnicianVerifiedLevel`
- `TokenPair`
- `TowCancelInput`
- `TowCaseSnapshot`
- `TowCreateCaseRequest`
- `TowDispatchResponseInput`
- `TowDispatchResponseOutput`
- `TowDispatchResponseSchema`
- `TowDispatchStageSchema`
- `TowEquipment`
- `TowEquipmentPayload`
- `TowEquipmentResponse`
- `TowEquipmentSchema`
- `TowFareQuote-Input`
- `TowFareQuote-Output`
- `TowFareQuoteRequest`
- `TowFareQuoteResponse`
- `TowIncidentReasonSchema`
- `TowKaskoDeclaration`
- `TowKaskoDeclareInput`
- `TowLocationInput`
- `TowModeSchema`
- `TowOtpIssueInput`
- `TowOtpVerifyInput`
- `TowRatingInput`
- `TowSettlementStatusSchema`
- `TowTrackingSnapshot`
- `UploadIntentRequest`
- `UploadIntentResponse`
- `UserAdminView`
- `UserApprovalStatus`
- `UserStatus`
- `UserSuspendRequest`
- `ValidationError`
- `VehicleCreate`
- `VehicleDossierView`
- `VehicleFuelType`
- `VehicleResponse`
- `VehicleUpdate`
- `app__schemas__service_request__LatLng`
- `app__schemas__tow__LatLng`

