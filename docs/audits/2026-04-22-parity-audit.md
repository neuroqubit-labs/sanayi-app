# FE ↔ BE Parity Audit — 2026-04-22

**Kapsam:** Naro customer + service mobil uygulamalarında Zod schema'ları ile
naro-backend Pydantic schema'ları arasındaki drift tespiti. Bugün 4 canlı bug
(fuel_type enum, history-consent path, ProviderType enum, /vehicles/me 500)
sistemik bir parity gapi olduğunu gösterdi; pilot-öncesi audit.

**Yazar:** FE dev (Claude Opus 4.7). 5 paralel Explore agent ile endpoint-endpoint
tarandı, tablo aşağıda.

**Durum sembolleri:**
- ✅ OK — birebir uyumlu veya bugün fix'lendi
- ⚠️ drift — minör fark (optional field, eksik FE client, label ya da nested shape farkı)
- ❌ broken — runtime'da fail eder (P0 launch-blocker)

**Bugün kapatılan hotfix'ler** (brief-öncesi acil fix):
- `d856f4b` — VehicleFuelType enum BE canonical (`gasoline` → `petrol`, `cng` kaldırıldı)
- `fb5e1c8` — `/vehicles/{id}/history-consent` path dash (FE underscore yazmıştı → 404)
- `8dbff73` — `ProviderType` enum BE canonical (13 İngilizce → 6 Türkçe)

---

## 1. Auth + Media

| Endpoint | Method | FE kaynak | BE kaynak | Durum | Drift notu | Fix owner |
|---|---|---|---|---|---|---|
| `/auth/otp/request` | POST | `packages/domain/src/auth.ts:OtpRequestSchema` | `app/schemas/auth.py:OtpRequest` | ✅ | — | — |
| `/auth/otp/verify` | POST | `packages/domain/src/auth.ts:OtpVerifySchema` | `app/schemas/auth.py:OtpVerify` | ✅ | — | — |
| `/auth/refresh` | POST | `naro-app/src/runtime.ts` (inline) | `app/schemas/auth.py:RefreshRequest` | ✅ | — | — |
| `/auth/logout` | POST | — | `app/schemas/auth.py:LogoutResponse` | ⚠️ | FE client yok; BE `{revoked: int}` döner | FE (opsiyonel) |
| `/auth/logout_all` | POST | — | `app/schemas/auth.py:LogoutResponse` | ⚠️ | FE client yok | FE (opsiyonel) |
| `/media/uploads/intents` | POST | `packages/mobile-core/src/media.ts:createUploadIntent` | `app/schemas/media.py:UploadIntentRequest` | ⚠️ | BE Faz 11 `owner_kind` + `owner_id` polymorphic; FE wrapper sadece `owner_ref` gönderiyor | BE + PO karar |
| `/media/uploads/{id}/complete` | POST | `packages/mobile-core/src/media.ts:completeUpload` | `app/schemas/media.py:CompleteUploadRequest` | ✅ | — | — |
| `/media/assets/{id}` | GET | `packages/mobile-core/src/media.ts:getAsset` | `app/schemas/media.py:MediaAssetResponse` | ⚠️ | BE `antivirus_verdict: str \| None` alanı FE schema'da yok | FE |
| `/media/assets/{id}` | DELETE | `packages/mobile-core/src/media.ts:deleteAsset` | `app/api/v1/routes/media.py` | ✅ | — | — |

---

## 2. Vehicles + Taxonomy

