# 07 — Case Process

## Purpose

Vaka onaylandıktan sonraki yaşam döngüsünün tablo katmanı. Eksen 4 tasarımıyla 4 alt faza bölündü:

- **7a — core**: `case_milestones`, `case_tasks`, `case_approvals`, `case_approval_line_items`
- **7b — artifacts**: `case_evidence_items`, `case_documents`, `case_attachments`, `case_approval_evidence_links`, `case_task_evidence_links`
- **7c — communication**: `case_threads`, `case_messages`, `case_message_attachments`
- **7d — audit + notification**: `case_events`, `case_notification_intents`

**Zihin modeli**: Vaka (üst sınıf) → milestone (aşama) → task (aksiyon) → approval/evidence/message (artifact). Her mutation `case_events` append-only audit'e düşer.

## 7a — Core process skeleton

### `case_milestones`

```sql
CREATE TABLE case_milestones (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id        UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
    key            VARCHAR(64) NOT NULL,       -- intake, diagnosis, approval, repair, delivery, insurance, scope, service, quality
    title          VARCHAR(255) NOT NULL,
    description    TEXT,
    actor          case_actor NOT NULL,        -- customer | technician | system
    sequence       SMALLINT NOT NULL,          -- 0..N sıralı
    status         case_milestone_status NOT NULL DEFAULT 'upcoming',
    badge_label    VARCHAR(64),
    blocker_reason TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_case_milestones_case ON case_milestones (case_id, sequence);
CREATE INDEX ix_case_milestones_active ON case_milestones (case_id, status) WHERE status = 'active';
```

### `case_tasks`

```sql
CREATE TABLE case_tasks (
    id                    UUID PRIMARY KEY,
    case_id               UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
    milestone_id          UUID NOT NULL REFERENCES case_milestones(id) ON DELETE CASCADE,
    kind                  case_task_kind NOT NULL,       -- 17 enum
    title                 VARCHAR(255) NOT NULL,
    description           TEXT,
    actor                 case_actor NOT NULL,
    status                case_task_status NOT NULL DEFAULT 'pending',
    urgency               case_task_urgency NOT NULL DEFAULT 'background',
    cta_label             VARCHAR(255) NOT NULL,
    helper_label          VARCHAR(255),
    blocker_reason        TEXT,
    evidence_requirements JSONB NOT NULL DEFAULT '[]',   -- [{id,title,kind,required,hint}]
    created_at, updated_at ...
);
CREATE INDEX ix_case_tasks_case_actor_status ON case_tasks (case_id, actor, status, urgency);
CREATE INDEX ix_case_tasks_milestone ON case_tasks (milestone_id);
CREATE INDEX ix_case_tasks_active_now ON case_tasks (case_id, actor) WHERE status='active' AND urgency='now';
```

### `case_approvals`

```sql
CREATE TABLE case_approvals (
    id                         UUID PRIMARY KEY,
    case_id                    UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
    kind                       case_approval_kind NOT NULL,   -- parts_request | invoice | completion
    status                     case_approval_status NOT NULL DEFAULT 'pending',
    title                      VARCHAR(255) NOT NULL,
    description                TEXT,
    requested_by_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    requested_by_snapshot_name VARCHAR(255),   -- anonymize sonrası gösterim
    requested_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at               TIMESTAMPTZ,
    amount                     NUMERIC(12,2),
    currency                   VARCHAR(8) NOT NULL DEFAULT 'TRY',
    service_comment            TEXT,
    created_at, updated_at ...
);
CREATE INDEX ix_case_approvals_case_kind_status ON case_approvals (case_id, kind, status);
CREATE INDEX ix_case_approvals_pending ON case_approvals (case_id) WHERE status='pending';
```

### `case_approval_line_items`

```sql
CREATE TABLE case_approval_line_items (
    id          UUID PRIMARY KEY,
    approval_id UUID NOT NULL REFERENCES case_approvals(id) ON DELETE CASCADE,
    label       VARCHAR(255) NOT NULL,
    value       VARCHAR(255) NOT NULL,
    note        TEXT,
    sequence    SMALLINT NOT NULL DEFAULT 0 CHECK (sequence >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_case_approval_line_items_approval ON case_approval_line_items (approval_id, sequence);
```

