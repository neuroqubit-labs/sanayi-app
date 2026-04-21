# 04 — Case (Vaka)

## Purpose

**Merkez entity**. Müşteri bir talep açtığında (kaza/çekici/arıza/bakım) `service_cases`'e 1 satır düşer; havuzdan tamamlamaya kadar **tek kayıt** yaşar. Teklifler, randevular, mesajlar, süreç milestone'ları, belgeler hepsi bu satıra asılır.

**Zihin modeli**:
- `service_cases` → **authoritative state** (status, wait_state, assigned_technician, financials)
- `request_draft` (JSONB) → vaka açılışındaki ServiceRequestDraft snapshot (30+ kind-spesifik field)
- Compute edilenler (`next_action_*`, `*_label`, `updated_at_label`) → mobil tracking engine; backend tutmaz

Status makinesi 10 durumlu DAG; app service katmanında (`case_lifecycle.py`) enforce edilir.

## Entity tablo

### `service_cases`

```sql
CREATE TABLE service_cases (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id                 UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    customer_user_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    kind                       service_request_kind NOT NULL,
    urgency                    service_request_urgency NOT NULL DEFAULT 'planned',
    status                     service_case_status NOT NULL DEFAULT 'matching',
    origin                     case_origin NOT NULL DEFAULT 'customer',

    title                      VARCHAR(255) NOT NULL,
    subtitle                   VARCHAR(255),
    summary                    TEXT,
    location_label             VARCHAR(255),

    preferred_technician_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_technician_id     UUID REFERENCES users(id) ON DELETE SET NULL,

    workflow_blueprint         VARCHAR(64) NOT NULL,
    request_draft              JSONB NOT NULL,

    wait_state_actor           case_wait_actor NOT NULL DEFAULT 'system',
    wait_state_label           VARCHAR(255),
    wait_state_description     TEXT,

    last_seen_by_customer      TIMESTAMPTZ,
    last_seen_by_technician    TIMESTAMPTZ,

    total_amount               NUMERIC(12,2),
    estimate_amount            NUMERIC(12,2),

    closed_at                  TIMESTAMPTZ,
    deleted_at                 TIMESTAMPTZ,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Havuz feed (en kritik sorgu)
CREATE INDEX ix_cases_pool_feed ON service_cases
  (status, kind, urgency, created_at DESC)
  WHERE deleted_at IS NULL AND status IN ('matching','offers_ready');

CREATE INDEX ix_cases_assigned_tech ON service_cases
  (assigned_technician_id, status, updated_at DESC)
  WHERE assigned_technician_id IS NOT NULL;

CREATE INDEX ix_cases_preferred_tech ON service_cases
  (preferred_technician_id, status)
  WHERE preferred_technician_id IS NOT NULL;

CREATE INDEX ix_cases_customer ON service_cases
  (customer_user_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_cases_vehicle ON service_cases (vehicle_id, created_at DESC);

CREATE INDEX ix_cases_request_gin ON service_cases
  USING GIN (request_draft jsonb_path_ops);

CREATE INDEX ix_cases_title_trgm ON service_cases
  USING GIN (title gin_trgm_ops);
```

## Enum'lar

```sql
CREATE TYPE service_request_kind AS ENUM
  ('accident','towing','breakdown','maintenance');
CREATE TYPE service_request_urgency AS ENUM ('planned','today','urgent');
CREATE TYPE service_case_status AS ENUM
  ('matching','offers_ready','appointment_pending','scheduled',
   'service_in_progress','parts_approval','invoice_approval',
   'completed','archived','cancelled');
CREATE TYPE case_origin AS ENUM ('customer','technician');
CREATE TYPE case_wait_actor AS ENUM ('customer','technician','system','none');
```

## İlişkiler