| Endpoint | Method | FE kaynak | BE kaynak | Durum | Drift notu | Fix owner |
|---|---|---|---|---|---|---|
| `/vehicles` | POST | `naro-app/src/features/vehicles/schema.ts:VehicleCreatePayloadSchema` | `app/schemas/vehicle.py:VehicleCreate` | ✅ | fuel_type canonical (bugün fix d856f4b) | — |
| `/vehicles/me` | GET | `naro-app/src/features/vehicles/api.ts:fetchMyVehicles` | `app/api/v1/routes/vehicles.py:list_my_vehicles` | ❌ | **Şu an 500 Internal Server Error** — BE tarafında response serialize veya DB state hatası, stack trace BE sohbetine yollandı | BE |
| `/vehicles/{id}` | GET | `naro-app/src/features/vehicles/api.ts:fetchVehicle` | `app/api/v1/routes/vehicles.py:get_vehicle_endpoint` | ✅ | — | — |
| `/vehicles/{id}/dossier` | GET | `naro-app/src/features/vehicles/api.ts:fetchVehicleDossier` | `app/api/v1/routes/vehicles.py:get_vehicle_dossier` | ✅ | — | — |
| `/vehicles/{id}` | PATCH | `naro-app/src/features/vehicles/schema.ts:VehicleUpdatePayloadSchema` | `app/schemas/vehicle.py:VehicleUpdate` | ✅ | — | — |
| `/vehicles/{id}` | DELETE | `naro-app/src/features/vehicles/api.ts:useDeleteVehicleMutation` | `app/api/v1/routes/vehicles.py:delete_vehicle_endpoint` | ✅ | — | — |
| `/vehicles/{id}/history-consent` | POST | `naro-app/src/features/vehicles/schema.ts:HistoryConsentPayloadSchema` | `app/schemas/vehicle.py:HistoryConsentRequest` | ✅ | path dash canonical (bugün fix fb5e1c8) | — |
| **`UserVehicleRole` enum** | — | `naro-app/src/features/vehicles/schema.ts` (`owner/driver/partner/observer`) | `app/models/vehicle.py` (`OWNER/DRIVER/FAMILY`) | ❌ | **ENUM UYUMSUZ**: BE 3 değer, FE 4 değer + farklı set. UserVehicleLink response FE parse başarısız olur `family` değeriyle | BE veya FE (PO karar) |
| `/taxonomy/service-domains` | GET | `naro-app/src/features/ustalar/api.ts:useServiceDomainsQuery` | `app/api/v1/routes/taxonomy.py:get_service_domains` | ✅ | — | — |
| `/taxonomy/brands` | GET | `naro-app/src/features/ustalar/api.ts:useBrandsQuery` | `app/api/v1/routes/taxonomy.py:get_brands` | ✅ | — | — |
| `/taxonomy/procedures` | GET | FE client yok | `app/api/v1/routes/taxonomy.py:get_procedures` | ⚠️ | BE hazır, FE consumer yok | FE (composer V2 ihtiyacı) |
| `/taxonomy/districts` | GET | FE client yok | `app/api/v1/routes/taxonomy.py:get_districts` | ⚠️ | BE hazır, FE consumer yok | FE (service-area picker kullanmalı) |
| `/taxonomy/drivetrains` | GET | FE client yok | `app/api/v1/routes/taxonomy.py:get_drivetrains` | ⚠️ | BE hazır, FE consumer yok | FE (vehicle wizard V1.1) |

---

## 3. Cases + Offers + Appointments