**Service orchestration**: [`approval_flow.py`](naro-backend/app/services/approval_flow.py) — `request_approval` + `approve` + `reject`. SCHEDULED → SERVICE_IN_PROGRESS auto-start hook (usta parça isterken iş başladı sayılır).

**Workflow seed**: [`workflow_seed.py`](naro-backend/app/services/workflow_seed.py) — 4 blueprint template (`damage_insured`, `damage_uninsured`, `maintenance_standard`, `maintenance_major`); case create sonrası `seed_blueprint()` milestone+task setini yaratır.

## 7b — Artifacts

### `case_evidence_items`

Usta/sistem yüklediği kanıt (hasar foto, ilerleme, teslim). Task + milestone FK SET NULL (task silinse kanıt kalır).

```sql
CREATE TABLE case_evidence_items (
    id             UUID PRIMARY KEY,
    case_id        UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
    task_id        UUID REFERENCES case_tasks(id) ON DELETE SET NULL,
    milestone_id   UUID REFERENCES case_milestones(id) ON DELETE SET NULL,
    title          VARCHAR(255) NOT NULL,
    subtitle       VARCHAR(255),
    kind           case_attachment_kind NOT NULL,      -- photo|video|audio|invoice|report|document|location
    actor          VARCHAR(32) NOT NULL CHECK (actor IN ('customer','technician','system')),
    source_label   VARCHAR(255) NOT NULL,
    status_label   VARCHAR(255) NOT NULL,
    media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    is_new         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at, updated_at ...
);
CREATE INDEX ix_case_evidence_case ON case_evidence_items (case_id, created_at DESC);
CREATE INDEX ix_case_evidence_task ON case_evidence_items (task_id) WHERE task_id IS NOT NULL;
CREATE INDEX ix_case_evidence_new ON case_evidence_items (case_id, is_new) WHERE is_new IS TRUE;
```

### `case_documents`

Fatura, ekspertiz raporu, sigorta poliçesi, fotoğraf sunumları.

```sql
CREATE TABLE case_documents (
    id, case_id, kind, title, subtitle, source_label, status_label,
    media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    ...
);
CREATE INDEX ix_case_documents_case ON case_documents (case_id, created_at DESC);
```

### `case_attachments`