```mermaid
erDiagram
    VEHICLE ||--o{ SERVICE_CASE : ait
    USER ||--o{ SERVICE_CASE : customer
    USER ||--o{ SERVICE_CASE : assigned_tech
    SERVICE_CASE ||--o{ CASE_OFFER : teklifler
    SERVICE_CASE ||--o| APPOINTMENT : randevu
    SERVICE_CASE {
        uuid id PK
        uuid vehicle_id FK
        uuid customer_user_id FK
        uuid assigned_technician_id FK_NULL
        service_request_kind kind
        service_request_urgency urgency
        service_case_status status
        string workflow_blueprint
        jsonb request_draft
        case_wait_actor wait_state_actor
        timestamp closed_at
    }
```

## Status makinesi

```
matching ──┬─→ offers_ready ──┬─→ appointment_pending ──→ scheduled
           │                  │                           │
           └─→ appointment_pending                        ↓
                                                service_in_progress
                                                          │
                                 ┌────────────────────────┤
                                 ↓                        ↓
                         parts_approval         invoice_approval
                                 │                        │
                                 └──────→ service_in_progress
                                                          │
                                                       completed
                                                          │
                                                       archived

Her state → cancelled (terminal); cancelled → archived.
```

`app/services/case_lifecycle.py` — `ALLOWED_TRANSITIONS` dict ile enforce. Transition ihlalinde `InvalidTransitionError` raise.

```python
ALLOWED_TRANSITIONS = {
    MATCHING:            {OFFERS_READY, APPOINTMENT_PENDING, CANCELLED},
    OFFERS_READY:        {APPOINTMENT_PENDING, MATCHING, CANCELLED},
    APPOINTMENT_PENDING: {SCHEDULED, OFFERS_READY, CANCELLED},
    SCHEDULED:           {SERVICE_IN_PROGRESS, CANCELLED},
    SERVICE_IN_PROGRESS: {PARTS_APPROVAL, INVOICE_APPROVAL, CANCELLED},
    PARTS_APPROVAL:      {SERVICE_IN_PROGRESS, CANCELLED},
    INVOICE_APPROVAL:    {COMPLETED, SERVICE_IN_PROGRESS, CANCELLED},
    COMPLETED:           {ARCHIVED},
    CANCELLED:           {ARCHIVED},
    ARCHIVED:            set(),
}
```

Transition → `closed_at = NOW()` COMPLETED/CANCELLED'da; wait_state + event log güncellenir.

## Pool matching

```python
KIND_PROVIDER_MAP: dict[ServiceRequestKind, set[ProviderType]] = {
    ACCIDENT:    {USTA, KAPORTA_BOYA, CEKICI},
    TOWING:      {CEKICI, USTA},
    BREAKDOWN:   {USTA, OTO_ELEKTRIK, LASTIK, CEKICI},
    MAINTENANCE: {USTA, LASTIK, OTO_ELEKTRIK, OTO_AKSESUAR},
}
```

Havuz feed (usta perspektifi):
```sql
SELECT sc.*
FROM service_cases sc
WHERE sc.status IN ('matching','offers_ready')
  AND sc.kind IN (kinds_for_provider_type(:ptype))
  AND sc.deleted_at IS NULL
ORDER BY sc.urgency DESC, sc.created_at DESC
LIMIT 50;
```

## Lifecycle kuralları

- **Create**: `origin='customer'` default, status='matching'. `request_draft` validate edilir (Pydantic schema). `preferred_technician_id` varsa status='matching' ama havuz ona öncelik
- **Assign**: randevu onayında `assigned_technician_id` + `status=scheduled`
- **Clear assign**: iptal durumunda SET NULL
- **Wait state**: actor (customer/technician/system/none) + label + description — hızlı liste query'si için **cache** kolonu
- **Last-seen**: `mark_seen(case_id, 'customer' | 'technician')` → ilgili timestamp güncellenir
- **Soft delete**: KVKK silme isteği veya müşteri geri alma; case tamamen kaybolmaz
- **Close**: completed/cancelled → `closed_at`

## Mobil ↔ Backend mapping

