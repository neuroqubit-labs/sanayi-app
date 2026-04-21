# 08 — Insurance Claim

## Purpose

Sigorta hasar dosyası. Vaka onaylandıktan sonra (veya paralel olarak) ustanın/müşterinin açtığı kasko veya trafik sigortası dosyası. Backend **submit-only** olarak çalışır; taslak mobil client-side.

Mobil kaynak: [`InsuranceClaimSchema`](packages/domain/src/service-case.ts#L296) + [`ClaimDraft`](naro-service-app/src/features/insurance-claim/types.ts).

## Ürün kararları (2026-04-21, onaylı)

- **[K1] Taslak backend'de YOK**. Mobil client-side persist (Zustand + AsyncStorage); kullanıcı draft'ını telefonda tutar, submit edince backend'e gelir. Her küçük değişiklikte backend yükü olmaz.
- **[K2] Submit sonrası düzenleme YOK**. Sigortaya giden dosya taahhüttür. Backend'de kayıt `submitted`'da açılır; üzerinde alan güncellemesi akışı yok.
- **[K3] Reject sonrası yeni dosya açılabilir**. Eski kayıt dondurulmuş (`rejected`) olarak audit'te kalır; yeni `submitted` satırı açılır. Partial unique: aktif claim (submitted/accepted/paid) case başına 1 tane.
- **[K4] Status 4 değer**: `submitted → accepted → paid` + `rejected`. Terminal'ler: `paid`, `rejected`. Revize yolu yok.

## Entity

### `insurance_claims`

```sql
CREATE TABLE insurance_claims (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id                    UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,

    -- Poliçe
    policy_number              VARCHAR(64) NOT NULL,
    insurer                    VARCHAR(255) NOT NULL,     -- V2'de insurance_providers catalog
    coverage_kind              insurance_coverage_kind NOT NULL,  -- kasko | trafik
    insurer_claim_reference    VARCHAR(128),              -- sigortacının dosya no (ekspertiz sonrası)

    -- Status
    status                     insurance_claim_status NOT NULL DEFAULT 'submitted',

    -- 3 aşamalı tutar
    estimate_amount            NUMERIC(12,2) CHECK (estimate_amount IS NULL OR estimate_amount >= 0),
    accepted_amount            NUMERIC(12,2) CHECK (accepted_amount IS NULL OR accepted_amount >= 0),
    paid_amount                NUMERIC(12,2) CHECK (paid_amount IS NULL OR paid_amount >= 0),
    currency                   VARCHAR(8) NOT NULL DEFAULT 'TRY',

    -- Poliçe sahibi (müşteri ≠ sigortalı olabilir — aile aracı)
    policy_holder_name         VARCHAR(255),
    policy_holder_phone        VARCHAR(32),

    -- Timeline
    submitted_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at                TIMESTAMPTZ,
    paid_at                    TIMESTAMPTZ,
    rejected_at                TIMESTAMPTZ,
    rejection_reason           TEXT,

    -- Kim açtı
    created_by_user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by_snapshot_name   VARCHAR(255),

    notes                      TEXT,

    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Karar [K3]: aktif claim case başına 1
CREATE UNIQUE INDEX uq_active_insurance_claim_per_case
  ON insurance_claims (case_id)
  WHERE status IN ('submitted','accepted','paid');

CREATE INDEX ix_insurance_claims_case ON insurance_claims (case_id);
CREATE INDEX ix_insurance_claims_status ON insurance_claims (status, updated_at DESC);
CREATE INDEX ix_insurance_claims_insurer ON insurance_claims (insurer, status);
CREATE INDEX ix_insurance_claims_pending_accept
  ON insurance_claims (submitted_at) WHERE status = 'submitted';
```

### Enum'lar

```sql
CREATE TYPE insurance_coverage_kind AS ENUM ('kasko', 'trafik');
CREATE TYPE insurance_claim_status AS ENUM ('submitted','accepted','paid','rejected');
```

`case_event_type` + 4 değer (Faz 8):
- `insurance_claim_submitted`, `insurance_claim_accepted`, `insurance_claim_paid`, `insurance_claim_rejected`

## State makinesi

```
submitted ──┬─→ accepted ──┬─→ paid        (terminal)
            │              └─→ rejected   (sigorta son dakika iptal)
            └─→ rejected                   (sigorta submit'te reddetti)

rejected ⊘ (terminal — yeni submit yeni satır açar [K3])
paid     ⊘ (terminal)
```

Allowed transitions ([`insurance_claim_flow.py`](naro-backend/app/services/insurance_claim_flow.py)):
```python
{
    SUBMITTED: {ACCEPTED, REJECTED},
    ACCEPTED:  {PAID, REJECTED},
    PAID:      set(),   # terminal
    REJECTED:  set(),   # terminal — yeni submit yeni satır
}
```

## Service fonksiyonları

[`app/services/insurance_claim_flow.py`](naro-backend/app/services/insurance_claim_flow.py):

| Fonksiyon | Geçiş | Yan etki |
|---|---|---|
| `submit_claim(case_id, policy_*, coverage_kind, estimate_amount?, ...)` | `—` → `submitted` | case_events: `insurance_claim_submitted` + intent: `customer_approval_needed` |
| `accept_claim(claim_id, accepted_amount, insurer_claim_reference?)` | `submitted` → `accepted` | event: `insurance_claim_accepted` (success) + intent: `payment_review` |
| `reject_claim(claim_id, reason)` | `submitted/accepted` → `rejected` | event: `insurance_claim_rejected` (warning) + intent: `evidence_missing` ("yeni dosya açılabilir") |
| `mark_paid(claim_id, paid_amount?)` | `accepted` → `paid` | event: `insurance_claim_paid` (success); paid_amount None ise accepted_amount kullanılır |

**Idempotency**: `_transition()` helper'ı status check + raise ile; retry 400 atar.

**Race koruma**: submit_claim önce `get_active_claim_for_case` check + partial unique `IntegrityError` → `ClaimAlreadyActiveError`.

## FK cascade

| Parent → Child | OnDelete |
|---|---|
| service_cases → insurance_claims | CASCADE |
| users (created_by) → insurance_claims | SET NULL + `created_by_snapshot_name` |

## Mobil ↔ Backend mapping

| Mobil (`InsuranceClaimSchema` + `ClaimDraft`) | Backend |
|---|---|
| `InsuranceClaimSchema.policy_number` | `.policy_number` |
| `.insurer` | `.insurer` |
| `.coverage_kind` | `.coverage_kind` (enum) |
| `.claim_amount_estimate` | `.estimate_amount` |
| `.status` | `.status` (drafted hariç 4 değer) |
| `.customer_name, .customer_phone` | `.policy_holder_name, .policy_holder_phone` (sigortalı poliçe sahibi) |
| `ClaimDraft.source_case_id` | `.case_id` FK |
| `ClaimDraft.evidence[]` | `case_evidence_items` (Faz 7b) — `approval_id=NULL`, `case_id` set |
| `ClaimDraft.damage_area, summary, vehicle_drivable, location_label` | `service_cases.request_draft` JSONB (zaten mevcut) |
| `ClaimDraft.report_method, counterparty_*, accident_kind, ambulance_contacted, towing_required` | `service_cases.request_draft` JSONB |
| `ClaimDraft.estimate` (string) | Pydantic Decimal → `.estimate_amount` |
| `ClaimDraft.notes` | `.notes` |

**Not**: Kaza-spesifik alanlar (report_method, counterparty_*) `service_cases.request_draft` JSONB içinde kalır; `insurance_claims` tablosuna lift edilmez. Tek kaynak ilkesi.

## Test senaryoları

**Happy path**:
1. `submit_claim(case_id, kasko, estimate=10k)` → status='submitted', event INSERT, intent INSERT
2. `accept_claim(claim_id, accepted=8k)` → accepted, accepted_amount=8k, accepted_at set
3. `mark_paid(claim_id)` → paid_amount=accepted_amount=8k, paid_at set, terminal

**Reject + yeni claim**:
1. `submit_claim(...)` → A (submitted)
2. `reject_claim(A, "eksik belge")` → A rejected (terminal)
3. `submit_claim(...)` → B — **partial unique ihlal etmez**, aktif claim A rejected
4. `list_claims_for_case(case_id)` → [B (submitted), A (rejected)] DESC

**Edge**:
1. Aynı case'e 2. submit while A aktif → `ClaimAlreadyActiveError` + partial unique `IntegrityError`
2. `paid` sonrası transition → `InvalidClaimTransitionError`
3. `mark_paid` `accepted_amount=NULL + paid_amount=NULL` → `ValueError`
4. Case CASCADE delete → claims da silinir
5. Created_by user soft delete → SET NULL + snapshot_name korunur

## V2 kapsam dışı

- `insurance_providers` catalog + Axa/Allianz/vb. slug enum
- Sigortacı API entegrasyonu (submit endpoint → gerçek sigorta sistemine POST)
- `payment_intents` + ledger (Faz 10+) — `mark_paid` bu tabloya link eder
- Mobil engine refactor — `ClaimDraft` → API submit bağlaması (backend kontrat hazır)
- Ekspertiz raporu upload (şu an `case_documents` tablosu zaten destekliyor)

## Kod dosyaları (Faz 8 sonu)

- `naro-backend/app/models/insurance_claim.py`
- `naro-backend/app/schemas/insurance_claim.py`
- `naro-backend/app/repositories/insurance_claim.py`
- `naro-backend/app/services/insurance_claim_flow.py`
- `naro-backend/alembic/versions/20260421_0014_insurance_claims.py`
- Dokümantasyon: bu dosya

**Faz 8 sonu toplam tablo**: 29 → **30**.