| Endpoint | Method | FE kaynak | BE kaynak | Durum | Drift notu | Fix owner |
|---|---|---|---|---|---|---|
| `/cases` | POST | `naro-app/src/features/cases/schemas/case-create.ts:ServiceRequestDraftCreateSchema` | `app/schemas/service_request.py:ServiceRequestDraftCreate` | ✅ | 32 alan birebir | — |
| `/cases/me` | GET | `naro-app/src/features/cases/api.ts:useMyCasesLive` | `app/api/v1/routes/cases.py:list_my_cases` | ✅ | CaseSummaryResponse birebir | — |
| `/cases/{id}` | GET | `naro-app/src/features/cases/api.ts:useCaseSummaryLive` | `app/api/v1/routes/cases.py:get_case_endpoint` | ✅ | — | — |
| `/cases/{id}/cancel` | POST | `naro-app/src/features/cases/api.ts:useCancelCaseLive` | `app/api/v1/routes/cases.py:cancel_case_endpoint` | ✅ | — | — |
| `/offers` | POST | FE client yok | `app/api/v1/routes/offers.py:submit_offer_endpoint` | ⚠️ | BE hazır, FE consumer yok (service app teklif UI'ı) | FE |
| `/offers/case/{id}` | GET | FE client yok | `app/api/v1/routes/offers.py:list_offers_for_case` | ⚠️ | BE hazır, customer UI mock'a bakıyor | FE |
| `/offers/me` | GET | FE client yok | `app/api/v1/routes/offers.py:list_my_offers` | ⚠️ | BE cursor-paginated, FE yok | FE |
| `/offers/{id}/accept` | POST | FE client yok | `app/api/v1/routes/offers.py:accept_offer` | ⚠️ | BE atomic, FE mock `selectOffer` kullanıyor | FE |
| `/offers/{id}/withdraw` | POST | FE client yok | `app/api/v1/routes/offers.py:withdraw_offer` | ⚠️ | — | FE |
| `/offers/{id}/shortlist` | POST | FE client yok | **BE'de yok** | ❌ | Scope'ta var ama BE implementasyonu eksik | BE |
| `/offers/{id}/reject` | POST | FE client yok | **BE'de yok** | ❌ | Scope'ta var ama BE implementasyonu eksik | BE |
| `/appointments` | POST | FE client yok | `app/api/v1/routes/appointments.py:create_direct_request` | ⚠️ | BE AppointmentRequest hazır, FE mock `requestAppointment` | FE |
| `/appointments/case/{id}` | GET | FE client yok | `app/api/v1/routes/appointments.py:list_appointments_for_case` | ⚠️ | — | FE |
| `/appointments/{id}/approve` | POST | FE client yok | `app/api/v1/routes/appointments.py:approve` | ⚠️ | — | FE |
| `/appointments/{id}/decline` | POST | FE client yok | `app/api/v1/routes/appointments.py:decline` | ⚠️ | payload: `{reason: str(min=1, max=500)}` | FE |
| `/appointments/{id}/cancel` | POST | FE client yok | `app/api/v1/routes/appointments.py:cancel` | ⚠️ | — | FE |
| `/appointments/{id}/counter-propose` | POST | FE client yok | `app/api/v1/routes/appointments.py:counter_propose` | ⚠️ | — | FE |
| `/appointments/{id}/confirm-counter` | POST | FE client yok | `app/api/v1/routes/appointments.py:confirm_counter` | ⚠️ | — | FE |
| `/appointments/{id}/decline-counter` | POST | FE client yok | `app/api/v1/routes/appointments.py:decline_counter` | ⚠️ | — | FE |
| **`CaseOfferStatus` enum** | — | `packages/domain/src/service-case.ts` (5 değer) | BE model (6 değer, `WITHDRAWN` ek) | ⚠️ | FE domain'de `withdrawn` eksik | FE |
| **`AppointmentStatus` enum** | — | `packages/domain/src/service-case.ts` (5 değer) | BE model (6 değer, `COUNTER_PENDING` ek) | ⚠️ | FE domain'de `counter_pending` eksik | FE |
| **`ServiceCaseStatus` enum** | — | 3 yerde (BE model, FE domain, FE cases/schemas) | 10 değer her yerde | ✅ | Birebir — matching/offers_ready/appointment_pending/scheduled/service_in_progress/parts_approval/invoice_approval/completed/cancelled/archived | — |
| **`ServiceRequestKind` enum** | — | — | accident/breakdown/maintenance/towing | ✅ | Birebir | — |

---

## 4. Technicians (me + public)

| Endpoint | Method | FE kaynak | BE kaynak | Durum | Drift notu | Fix owner |
|---|---|---|---|---|---|---|
| `/technicians/me/profile` | GET | FE wire-up partial | `app/schemas/technician.py:TechnicianProfileResponse` | ⚠️ | FE naro-service-app'te response parse şeması tam yok; Zustand store'a patch'liyor | FE |
| `/technicians/me/profile` | PATCH | FE client yok | `ProfilePatchPayload` | ⚠️ | self-signup için lazım | FE |
| `/technicians/me/business` | PATCH | FE client yok | `BusinessPatchPayload` | ⚠️ | — | FE |
| `/technicians/me/availability` | PATCH | FE client yok | `AvailabilityPatchPayload` | ⚠️ | — | FE |
| `/technicians/me/capabilities` | PATCH | FE client yok | `CapabilitiesPatchPayload` | ⚠️ | — | FE |
| `/technicians/me/certificates` | GET | FE client yok | `TechnicianCertificateResponse` | ⚠️ | — | FE |
| `/technicians/me/certificates` | POST | FE client yok | `CertSubmitPayload` | ⚠️ | cert upload media pipeline ile bağlanmalı | FE |
| `/technicians/me/certificates/{id}` | PATCH | FE client yok | `CertResubmitPayload` | ⚠️ | — | FE |
| `/technicians/me/shell-config` | GET | `naro-service-app/app/(auth)/verify.tsx` (inline parse) | `app/schemas/shell_config.py:ShellConfig` | ✅ | enum'lar canonical match | — |
| `/technicians/me/coverage` | PUT | `naro-service-app/src/features/onboarding/api/coverage.ts` | `CoveragePayload` | ✅ | — | — |
| `/technicians/me/service-area` | PUT | FE client yok | `ServiceAreaPayload` | ⚠️ | 204 No Content | FE |
| `/technicians/me/schedule` | PUT | FE client yok | `SchedulePayload` | ⚠️ | — | FE |
| `/technicians/me/capacity` | PATCH | FE client yok | `CapacityPayload` | ⚠️ | — | FE |
| `/technicians/me/provider-mode` | PATCH | FE client yok | `ProviderModePayload` | ⚠️ | — | FE |
| `/technicians/me/switch-active-role` | POST | FE client yok | `SwitchActiveRolePayload` | ⚠️ | — | FE |
| `/technicians/me/payouts` | GET | `naro-service-app/src/features/revenue/api.ts:useMyPayoutsQuery` | `app/schemas/billing.py:TechnicianPayoutItem` | ✅ | Decimal → float (Zod number); birebir | — |
| `/technicians/public/feed` | GET | `naro-app/src/features/ustalar/schemas.ts:TechnicianFeedItemSchema` | `app/schemas/technician_public.py` | ✅ | ProviderType canonical (bugün fix 8dbff73) | — |
| `/technicians/public/{id}` | GET | `naro-app/src/features/ustalar/schemas.ts:TechnicianPublicViewSchema` | `app/schemas/technician_public.py` | ✅ | PII mask (I-9) whitelist enforced | — |

---

## 5. Insurance Claims + Billing

| Endpoint | Method | FE kaynak | BE kaynak | Durum | Drift notu | Fix owner |
|---|---|---|---|---|---|---|
| `/insurance-claims` | POST | `naro-app/src/features/insurance-claim/*` | `app/schemas/insurance_claim.py:InsuranceClaimSubmit` | ✅ | Decimal alanlar match | — |
| `/insurance-claims/case/{id}` | GET | FE client yok | `InsuranceClaimResponse` | ⚠️ | BE hazır, FE read-only client yok | FE |
| `/insurance-claims/{id}` | GET | FE client yok | `InsuranceClaimResponse` | ⚠️ | — | FE |
| `/admin/insurance-claims/{id}/accept` | PATCH | (admin, V2) | `InsuranceClaimAcceptRequest` | ⚠️ | Admin UI pilot-sonrası | PO (V2) |
| `/admin/insurance-claims/{id}/reject` | PATCH | (admin, V2) | `InsuranceClaimRejectRequest` | ⚠️ | — | PO (V2) |
| `/admin/insurance-claims/{id}/mark-paid` | PATCH | (admin, V2) | `InsuranceClaimPayOutRequest` | ⚠️ | — | PO (V2) |
| `/cases/{id}/payment/initiate` | POST | `naro-app/src/features/billing/schemas.ts:PaymentInitiateResponseSchema` | `app/schemas/billing.py:PaymentInitiateResponse` | ❌ | **CRITICAL**: BE `{checkout_url, idempotency_key, preauth_amount, case_id}` flat — FE `{case_id, payment: {required, status, redirect_url, payment_id}}` nested. Uyumsuz. | PO karar (BE yeniden şekillendirecek veya FE transform) |
| `/cases/{id}/billing/summary` | GET | `naro-app/src/features/billing/schemas.ts:BillingSummarySchema` | `app/schemas/billing.py:BillingSummary` | ❌ | **Field drift**: FE `preauth_total/captured_amount/refunded_amount`, BE `preauth_amount/final_amount`; FE `payment_status` (11 değer enum), BE `billing_state` (15 değer state machine). Refund list FE inline, BE nested. | FE (BE canonical) |
| `/cases/{id}/cancel-billing` | POST | `naro-app/src/features/billing/api.ts:useSubmitCancellation` | BE route handler | ⚠️ | FE body `{reason, comment?}` gönderiyor; BE endpoint body'yi şu an ignore ediyor (V1 fee=0 hardcoded) | BE (reason store et, fee compute) |
| `/technicians/me/payouts` | GET | `naro-service-app/src/features/revenue/api.ts` | `TechnicianPayoutItem` | ✅ | Birebir | — |
| `/admin/billing/pending-payouts` | GET | FE client yok | `CommissionSettlementOut` | ⚠️ | Admin UI V2 | PO |
| `/admin/billing/payouts/mark-completed` | POST | FE client yok | `MarkPayoutCompletedRequest` | ⚠️ | Admin UI V2 | PO |
| `/admin/billing/kasko-pending` | GET | FE client yok | `KaskoSummary` | ⚠️ | PO bayrak B-5 alanlar uyumlu: `kasko_state`, `kasko_reimbursement_amount`, `kasko_submitted_at`, `kasko_reimbursed_at` | PO (admin UI) |
| `/admin/cases/{id}/kasko-reimburse` | POST | FE client yok | `KaskoReimburseRequest` | ⚠️ | Admin V2 | PO |
| `/admin/cases/{id}/refund` | POST | FE client yok | `RefundRequest` | ⚠️ | `CaseRefundReason` enum match: `cancellation/dispute/excess_preauth/kasko_reimbursement/admin_override` | PO |
| `/admin/cases/{id}/capture-override` | POST | FE client yok | `CaptureOverrideRequest` | ⚠️ | — | PO |
| `/admin/billing/commission-report` | GET | FE client yok | route handler | ⚠️ | Decimal → string dict | PO |
| `/admin/billing/settlements` | GET | FE client yok | `CommissionSettlementOut` | ⚠️ | cursor paginated | PO |
| **`BillingState` enum** | — | FE `PaymentStatusSchema` (11 değer) | BE StrEnum (15 değer) | ⚠️ | FE eksik: `PREAUTH_FAILED`, `ADDITIONAL_HOLD_REQUESTED`, `ADDITIONAL_HELD`, `KASKO_REJECTED` | FE |
| **`CaseRefundReason`** | — | FE schema | BE StrEnum | ✅ | — | — |
| **`CaseKaskoState`** | — | FE `BillingSummarySchema.kasko_state` | BE | ✅ | — | — |
| **`CaseApprovalKind`** | — | FE `CaseApprovalKindSchema` | BE | ✅ | — | — |

---

## P0 launch-blocker (hemen fix, pilot öncesi)

1. **`/vehicles/me` 500** — BE sohbetinde hotfix (stack trace gerekli)
2. **`PaymentInitiateResponse` shape mismatch** — PO karar: BE nested `payment` object'a dönsün mi yoksa FE flat shape'e mi adapt olsun (→ b2.1 PaymentInitiateScreen + 3DS WebView flow bu shape'e bağlı)
3. **`BillingSummary` field drift** — FE schema'yı BE canonical'e hizala (`preauth_total` → `preauth_amount`, `payment_status` → `billing_state` enum genişletme)
4. **`UserVehicleRole` enum drift** — PO karar (3-değer BE vs 4-değer FE). Launch için vehicle ownership transfer flow'u çalışmayabilir.

## P1 launch-sırasında açık ama pilot scope dışı

5. `CaseOfferStatus.WITHDRAWN`, `AppointmentStatus.COUNTER_PENDING` — FE domain enum genişletmesi (müşteri mock flow'u etkilenmiyor, FE live wire-up yapılınca gerekli)
6. `/cases/{id}/cancel-billing` BE body ignore — V1 %0 fee hardcoded; reason store etmiyor (pilot'ta reason log değerli)
7. `media/uploads/intents` polymorphic owner — BE Faz 11 opsiyonel; FE `owner_ref` hâlâ geçerli, breaking değil

## P2 sonraki sprint (V1.1+)

8. Offers + Appointments FE wire-up (BE hazır, FE hala mock)
9. Insurance Claims FE read-only client
10. Admin billing UI (pilot-sonrası)
11. Auth `/logout`, `/logout_all` FE (current session clear yeterli)
12. Media `antivirus_verdict` FE schema alanı
13. `offers/{id}/shortlist`, `offers/{id}/reject` BE'de eksik — BE sohbetine brief
14. `TechnicianProfileResponse` FE parse schema
15. `/taxonomy/procedures`, `/districts`, `/drivetrains` FE consumer'ları

## Kapalı (bugün fix'lendi)

- `VehicleFuelType` gasoline→petrol (`d856f4b`)
- `/vehicles/{id}/history-consent` path dash (`fb5e1c8`)
- `ProviderType` BE canonical (`8dbff73`)

---

## Kök neden + Aşama 2 önerisi

**Kök neden:** FE Zod schema'ları `packages/domain` + `packages/mobile-core` + `naro-app/features/*` + `naro-service-app/features/*` arasında dağınık manuel yazılmış; BE Pydantic'le contract-test yok; enum + path isimlendirme convention'ı yok.

**Aşama 2 (pilot-sonrası V1.1, PO kararı):**
- **A (tercih):** `openapi-zod-client` BE `openapi.json`'dan FE Zod schema'larını regen + CI check. BE schema change → FE otomatik. Kurulum ~2-3 gün.
- B (alternatif): Manuel + pytest contract-test (endpoint response fixture Zod parse). ~1 gün.

Öneri: A. Pilot-sonrası backlog; V1.1'de kurulur.