| Mobil (`ServiceCaseSchema`) | Backend |
|---|---|
| `.id, .vehicle_id, .kind, .status, .origin` | top-level |
| `.title, .subtitle, .summary` | top-level |
| `.request` (ServiceRequestDraft) | `request_draft` JSONB |
| `.assigned_technician_id, .preferred_technician_id` | top-level FK |
| `.workflow_blueprint` | top-level string |
| `.wait_state` (3 field) | 3 top-level cache kolonu |
| `.last_seen_by_actor` (customer/technician) | 2 top-level timestamp |
| `.total_label / .estimate_label` | computed (`total_amount` + currency format) |
| `.offers[]` | **ayrı tablo** `case_offers` (Faz 5) |
| `.appointment` | **ayrı tablo** `appointments` (Faz 5) |
| `.insurance_claim` | **ayrı tablo** `insurance_claims` (Faz 8) |
| `.attachments[], .documents[], .events[], .thread, .milestones, .tasks, .evidence_feed` | **ayrı tablolar** (Faz 6-7) |
| `.next_action_*, *_label, updated_at_label` | **computed — backend cache etmez** |
| `.allowed_actions` | `case_lifecycle.py` allowed_actions() helper |
| `.pending_approvals` | `case_approvals` WHERE status='pending' (Faz 6) |

## İndeksler & sorgu pattern'leri

| Sorgu | Index |
|---|---|
| "Havuz feed (usta perspektifi)" | `ix_cases_pool_feed` (partial) |
| "Ustaya atanan aktif işler" | `ix_cases_assigned_tech` |
| "Preferred technician pending" | `ix_cases_preferred_tech` |
| "Müşterinin kayıtları" | `ix_cases_customer` |
| "Aracın vaka geçmişi" | `ix_cases_vehicle` |
| "JSONB kind-spesifik filtre" (breakdown_category, kasko_selected) | `ix_cases_request_gin` |
| "Başlık arama" | `ix_cases_title_trgm` |

## Test senaryoları

**Happy path**:
1. `create_case(vehicle_id, customer_id, kind='breakdown', request_draft={...})` → status='matching'
2. JSONB roundtrip: `request_draft['breakdown_category'] == 'engine'`
3. Pool feed: provider=`cekici` → `accident|towing|breakdown` kind'leri döner
4. Transition `matching → offers_ready` valid
5. Cancel: `matching → cancelled` → `closed_at` set, pool'dan düşer

**Edge**:
1. Transition `matching → scheduled` → `InvalidTransitionError`
2. Transition `archived → anything` → raise
3. Vehicle delete → case RESTRICT hatası (vehicle silinemez vaka varsa)
4. User (customer) delete → case RESTRICT
5. Technician delete → `assigned_technician_id=NULL`, case kalır
6. JSONB search: `request_draft @> '{"kasko_selected": true}'` → sigortalı hasar dosyaları döner
7. Title trgm: "BMW" → "BMW 320i revizyon" eşleşir
8. `mark_seen(case_id, 'customer')` → `last_seen_by_customer` güncellenir
9. `assign_technician()` → FK set; `clear_assigned_technician()` → NULL

## V2 scope (bu fazda yok)

- `case_offers, appointments` → Faz 5
- `case_attachments, documents, threads, messages, milestones, tasks, approvals, evidence_feed` → Faz 6-7
- `insurance_claims` → Faz 8
- `case_events` audit → Faz 12
- `notification_intents` → Faz 11

## Kod dosyaları (Faz 4 sonu)

- `naro-backend/app/models/case.py` — ServiceCase + 5 enum
- `naro-backend/app/schemas/case.py` — Pydantic in/out
- `naro-backend/app/repositories/case.py` — CRUD + pool + assign
- `naro-backend/app/services/case_lifecycle.py` — status makinesi + wait_state
- `naro-backend/app/services/pool_matching.py` — KIND_PROVIDER_MAP
- `naro-backend/alembic/versions/20260420_0005_case.py` — 5 enum + 1 tablo + 7 index
- `naro-backend/tests/test_case.py` — 9 senaryo