Talep anı ekleri (`request_draft.attachments` normalize'ı — Eksen 4 [4g]). Case create sonrası `evidence.migrate_request_draft_attachments` ile tabloya alınır.

```sql
CREATE TABLE case_attachments (
    id, case_id, kind, title, subtitle, status_label,
    media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
    ...
);
```

### M:N link tabloları

```sql
-- Hangi onay hangi kanıta dayanıyor
CREATE TABLE case_approval_evidence_links (
    approval_id UUID REFERENCES case_approvals(id) ON DELETE CASCADE,
    evidence_id UUID REFERENCES case_evidence_items(id) ON DELETE CASCADE,
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (approval_id, evidence_id)
);

-- Task evidence_requirements satisfaction
CREATE TABLE case_task_evidence_links (
    task_id        UUID REFERENCES case_tasks(id) ON DELETE CASCADE,
    evidence_id    UUID REFERENCES case_evidence_items(id) ON DELETE CASCADE,
    requirement_id VARCHAR(64),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, evidence_id)
);
```

**Service**: [`evidence.py`](naro-backend/app/services/evidence.py) — `add_evidence_to_case`, `add_document_to_case`, `migrate_request_draft_attachments`.

## 7c — Communication

### `case_threads`

Case başına 1 thread (UNIQUE). V2: `kind` kolonu eklenerek N:1 (admin-customer ayrı thread).

```sql
CREATE TABLE case_threads (
    id                UUID PRIMARY KEY,
    case_id           UUID NOT NULL UNIQUE REFERENCES service_cases(id) ON DELETE CASCADE,
    preview           VARCHAR(512),
    unread_customer   INTEGER NOT NULL DEFAULT 0,
    unread_technician INTEGER NOT NULL DEFAULT 0,
    ...
);
```

### `case_messages`

```sql
CREATE TABLE case_messages (
    id                    UUID PRIMARY KEY,
    thread_id             UUID NOT NULL REFERENCES case_threads(id) ON DELETE CASCADE,
    case_id               UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
    author_user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    author_role           VARCHAR(16) NOT NULL CHECK (author_role IN ('customer','technician','system')),
    author_snapshot_name  VARCHAR(255),
    body                  TEXT NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_case_messages_thread_created ON case_messages (thread_id, created_at DESC);
CREATE INDEX ix_case_messages_case ON case_messages (case_id, created_at DESC);
```

### `case_message_attachments`

```sql
CREATE TABLE case_message_attachments (
    message_id     UUID REFERENCES case_messages(id) ON DELETE CASCADE,
    media_asset_id UUID REFERENCES media_assets(id) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, media_asset_id)
);
```

**Service**: [`messaging.py`](naro-backend/app/services/messaging.py) — `ensure_thread`, `post_message` (unread counter + preview update + event emission), `mark_thread_read`.

## 7d — Audit + Notification

### `case_events` (append-only)

```sql
CREATE TABLE case_events (
    id             UUID PRIMARY KEY,
    case_id        UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
    type           case_event_type NOT NULL,     -- 26 değer (submitted, offer_*, appointment_*, parts_*, invoice_*, evidence_added, message, ...)
    title          VARCHAR(255) NOT NULL,
    body           TEXT,
    tone           VARCHAR(16) NOT NULL DEFAULT 'neutral' CHECK (tone IN ('accent','neutral','success','warning','critical','info')),
    actor_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    context        JSONB NOT NULL DEFAULT '{}',  -- old_value, new_value, metadata
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_case_events_case_created ON case_events (case_id, created_at DESC);
CREATE INDEX ix_case_events_type ON case_events (case_id, type);
```

**Append-only** — service katmanı `case_events.py::append_event()` ile INSERT yapar; UPDATE/DELETE yok. Retention: 2 yıl sonra hard delete cron (Faz 15).

**Event tipleri** (26):
```
submitted, offer_received, offer_accepted, offer_rejected, offer_withdrawn,
appointment_requested, appointment_approved, appointment_declined,
appointment_cancelled, appointment_expired, appointment_counter,
technician_selected, technician_unassigned,
status_update, parts_requested, parts_approved, parts_rejected,
invoice_shared, invoice_approved,
evidence_added, document_added, message, wait_state_changed,
completed, cancelled, archived, soft_deleted
```

### `case_notification_intents`

Sunucu-tarafı bildirim intent kuyrudu. Mobil push/SMS delivery Faz 8+.

```sql
CREATE TABLE case_notification_intents (
    id         UUID PRIMARY KEY,
    case_id    UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
    task_id    UUID REFERENCES case_tasks(id) ON DELETE SET NULL,
    type       case_notification_intent_type NOT NULL,  -- 7 değer
    actor      VARCHAR(32) NOT NULL CHECK (actor IN ('customer','technician','system')),
    title      VARCHAR(255) NOT NULL,
    body       TEXT,
    route_hint VARCHAR(512),                           -- mobil deep link
    is_new     BOOLEAN NOT NULL DEFAULT TRUE,
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_case_notifications_case_new ON case_notification_intents (case_id) WHERE is_new IS TRUE;
CREATE INDEX ix_case_notifications_actor ON case_notification_intents (actor, is_new, created_at DESC);
```

**Service**: [`case_events.py`](naro-backend/app/services/case_events.py) — `append_event`, `publish_intent`, `mark_intent_read`.

## Event emission hook'ları

Tüm mevcut service'lere (Faz 5 + 6) event emission eklendi:

| Service | Event |
|---|---|
| [case_lifecycle.transition_case_status](naro-backend/app/services/case_lifecycle.py) | status'a göre (`status_update`, `completed`, `cancelled`, `archived`) |
| [offer_acceptance.accept_offer](naro-backend/app/services/offer_acceptance.py) | `offer_accepted` |
| [appointment_flow.approve_appointment](naro-backend/app/services/appointment_flow.py) | `appointment_approved` |
| [appointment_flow.decline_appointment](naro-backend/app/services/appointment_flow.py) | `appointment_declined` |
| [appointment_flow.counter_propose_slot](naro-backend/app/services/appointment_flow.py) | `appointment_counter` |
| [approval_flow.request_approval](naro-backend/app/services/approval_flow.py) | `parts_requested` veya `invoice_shared` |
| [approval_flow.approve](naro-backend/app/services/approval_flow.py) | `parts_approved` / `invoice_approved` |
| [approval_flow.reject](naro-backend/app/services/approval_flow.py) | `parts_rejected` vs. |
| [evidence.add_evidence_to_case](naro-backend/app/services/evidence.py) | `evidence_added` |
| [evidence.add_document_to_case](naro-backend/app/services/evidence.py) | `document_added` |
| [messaging.post_message](naro-backend/app/services/messaging.py) | `message` (system mesajı hariç) |

## FK cascade matrisi (Faz 7)

| Parent → Child | OnDelete |
|---|---|
| service_cases → case_milestones | CASCADE |
| service_cases → case_tasks | CASCADE |
| case_milestones → case_tasks.milestone_id | CASCADE |
| service_cases → case_approvals | CASCADE |
| users (requested_by) → case_approvals | SET NULL + snapshot_name |
| case_approvals → case_approval_line_items | CASCADE |
| service_cases → case_evidence_items | CASCADE |
| case_tasks → case_evidence_items.task_id | SET NULL |
| case_milestones → case_evidence_items.milestone_id | SET NULL |
| media_assets → case_evidence_items.media_asset_id | SET NULL |
| service_cases → case_documents | CASCADE |
| media_assets → case_documents.media_asset_id | SET NULL |
| service_cases → case_attachments | CASCADE |
| media_assets → case_attachments.media_asset_id | SET NULL |
| service_cases → case_threads | CASCADE |
| case_threads → case_messages | CASCADE |
| service_cases → case_messages | CASCADE |
| users (author) → case_messages | SET NULL |
| case_messages → case_message_attachments | CASCADE |
| media_assets → case_message_attachments | CASCADE |
| service_cases → case_events | CASCADE |
| users (actor) → case_events | SET NULL |
| service_cases → case_notification_intents | CASCADE |
| case_tasks → case_notification_intents.task_id | SET NULL |
| case_approvals ↔ case_evidence_items M:N | CASCADE her iki taraf |
| case_tasks ↔ case_evidence_items M:N | CASCADE her iki taraf |

## Kod dosyaları (Faz 7 sonu)

- [app/models/case_process.py](naro-backend/app/models/case_process.py)
- [app/models/case_artifact.py](naro-backend/app/models/case_artifact.py)
- [app/models/case_communication.py](naro-backend/app/models/case_communication.py)
- [app/models/case_audit.py](naro-backend/app/models/case_audit.py)
- [app/schemas/case_process.py](naro-backend/app/schemas/case_process.py)
- [app/services/workflow_seed.py](naro-backend/app/services/workflow_seed.py)
- [app/services/approval_flow.py](naro-backend/app/services/approval_flow.py)
- [app/services/evidence.py](naro-backend/app/services/evidence.py)
- [app/services/messaging.py](naro-backend/app/services/messaging.py)
- [app/services/case_events.py](naro-backend/app/services/case_events.py)
- alembic: 0010 core + 0011 artifacts + 0012 communication + 0013 audit

**Faz 7 sonu toplam tablo:** 15 (V1+Faz6) + 14 (Faz 7) = **29 tablo**.

## V2 kapsam dışı (Faz 8+)

- Mobil engine refactor (backend API'ye bağlanma)
- Push/SMS notification delivery (`case_notification_intents` → outbox + delivery job)
- Insurance claim (Faz 8)
- Review + campaign (Faz 10)
- KVKK retention cron (case_events 2 yıl, soft delete zinciri — Faz 15)
- tsvector full-text search (Faz 13)
