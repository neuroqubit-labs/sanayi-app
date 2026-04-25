# Naro Payment + Auth Security Strategy

**Status:** Working canonical draft
**Date:** 2026-04-25
**Scope:** `naro-app`, `naro-service-app`, `naro-backend`, shared mobile auth/payment primitives

## 1. Decision

Naro mobile apps must never collect, store, log, or proxy raw card PAN/CVV. Customer card entry goes through a PSP-hosted 3DS/checkout form or a platform wallet token flow. Backend owns the canonical payment ledger, idempotency, webhook verification, preauth/capture/refund state, and dispatch gates.

For towing, the correct product rule is:

1. Customer creates a canonical `ServiceCase(kind=towing)`.
2. Case enters `payment_required` or `preauth_requested`.
3. Customer completes PSP-hosted 3DS/preauth.
4. Backend verifies PSP callback/webhook.
5. Only then towing dispatch starts.
6. Delivery triggers final capture/settlement; cancellation triggers void or fee capture according to stage.

This preserves the user concept, “çekici çağırmak vaka oluşturur”, while preventing the risky version where dispatch starts before a real payment hold.

Planlı çekicide aynı online ödeme kuralı geçerlidir, ancak ön provizyon vaka
oluşturma anında değil randevuya yakın zamanda açılır. Varsayılan pencere
`TOW_SCHEDULED_PAYMENT_LEAD_MINUTES=60`: vaka `scheduled_waiting` kalır,
pencere açılınca `payment_required` olur, ödeme başarıyla tutulur ve saat
geldiyse dispatch başlar.

## 2. Source Line

The security baseline is based on:

- PCI SSC mobile/payment guidance: minimize payment data exposure on mobile devices and keep cardholder data under validated payment components.
- OWASP MASVS: secure storage, authentication/session, network communication, and platform interaction controls for mobile apps.
- Expo SecureStore: native secure storage uses platform secure storage facilities, but product logic must still control token lifetime, logout, and production env gates.
- Apple Pay / Google Pay: wallets provide tokenized payment data and reduce direct card handling in the app.
- EMV 3-D Secure and iyzico 3DS/checkout docs: card-not-present payments should use issuer authentication and PSP callback verification.

Links are listed at the end.

## 3. Current Repo Audit

### Auth

Good foundations:

- Both apps use `packages/mobile-core` auth/session primitives.
- Native storage uses Expo SecureStore through `createPlatformStorageAdapter`.
- Access/refresh tokens are stored as session keys and cleared on logout/refresh failure.
- Refresh has a mutex in both apps, avoiding concurrent refresh token rotation races.
- Backend stores only refresh token hashes and rotates refresh tokens.
- Service app blocks `pending` and `suspended` accounts through `ApprovalStatus`.
- Claude's service login change normalizes Turkish phone input before OTP request, which reduces duplicate technician users.

Risks to fix before payment hardening:

- Backend must also canonicalize phone numbers. Frontend normalization is helpful but not authoritative.
- `EXPO_PUBLIC_MOCK_AUTH=true` must hard-fail in staging/production builds.
- Service approval status should be refreshed from backend after login/bootstrap; local stored status alone is not enough for payout/payment-sensitive flows.
- Current WebSocket auth uses JWT in query string for tow live channel. For payment/tow live tracking, replace with a short-lived WS ticket endpoint or a header/subprotocol approach where feasible.
- Step-up auth is missing for high-risk actions: payout settings, stored payment method changes, refund/dispute admin actions, and technician bank/identity updates.

### Generic Billing

Good foundations:

- Customer app has `PaymentInitiateScreen`.
- Shared `ThreeDSWebView` already restricts origins to iyzico/Naro, disables cache/cookies, avoids injected JavaScript, and uses callback parsing.
- Backend billing has `/cases/{id}/payment/initiate`, provider abstraction, idempotency, and billing state transitions.
- Backend iyzico adapter is intentionally PSP-hosted checkout oriented; comments correctly avoid raw card handling.

Risks:

- The generic billing flow and towing preauth flow are still separate. They should converge on a shared payment intent model and shared 3DS/wallet UI primitives.
- `ThreeDSWebView` should be reused for towing rather than creating a second payment surface.

### Tow Payment

Good foundations:

- `tow_payment.py` has durable idempotency keys for preauth/capture/refund/void.
- Tow settlement model supports cap amount, quoted amount, capture, refund, stale preauth, and cancellation.
- Dispatch/capture lifecycle already has the right conceptual shape.

Critical gap:

- `POST /tow/cases` currently calls `authorize_preauth(... psp=build_mock_psp())` and starts dispatch in the same request. This is fine for early simulation, but not for live launch.
- Customer does not see a real payment confirmation/3DS step before dispatch.
- The UI currently tells the user payment is secured, but the real PSP flow is not yet in the towing path.

## 4. Target Payment Architecture

### Backend Concepts

Add or normalize these concepts:

