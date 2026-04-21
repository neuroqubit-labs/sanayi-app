# 06 — Appointment

## Purpose

Müşteri bir teklifi seçtiğinde (veya doğrudan bir ustaya randevu talebi gönderdiğinde) `appointments` satırı oluşur. Usta approve ederse vaka `scheduled` durumuna geçer; decline/expire ederse `offers_ready`'e döner. Her case'e aynı anda **tek aktif pending randevu**.

## Entity

### `appointments`

```sql
CREATE TABLE appointments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id        UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
    technician_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    offer_id       UUID REFERENCES case_offers(id) ON DELETE SET NULL,

    slot           JSONB NOT NULL,            -- {kind, dateLabel, timeWindow}
    slot_kind      appointment_slot_kind NOT NULL,   -- denormalized for query

    note           TEXT DEFAULT '',
    status         appointment_status NOT NULL DEFAULT 'pending',

    requested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at     TIMESTAMPTZ NOT NULL,
    responded_at   TIMESTAMPTZ,
    decline_reason TEXT,

    -- Faz 6: akış revize + counter-offer (Kural 2 + Kural 5)
    source                        VARCHAR(16) NOT NULL DEFAULT 'offer_accept'
        CHECK (source IN ('offer_accept','direct_request','counter')),
    counter_proposal              JSONB,                -- usta'nın önerdiği yeni slot
    counter_proposal_by_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,

    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_active_appointment_per_case
  ON appointments (case_id) WHERE status = 'pending';

CREATE INDEX ix_appointments_technician
  ON appointments (technician_id, status, requested_at DESC);
CREATE INDEX ix_appointments_case ON appointments (case_id, status);
CREATE INDEX ix_appointments_expiring
  ON appointments (expires_at) WHERE status = 'pending';
```

### Enum'lar

```sql
CREATE TYPE appointment_slot_kind AS ENUM ('today','tomorrow','custom','flexible');
CREATE TYPE appointment_status AS ENUM
  ('pending','approved','declined','expired','cancelled','counter_pending');
-- Faz 6 eklemesi: 'counter_pending' (Kural 5 — usta counter-offer)
```

### Source kuralları (Faz 6)

- `offer_accept` (default): müşteri teklifi kabul etti, randevu oluştu (A veya B akışı)
- `direct_request`: Kural 2 — teklif olmadan direkt randevu talebi (offer_id NULL)
- `counter`: Kural 5 — usta counter-offer sonrası oluşan randevu (pending counter_proposal ≠ final slot)

## State makinesi (Faz 6 revize, case lifecycle ile senkron)

```
pending ──┬─ approved ─────────────→ case: scheduled + assigned_technician_id=technician
          ├─ declined ──────────────→ case: offers_ready (revert)
          ├─ counter_pending ──┬─ approved (müşteri counter-onay) → slot=counter_proposal, case: scheduled
          │                    └─ declined (müşteri counter-red)  → case: offers_ready
          ├─ expired   ──────────────→ case: offers_ready
          └─ cancelled (customer/admin)
```

**Atomic `approve_appointment`** service:
1. `appointment.status='approved'` + `responded_at=NOW()`
2. `case.status='scheduled'` + `assigned_technician_id=technician_id`
3. `offer_id` varsa → offer.status='accepted' (zaten accept_offer tetiklendiyse no-op)

## İlişkiler

```mermaid
erDiagram
    SERVICE_CASE ||--o| APPOINTMENT : randevu
    USER ||--o{ APPOINTMENT : teknisyen
    CASE_OFFER ||--o| APPOINTMENT : bagli
    APPOINTMENT {
        uuid id PK
        uuid case_id FK_UK_partial
        uuid technician_id FK
        uuid offer_id FK_NULL
        jsonb slot
        appointment_slot_kind slot_kind
        appointment_status status
        timestamp expires_at
    }
```

## Mobil ↔ Backend mapping

| Mobil (`AppointmentSchema`) | Backend |
|---|---|
| `id, case_id, technician_id, offer_id` | top-level |
| `slot` (AppointmentSlot) | `appointments.slot` JSONB + `slot_kind` denorm kolon |
| `note, status, requested_at, expires_at, responded_at, decline_reason` | top-level |

## Repository helpers

```python
request_appointment(case_id, technician_id, offer_id, slot: dict, note, expires_at) -> Appointment
approve_appointment(appointment_id, *, actor_user_id) -> Appointment
decline_appointment(appointment_id, *, reason, actor_user_id)
cancel_appointment(appointment_id, *, actor_user_id)
expire_pending_appointments()  # cron
get_pending_for_technician(technician_id) -> list[Appointment]
get_active_for_case(case_id) -> Appointment | None
```

## Test senaryoları

1. Request appointment: case başına 1 pending (unique partial)
2. Duplicate pending same case → unique violation
3. Approve: case→scheduled + assigned_technician set + offer→accepted
4. Decline: case→offers_ready + decline_reason saved
5. Cron expire: pending + expires_at ≤ NOW → expired + case→offers_ready
6. Cascade: case delete → appointment CASCADE
7. Technician delete RESTRICT: aktif appointment varsa silinemez

## V2 (bu fazda yok)

- Slot negotiation (müşteri-usta karşılıklı yeni slot önerisi)
- Recurring appointments
- Multi-technician appointments (ekip)
