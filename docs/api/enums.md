# Naro Backend — Enum Katalogu

Her enum exact string değerler ve **tanım sırası**. FE select/
dropdown bileşenleri bu sırayı kullanır — sıra değişmez (yeni değer
sonuna eklenir, mevcut değerler yerinde kalır).

> Bu dokümana `scripts/render_enums_catalog.py` ile `app/models/*.py`
> içindeki `StrEnum` subclass'larından üretilir. Manuel düzenleme
> YAPMA; model değişince script'i yeniden çalıştır.

**Toplam:** 66 enum, 15 kategori.

## İçindekiler

- [User + Auth](#user-+-auth) (6)
- [Vehicle](#vehicle) (2)
- [Case — Request + Kind](#case--request-+-kind) (9)
- [Case — Event + Audit](#case--event-+-audit) (3)
- [Case — Process (approval/task/milestone)](#case--process-approval-task-milestone) (8)
- [Case — Artifact](#case--artifact) (1)
- [Case — Communication](#case--communication) (1)
- [Technician](#technician) (8)
- [Tow (çekici)](#tow-çekici) (9)
- [Billing](#billing) (6)
- [Offer](#offer) (2)
- [Appointment](#appointment) (3)
- [Insurance claim](#insurance-claim) (2)
- [Media](#media) (5)
- [Taxonomy](#taxonomy) (1)

---

## User + Auth

### AuthEventType

Enum where members are also (and must be) strings

```
otp_requested
otp_verified
otp_failed
login_success
login_failed
refresh_rotated
refresh_reused_attack
logout
logout_all
oauth_authorize
oauth_callback_success
oauth_callback_failed
identity_linked
identity_unlinked
session_revoked
session_revoked_all
lockout_triggered
lockout_cleared
rate_limit_breach
suspicious_login
account_soft_deleted
fraud_suspected
payment_method_added
technician_profile_updated
technician_coverage_replaced
technician_provider_mode_switched
technician_active_role_switched
technician_cert_submitted
technician_admission_recomputed
vehicle_consent_granted
vehicle_consent_revoked
admin_technician_approved
admin_technician_rejected
admin_technician_suspended
admin_cert_approved
admin_cert_rejected
admin_insurance_claim_accepted
admin_insurance_claim_rejected
admin_insurance_claim_paid
admin_case_override
admin_user_suspended
admin_user_unsuspended
admin_billing_capture_override
admin_billing_refund
admin_billing_kasko_reimburse
admin_billing_payout_completed
```

**Kaynak:** `app/models/auth_event.py`

### AuthIdentityProvider

Enum where members are also (and must be) strings

```
otp_phone
otp_email
oauth_google
oauth_apple
```

**Kaynak:** `app/models/auth_identity.py`

### OtpChannel

Enum where members are also (and must be) strings

```
sms
console
whatsapp
```

**Kaynak:** `app/models/auth.py`

### UserApprovalStatus

Technician-specific admin approval state (KYC).

```
pending
active
suspended
rejected
```

**Kaynak:** `app/models/user.py`

### UserRole

Enum where members are also (and must be) strings

```
customer
technician
admin
```

**Kaynak:** `app/models/user.py`

### UserStatus

Enum where members are also (and must be) strings

```
pending
active
suspended
```

**Kaynak:** `app/models/user.py`

---

## Vehicle

### UserVehicleRole

App-level; DB'de CHECK constraint ile enforce.

```
owner
driver
family
```

**Kaynak:** `app/models/vehicle.py`

### VehicleFuelType

Enum where members are also (and must be) strings

```
petrol
diesel
lpg
electric
hybrid
other
```

**Kaynak:** `app/models/vehicle.py`

---

## Case — Request + Kind

### CaseOrigin

Enum where members are also (and must be) strings

```
customer
technician
```

**Kaynak:** `app/models/case.py`

### CaseWaitActor

Enum where members are also (and must be) strings

```
customer
technician
system
none
```

**Kaynak:** `app/models/case.py`

### ServiceCaseStatus

Enum where members are also (and must be) strings

```
matching
offers_ready
appointment_pending
scheduled
service_in_progress
parts_approval
invoice_approval
completed
archived
cancelled
```

**Kaynak:** `app/models/case.py`

### ServiceRequestKind

Enum where members are also (and must be) strings

```
accident
towing
breakdown
maintenance
```

**Kaynak:** `app/models/case.py`

### ServiceRequestUrgency

Enum where members are also (and must be) strings

```
planned
today
urgent
```

**Kaynak:** `app/models/case.py`

### TowDispatchStage

Enum where members are also (and must be) strings

```
searching
accepted
en_route
nearby
arrived
loading
in_transit
delivered
cancelled
timeout_converted_to_pool
scheduled_waiting
bidding_open
offer_accepted
preauth_failed
preauth_stale
```

**Kaynak:** `app/models/case.py`

### TowEquipment

Enum where members are also (and must be) strings

```
flatbed
hook
wheel_lift
heavy_duty
motorcycle
```

**Kaynak:** `app/models/case.py`

### TowIncidentReason

Enum where members are also (and must be) strings

```
not_running
accident
flat_tire
battery
fuel
locked_keys
stuck
other
```

**Kaynak:** `app/models/case.py`

### TowMode

Enum where members are also (and must be) strings

```
immediate
scheduled
```

**Kaynak:** `app/models/case.py`

---

## Case — Event + Audit

### CaseEventType

Enum where members are also (and must be) strings

```
submitted
offer_received
offer_accepted
offer_rejected
offer_withdrawn
appointment_requested
appointment_approved
appointment_declined
appointment_cancelled
appointment_expired
appointment_counter
technician_selected
technician_unassigned
status_update
parts_requested
parts_approved
parts_rejected
invoice_shared
invoice_approved
evidence_added
document_added
message
wait_state_changed
completed
cancelled
archived
soft_deleted
insurance_claim_submitted
insurance_claim_accepted
insurance_claim_paid
insurance_claim_rejected
tow_stage_requested
tow_stage_committed
tow_evidence_added
tow_location_recorded
tow_fare_captured
tow_dispatch_candidate_selected
payment_initiated
payment_authorized
payment_captured
payment_refunded
commission_calculated
payout_scheduled
payout_completed
billing_state_changed
invoice_issued
```

**Kaynak:** `app/models/case_audit.py`

### CaseNotificationIntentType

Enum where members are also (and must be) strings

```
customer_approval_needed
quote_ready
appointment_confirmation
evidence_missing
status_update_required
delivery_ready
payment_review
```

**Kaynak:** `app/models/case_audit.py`

### CaseTone

Enum where members are also (and must be) strings

```
accent
neutral
success
warning
critical
info
```

**Kaynak:** `app/models/case_audit.py`

---

## Case — Process (approval/task/milestone)

### CaseActor

Enum where members are also (and must be) strings

```
customer
technician
system
```

**Kaynak:** `app/models/case_process.py`

### CaseApprovalKind

Enum where members are also (and must be) strings

```
parts_request
invoice
completion
```

**Kaynak:** `app/models/case_process.py`

### CaseApprovalStatus

Enum where members are also (and must be) strings

```
pending
approved
rejected
```

**Kaynak:** `app/models/case_process.py`

### CaseMilestoneStatus

Enum where members are also (and must be) strings

```
completed
active
upcoming
blocked
```

**Kaynak:** `app/models/case_process.py`

### CaseTaskKind

Enum where members are also (and must be) strings

```
refresh_matching
review_offers
confirm_appointment
review_progress
approve_parts
approve_invoice
confirm_completion
message_service
upload_intake_proof
upload_progress_proof
share_status_update
request_parts_approval
share_invoice
upload_delivery_proof
mark_ready_for_delivery
start_similar_request
open_documents
```

**Kaynak:** `app/models/case_process.py`

### CaseTaskStatus

Enum where members are also (and must be) strings

```
pending
active
completed
blocked
```

**Kaynak:** `app/models/case_process.py`

### CaseTaskUrgency

Enum where members are also (and must be) strings

```
background
soon
now
```

**Kaynak:** `app/models/case_process.py`

### CaseWorkflowBlueprint

App-level; service_cases.workflow_blueprint string olarak tutulur.

```
damage_insured
damage_uninsured
maintenance_standard
maintenance_major
breakdown_standard
towing_immediate
towing_scheduled
```

**Kaynak:** `app/models/case_process.py`

---

## Case — Artifact

### CaseAttachmentKind

Enum where members are also (and must be) strings

```
photo
video
audio
invoice
report
document
location
```

**Kaynak:** `app/models/case_artifact.py`

---

## Case — Communication

### CaseMessageAuthorRole

Enum where members are also (and must be) strings

```
customer
technician
system
```

**Kaynak:** `app/models/case_communication.py`

---

## Technician

### GalleryItemKind

Enum where members are also (and must be) strings

```
photo
video
```

**Kaynak:** `app/models/technician.py`

### ProviderMode

KYC + cert matrix dimension — 'side_gig' V2 scope.

```
business
individual
```

**Kaynak:** `app/models/technician.py`

### ProviderType

Enum where members are also (and must be) strings

```
usta
cekici
oto_aksesuar
kaporta_boya
lastik
oto_elektrik
```

**Kaynak:** `app/models/technician.py`

### TechnicianAvailability

Enum where members are also (and must be) strings

```
available
busy
offline
```

**Kaynak:** `app/models/technician.py`

### TechnicianCertificateKind

Enum where members are also (and must be) strings

```
identity
tax_registration
trade_registry
insurance
technical
vehicle_license
tow_operator
```

**Kaynak:** `app/models/technician.py`

### TechnicianCertificateStatus

Enum where members are also (and must be) strings

```
pending
approved
rejected
expired
```

**Kaynak:** `app/models/technician.py`

### TechnicianSpecialtyKind

Uygulama tarafında; DB'de CHECK constraint ile enforce edilir.

```
specialty
expertise
```

**Kaynak:** `app/models/technician.py`

### TechnicianVerifiedLevel

Enum where members are also (and must be) strings

```
basic
verified
premium
```

**Kaynak:** `app/models/technician.py`

---

## Tow (çekici)

### TowCancellationActor

Enum where members are also (and must be) strings

```
customer
technician
system
admin
```

**Kaynak:** `app/models/tow.py`

### TowDispatchResponse

Enum where members are also (and must be) strings

```
pending
accepted
declined
timeout
```

**Kaynak:** `app/models/tow.py`

### TowOtpDelivery

Enum where members are also (and must be) strings

```
sms
in_app
```

**Kaynak:** `app/models/tow.py`

### TowOtpPurpose

Enum where members are also (and must be) strings

```
arrival
delivery
```

**Kaynak:** `app/models/tow.py`

### TowOtpRecipient

Enum where members are also (and must be) strings

```
customer
delivery_person
```

**Kaynak:** `app/models/tow.py`

### TowOtpVerifyResult

Enum where members are also (and must be) strings

```
pending
success
failed
expired
```

**Kaynak:** `app/models/tow.py`

### TowPaymentOperation

Enum where members are also (and must be) strings

```
preauth
capture
refund
void
```

**Kaynak:** `app/models/tow.py`

### TowRefundReason

Enum where members are also (and must be) strings

```
capture_delta
cancellation
kasko_reimbursement
manual
```

**Kaynak:** `app/models/tow.py`

### TowSettlementStatus

Enum where members are also (and must be) strings

```
none
pre_auth_holding
preauth_stale
final_charged
refunded
cancelled
kasko_rejected
```

**Kaynak:** `app/models/tow.py`

---

## Billing

### CaseKaskoState

Enum where members are also (and must be) strings

```
pending
submitted
approved
rejected
reimbursed
partially_reimbursed
```

**Kaynak:** `app/models/billing.py`

### CaseRefundReason

Enum where members are also (and must be) strings

```
cancellation
dispute
excess_preauth
kasko_reimbursement
admin_override
```

**Kaynak:** `app/models/billing.py`

### CaseRefundState

Enum where members are also (and must be) strings

```
pending
success
failed
```

**Kaynak:** `app/models/billing.py`

### PaymentIdempotencyState

Enum where members are also (and must be) strings

```
pending
success
failed
```

**Kaynak:** `app/models/billing.py`

### PaymentOperation

Enum where members are also (and must be) strings

```
authorize
capture
refund
void
```

**Kaynak:** `app/models/billing.py`

### PaymentProvider

Enum where members are also (and must be) strings

```
iyzico
mock
```

**Kaynak:** `app/models/billing.py`

---

## Offer

### CaseOfferKind

Enum where members are also (and must be) strings

```
standard
tow_scheduled
```

**Kaynak:** `app/models/offer.py`

### CaseOfferStatus

Enum where members are also (and must be) strings

```
pending
shortlisted
accepted
rejected
expired
withdrawn
```

**Kaynak:** `app/models/offer.py`

---

## Appointment

### AppointmentSlotKind

Enum where members are also (and must be) strings

```
today
tomorrow
custom
flexible
```

**Kaynak:** `app/models/appointment.py`

### AppointmentSource

App-level; DB'de CHECK constraint ile enforce.

```
offer_accept
direct_request
counter
```

**Kaynak:** `app/models/appointment.py`

### AppointmentStatus

Enum where members are also (and must be) strings

```
pending
approved
declined
expired
cancelled
counter_pending
```

**Kaynak:** `app/models/appointment.py`

---

## Insurance claim

### InsuranceClaimStatus

Enum where members are also (and must be) strings

```
submitted
accepted
paid
rejected
```

**Kaynak:** `app/models/insurance_claim.py`

### InsuranceCoverageKind

Enum where members are also (and must be) strings

```
kasko
trafik
```

**Kaynak:** `app/models/insurance_claim.py`

---

## Media

### AntivirusVerdict

Enum where members are also (and must be) strings

```
clean
infected
skipped
```

**Kaynak:** `app/models/media.py`

### MediaPurpose

Enum where members are also (and must be) strings

```
case_attachment
technician_certificate
technician_gallery
technician_promo
user_avatar
vehicle_license_photo
vehicle_photo
case_damage_photo
case_evidence_photo
case_evidence_video
case_evidence_audio
accident_proof
insurance_doc
technician_avatar
technician_gallery_photo
technician_gallery_video
technician_promo_video
tow_arrival_photo
tow_loading_photo
tow_delivery_photo
campaign_asset
```

**Kaynak:** `app/models/media.py`

### MediaStatus

Enum where members are also (and must be) strings

```
pending_upload
uploaded
processing
ready
failed
deleted
quarantined
```

**Kaynak:** `app/models/media.py`

### MediaVisibility

Enum where members are also (and must be) strings

```
public
private
```

**Kaynak:** `app/models/media.py`

### OwnerKind

Polymorphic owner kind — FK yok, service layer validate.

```
user
vehicle
service_case
technician_profile
technician_certificate
insurance_claim
campaign
```

**Kaynak:** `app/models/media.py`

---

## Taxonomy

### BrandTier

Enum where members are also (and must be) strings

```
mass
premium
luxury
commercial
motorcycle
```

**Kaynak:** `app/models/taxonomy.py`

---