- `payment_attempts`: one row per PSP checkout/preauth attempt.
- `payment_intent_id` or equivalent server-generated ID.
- `idempotency_key`: required for create/initiate/retry.
- `payment_state`: `not_required`, `payment_required`, `preauth_requested`, `preauth_held`, `preauth_failed`, `capture_pending`, `captured`, `voided`, `refunded`.
- `provider`: `mock`, `iyzico`, future alternatives.
- `provider_token`, `provider_payment_id`, `provider_conversation_id`: backend only.
- `amount_snapshot`: quote amount, cap amount, currency, distance source, expiry.
- `risk_snapshot`: user, device, route, quote, and case metadata used at authorization time.
- `PAYMENT_PLATFORM_MODEL`: `standard_sandbox` for development, `marketplace` for staging/production.
- `ENABLE_LEGACY_BILLING_WEBHOOK_FALLBACK`: false by default; legacy billing callbacks only run when explicitly enabled during cleanup windows.

The backend recomputes quote/amount at payment initiation. UI-submitted amount is only a hint.

### Towing Flow

1. Customer selects pickup, dropoff, vehicle, vehicle condition.
2. UI calls quote endpoint and displays only `En fazla ₺X`.
3. Customer taps `Çekiciyi çağır`.
4. Backend creates/returns a towing case in `payment_required`.
5. UI opens `TowPaymentSheet` or `PaymentInitiateScreen` variant.
6. `POST /tow/cases/{case_id}/payment/initiate` returns PSP checkout URL.
7. Customer completes PSP-hosted 3DS.
8. PSP webhook/callback is verified server-side.
9. Backend transitions payment to `preauth_held`, case/tow stage to `searching`, and starts dispatch.
10. User lands on `/cekici/{case_id}` searching screen and can leave the screen; active tow entry points route back there.
11. Technician accepts and completes stages.
12. Delivery triggers capture; cap delta is automatically voided/refunded.

If no tow candidate is available, the payment hold remains visible with a clear cancellation path. Cancel before assignment should void preauth.

If the customer closes the hosted 3DS/WebView before completion, the active
attempt is marked `cancelled` and the case returns to retryable
`payment_required`. A late success callback for that abandoned attempt must
void the preauth immediately and must not start dispatch.

### Generic Repair / Maintenance / Damage

Generic case billing is approval-centered:

- `parts_request` and `invoice` can be paid online through Payment Core with `subject_type=case_approval` and `payment_mode=direct_capture`.
- Online payment does not approve the request until PSP callback is verified.
- PSP success marks the payment order `captured` and approves the approval exactly once.
- Customer can alternatively select `service_card` or `cash`; that records the payment method and approves the approval without Naro commission settlement.
- `completion` is not a payment approval; it closes the case, rating, review and optional public showcase consent.

Product policy:

- Tow: online payment required.
- Campaign/package: online payment required.
- Service approval/final invoice/extra charge: online recommended, service card/cash allowed.
- Production/staging online payment target: marketplace/sub-merchant ready.
  Standard merchant flow is only `standard_sandbox` development mode.

### Wallets

V1 can ship with PSP-hosted 3DS only. V1.1 should add Apple Pay and Google Pay if the PSP supports tokenized wallet processing. Wallet tokens still go backend to PSP; the app must not turn wallet support into raw card handling.

## 5. Auth Contract for Payments

Customer payment actions require:

- Authenticated customer.
- Case ownership.
- Fresh access token.
- Idempotency key per user action.
- Server-side amount recalculation.
- Payment retry bounded by attempt count/rate limit.

Service payment-adjacent actions require:

- Authenticated technician.
- Active approval status from backend.
- Technician assignment/participant check.
- Step-up auth for payout settings, bank data, tax identity, and sub-merchant onboarding changes.
- No service-side card collection.

Admin payment actions require:

- Admin role.
- Step-up auth.
- Append-only audit event.
- Dual-control for manual refund/capture override once volume grows.

## 6. Mobile Security Rules

- Store access/refresh tokens only in SecureStore on native.
- Do not store PSP secrets or backend API keys in `EXPO_PUBLIC_*`; those are public app config.
- Restrict public Google/Apple keys by package/bundle/SHA where applicable.
- Never log payment callback URLs if they contain provider tokens.
- Do not log Authorization headers, refresh tokens, checkout tokens, payment IDs beyond short masked refs.
- Disable mock auth/payment in staging/production by runtime assertion.
- Payment WebView origin whitelist stays strict.
- Prefer PSP-hosted pages or OS wallet sheets over custom card forms.
- Payment flows are not offline-queueable. Offline UI can show cached status only.

## 7. API Shape Proposal

Towing:

```http
POST /tow/cases
```

Creates or returns canonical towing case. No dispatch before payment. Duplicate active towing case returns a typed `409` with `existing_case_id`.

```http
POST /tow/cases/{case_id}/payment/initiate
```

Creates PSP checkout/preauth attempt. Returns:

```json
{
  "case_id": "...",
  "payment_attempt_id": "...",
  "checkout_url": "https://...",
  "preauth_amount": "1234.00",
  "currency": "TRY",
  "expires_at": "..."
}
```

```http
POST /webhooks/iyzico/payment
```

Verifies PSP callback, updates attempt, moves settlement to `preauth_held`, starts dispatch.

```http
GET /tow/cases/{case_id}
```

Snapshot includes payment state and next action:

```json
{
  "stage": "payment_required",
  "payment": {
    "state": "preauth_requested",
    "amount_label": "En fazla ₺1234",
    "retryable": true
  }
}
```

## 8. Implementation Plan

### Phase 0 — Safety Gates

- Add production env assertions:
  - `EXPO_PUBLIC_MOCK_AUTH !== true`
  - backend `PSP_PROVIDER !== mock`
  - backend PSP webhook secret configured
- Add backend phone canonicalization for OTP request/verify.
- Add tests for service login phone normalization parity.

### Phase 1 — Shared Payment Intent Layer

- Create backend payment attempt table/service or extend current billing idempotency model.
- Extract common PSP checkout initiation for generic billing and tow.
- Keep current `ThreeDSWebView` and `useThreeDSFlow` as shared mobile primitives.
- Add typed payment error codes; never show raw `API error 402/409`.

### Phase 2 — Tow Payment Gate

- Change `/tow/cases` immediate flow:
  - create case + tow subtype
  - set stage/payment state to payment-required
  - do not call mock preauth
  - do not initiate dispatch
- Add `/tow/cases/{id}/payment/initiate`.
- On successful PSP callback, call existing `tow_payment.authorize`/settlement transition equivalent and then `tow_dispatch.initiate_dispatch`.
- Existing tracking screen becomes the single active tow surface.

### Phase 3 — UX

- After `Çekiciyi çağır`, show a compact payment confirmation:
  - `En fazla ₺X`
  - card/3DS/wallet choice
  - “Çekici bulununca bu tutar bloke edilir; iş sonunda gerçek tutar alınır.”
- After payment success, go to searching screen.
- If user leaves, every active tow entry point routes to `/cekici/{case_id}`.

### Phase 4 — Service App / Marketplace

- Verify PSP marketplace/sub-merchant mode before production tow payments.
- Add technician sub-merchant onboarding status to service app profile/approval.
- Technician can go online for paid tow only when:
  - approval active
  - tow capability active
  - sub-merchant onboarding ready, if online payment is required

### Phase 5 — Wallets and Saved Methods

- Add Apple Pay / Google Pay through PSP-supported token flow.
- Add saved card only after explicit user consent.
- Store only PSP card token metadata; no PAN/CVV.
- Step-up auth before deleting/adding saved method.

## 9. Test Plan

Backend:

- Payment initiation recomputes quote and rejects tampered amount.
- Duplicate active tow returns typed `409 existing_case_id`.
- Dispatch does not start before `preauth_held`.
- PSP callback signature/webhook verification failure does not move state.
- Idempotent retry returns same payment attempt or safe next attempt.
- Cancel before assignment voids preauth.
- Delivered stage captures final amount and refunds/voids delta.

Customer app:

- Tow create with missing payment opens payment step, not searching.
- Successful 3DS moves to searching.
- Failed/abandoned 3DS shows retry, not raw API errors.
- Active tow buttons route to existing active case.
- App restart resumes correct payment/searching state.

Service app:

- Pending/suspended technician cannot receive paid dispatch.
- Payout/sub-merchant changes require step-up auth.
- Service app never sees customer card/payment tokens.

Security:

- No raw PAN/CVV fields in frontend/backend DTOs.
- No PSP secret in `EXPO_PUBLIC_*`.
- No payment token or Authorization header in telemetry logs.
- Production build fails with mock auth/payment enabled.

## 10. Immediate Notes for Claude Login Work

The service login normalization change is directionally correct. Keep it, but do not rely on it alone:

- Backend must normalize phone before OTP issue/verify/user lookup.
- Login should send an `X-Device-Label` or stable device label only if privacy-approved; backend already has storage for it.
- After OTP verify, service app should fetch live technician/approval state before allowing paid operations.
- For payout/payment settings, add step-up OTP even if the user is already logged in.

## 11. References

- PCI SSC Mobile Payments on COTS: https://www.pcisecuritystandards.org/standards/mobile-payments-on-cots-mpoc/
- PCI DSS standards: https://www.pcisecuritystandards.org/standards/pci-dss/
- OWASP MASVS: https://mas.owasp.org/MASVS/
- Expo SecureStore: https://docs.expo.dev/versions/latest/sdk/securestore/
- Expo environment variables: https://docs.expo.dev/guides/environment-variables/
- Google Pay Android overview: https://developers.google.com/pay/api/android/overview
- Google Pay payment data cryptography: https://developers.google.com/pay/api/android/guides/resources/payment-data-cryptography
- Apple Pay security and privacy: https://support.apple.com/en-us/102626
- Apple Pay developer planning: https://developer.apple.com/apple-pay/planning/
- EMVCo 3-D Secure: https://www.emvco.com/emv-technologies/3d-secure/
- iyzico 3DS implementation: https://docs.iyzico.com/en/payment-methods/direct-charge/3ds/3ds-implementation
- Naro legal/marketplace payment note: [docs/business/monetizasyon/odeme-modeli-yasal-cerceve.md](business/monetizasyon/odeme-modeli-yasal-cerceve.md)
