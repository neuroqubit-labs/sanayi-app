# Çekici Backend Mimarisi — Uçtan Uca

> **Sahibi:** PRODUCT-OWNER · **Uygulayıcı:** BACKEND-DEV
> **Güncel:** 2026-04-21 · PO altyapı kararları baked-in.
> **Kardeş doc:** [cekici-modu-urun-spec.md](cekici-modu-urun-spec.md) — ürün + UX bakış açısı. Bu doc teknik implementasyon.

---

## 0. Executive summary

Çekici backend'i iki modu (Hemen = auto-dispatch, Randevulu = bidding) **tek data omurgası** üzerinde yaşatır: `service_cases` (kind='towing') + 4 tow-özel tablo + mevcut offer/appointment tabloları. Hemen mod için `tow_dispatch_service` (aday-arama, accept-window, fallback) + realtime GPS stream (WebSocket + Redis pub/sub). Payment **Iyzico pre-auth + capture** pattern'inde (K-P1). Map/geocoding **Mapbox** (K-P2). Live stream **native FastAPI WebSocket + Redis pub/sub** (K-P3). Kasko V1 manuel operasyon ([cekici-modu-urun-spec.md §10.4](cekici-modu-urun-spec.md)).

---

## 1. PO altyapı kararları (baked-in)

**K-P1 — Payment provider: Iyzico.** Sebep: TR pazar liderliği, native Türkçe dokümantasyon, mobile SDK mature, pre-auth + capture + partial refund native, yerel banka rail'leri (Vakıfbank, Ziraat, İş...) tamamen desteklenir. Abstraksiyon katmanı üzerinden Stripe/Param'a geçilebilir (`app/integrations/psp/base.py` interface).

**K-P2 — Map + geocoding: Mapbox.** Sebep: fiyat öngörülebilir (pay-per-request vs Google'un milestone paketleri), custom style Naro markasına uyar, OSM veri + TR ticari tile karışımı kapsamı yeter, native iOS/Android SDK'sı olgun, geocoding + directions + matrix API'leri tek hesap. Google Maps fallback: sadece directions API (trafik kalitesi için) opsiyonel ikinci katman. Apple Maps kapsam dışı (Android'de yok).

**K-P3 — Realtime katman: FastAPI WebSocket + Redis pub/sub.** Sebep: mevcut stack'te Redis zaten var (ARQ için), Firebase dependency lock-in riski + ek maliyet, FastAPI WebSocket native. Horizontal scaling için Redis pub/sub channel `tow:location:{case_id}`.

**K-P4 — GPS stream sıklığı: 5 sn.** Hareket halinde 5 sn; stationary (< 2 m hareket) ise backoff 15 sn. Battery-conscious — çekicinin iş saatleri uzun.

**K-P5 — OTP mekanizması: 6 hane numerik, sunucu-üretimli, SMS + in-app göster, 10 dk TTL, 3 yanlış deneme → yeni OTP zorunlu.** Audit log: `tow_otp_events`.

---

## 2. Mimari bileşenler

```
            ┌───────────────────────────────────────────────┐
            │            CLIENT (mobil)                      │
            │ ┌──────────────┐  ┌──────────────────────┐   │
            │ │ naro-app      │  │ naro-service-app     │   │
            │ │ (müşteri)     │  │ (çekici)             │   │
            │ └──────┬───────┘  └──────┬───────────────┘   │
            └────────┼─────────────────┼────────────────────┘
                     │ REST + WS       │ REST + WS + GPS push
                     ▼                 ▼
            ┌────────────────────────────────────────────────┐
            │         FastAPI app                             │
            │                                                  │
            │ ┌──────────────┐   ┌──────────────────────┐    │
            │ │ REST routes   │   │ WebSocket /ws/tow/:id│   │
            │ │ /tow/*        │   │ (customer + tech)    │    │
            │ └──────┬───────┘   └───────┬──────────────┘    │
            │        │                   │                     │
            │ ┌──────▼─────────────┐     │                     │
            │ │ tow_dispatch       │     │                     │
            │ │ tow_payment        │◄────┼────── Iyzico SDK    │
            │ │ tow_lifecycle      │     │        (K-P1)       │
            │ │ tow_location       │◄────┘                     │
            │ │ tow_evidence       │                           │
            │ └──────┬─────────────┘                           │
            │        │                                         │
            │ ┌──────▼───────────┐   ┌──────────────────┐     │
            │ │ Repositories      │   │ Integrations    │      │
            │ │ (async SQLAlchemy)│   │ - Iyzico (PSP)  │      │
            │ └──────┬────────────┘   │ - Mapbox (K-P2) │      │
            │        │                │ - Notify (push) │      │
            └────────┼────────────────┴──────┬──────────┘     │
                     ▼                       │                 │
            ┌─────────────────┐              │                 │
            │  PostgreSQL 16   │              │                 │
            │                  │              │                 │
            │ service_cases    │              │                 │
            │ tow_dispatch_*   │              │                 │
            │ tow_live_*       │              │                 │
            │ tow_fare_*       │              │                 │
            │ tow_cancellations│              │                 │
            └──────────────────┘              │                 │
                     ▲                       │                 │
                     │                 ┌─────▼─────────────┐    │
                     │                 │  Redis 7           │   │
                     │                 │ - pub/sub (K-P3)   │   │
                     │                 │ - ARQ queue        │   │
                     │                 │ - OTP cache        │   │
                     │                 │ - rate-limit       │   │
                     │                 └────────────────────┘   │
                     │                          ▲                │
            ┌────────┴──────────────────────────┴───────────┐   │
            │   ARQ workers                                   │   │
            │ - tow_dispatch_loop (per-case)                  │   │
            │ - tow_scheduled_reminder                        │   │
            │ - tow_location_retention_purge                  │   │
            │ - tow_fare_reconcile                            │   │
            │ - tow_no_show_enforcer                          │   │
            └──────────────────────────────────────────────┘    │
```

**Ana bileşenler:**

1. **REST router** — CRUD + action endpoint'leri, auth middleware behind all
2. **WebSocket router** — customer + technician subscribe/broadcast
3. **5 core servis modülü** — dispatch, payment, lifecycle, location, evidence
4. **PSP integration** — Iyzico client (abstraksiyon `PaymentProvider` base)
5. **Map integration** — Mapbox client (geocoding + distance matrix + directions)
6. **Notify integration** — push notification (FCM) + SMS (mevcut SMS servisi)
7. **ARQ workers** — 5 async job
8. **Redis** — pub/sub + ARQ + ephemeral cache (OTP) + rate-limit
9. **Postgres** — authoritative state (mevcut + 4 yeni tow-özel tablo)

---

## 3. Veri modeli (tam DDL)

### 3.1 Enum'lar

```sql
CREATE TYPE tow_service_mode AS ENUM ('immediate', 'scheduled');

CREATE TYPE tow_vehicle_equipment AS ENUM (
    'flatbed', 'hook', 'wheel_lift', 'heavy_duty', 'motorcycle'
);

CREATE TYPE tow_incident_reason AS ENUM (
    'not_running', 'accident', 'flat_tire', 'battery',
    'fuel', 'locked_keys', 'stuck', 'other'
);

CREATE TYPE tow_dispatch_stage AS ENUM (
    'searching',
    'accepted',
    'en_route',
    'nearby',
    'arrived',
    'loading',
    'in_transit',
    'delivered',
    'cancelled',
    'timeout_converted_to_pool'
);

CREATE TYPE tow_dispatch_attempt_response AS ENUM (
    'pending', 'accepted', 'declined', 'timeout'
);

CREATE TYPE tow_cancellation_actor AS ENUM ('customer', 'technician', 'system');

CREATE TYPE tow_fare_settlement_state AS ENUM (
    'preauth_requested',
    'preauth_held',
    'preauth_failed',
    'captured',
    'partial_refunded',
    'full_refunded',
    'kasko_pending_reimbursement',
    'kasko_reimbursed',
    'released_by_cancellation'
);
```

### 3.2 `service_cases` kolon eklemeleri

```sql
ALTER TABLE service_cases
    ADD COLUMN tow_mode             tow_service_mode,
    ADD COLUMN tow_stage             tow_dispatch_stage,
    ADD COLUMN pickup_lat            NUMERIC(9,6),
    ADD COLUMN pickup_lng            NUMERIC(9,6),
    ADD COLUMN dropoff_lat           NUMERIC(9,6),
    ADD COLUMN dropoff_lng           NUMERIC(9,6),
    ADD COLUMN scheduled_at          TIMESTAMPTZ,
    ADD COLUMN tow_required_equipment tow_vehicle_equipment,
    ADD COLUMN tow_incident_reason   tow_incident_reason;

-- Consistency: tow kolonları sadece kind='towing' case'lerde dolu olabilir
ALTER TABLE service_cases
    ADD CONSTRAINT ck_tow_kind_consistency
    CHECK (
        (kind = 'towing' AND tow_mode IS NOT NULL AND tow_stage IS NOT NULL)
        OR (kind != 'towing' AND tow_mode IS NULL AND tow_stage IS NULL)
    );

-- Aktif tow case'leri için hot feed indexi (müşteri + çekici ekranları)
CREATE INDEX ix_cases_tow_active
    ON service_cases (tow_stage, updated_at DESC)
    WHERE kind = 'towing'
      AND tow_stage NOT IN ('delivered', 'cancelled', 'timeout_converted_to_pool');

-- Scheduled case için zamanlayıcı sorgusu
CREATE INDEX ix_cases_tow_scheduled
    ON service_cases (scheduled_at)
    WHERE kind = 'towing' AND tow_mode = 'scheduled' AND tow_stage = 'searching';
```

### 3.3 `tow_dispatch_attempts`

Hemen modda her denenen çekiciyi + sonucunu log'lar.

```sql
CREATE TABLE tow_dispatch_attempts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
    technician_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    attempt_order       SMALLINT NOT NULL CHECK (attempt_order > 0),
    distance_km         NUMERIC(6,2) NOT NULL,
    eta_minutes         SMALLINT NOT NULL,
    rank_score          NUMERIC(6,4),
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accept_window_seconds SMALLINT NOT NULL DEFAULT 15,
    response            tow_dispatch_attempt_response NOT NULL DEFAULT 'pending',
    responded_at        TIMESTAMPTZ,
    decline_reason      VARCHAR(120),
    UNIQUE (case_id, attempt_order),
    UNIQUE (case_id, technician_id)  -- aynı çekiciye aynı case için 2x deneme yasak
);

CREATE INDEX ix_tow_attempts_case ON tow_dispatch_attempts (case_id, sent_at DESC);
CREATE INDEX ix_tow_attempts_tech_recent ON tow_dispatch_attempts (technician_id, sent_at DESC);
CREATE INDEX ix_tow_attempts_pending ON tow_dispatch_attempts (case_id)
    WHERE response = 'pending';
```

### 3.4 `tow_live_locations`

GPS stream — append-only, rolling retention.

```sql
CREATE TABLE tow_live_locations (
    id             BIGSERIAL PRIMARY KEY,
    case_id        UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
    technician_id  UUID NOT NULL,
    lat            NUMERIC(9,6) NOT NULL,
    lng            NUMERIC(9,6) NOT NULL,
    heading        SMALLINT CHECK (heading BETWEEN 0 AND 359),
    speed_kmh      SMALLINT CHECK (speed_kmh BETWEEN 0 AND 200),
    accuracy_m     SMALLINT,
    captured_at    TIMESTAMPTZ NOT NULL,
    received_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_tow_locations_case_time
    ON tow_live_locations (case_id, captured_at DESC);
```

**Retention:** `tow_location_retention_purge` ARQ cron günde 1x; case `delivered` veya `cancelled` olduktan **30 gün sonra** bu satırlar silinir (KVKK konum hassasiyeti).

### 3.5 `tow_fare_settlements`

Pre-auth + capture + refund + kasko takibi. **Tek kaynak mali doğruluk.**

```sql
CREATE TABLE tow_fare_settlements (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id                  UUID UNIQUE NOT NULL REFERENCES service_cases(id) ON DELETE RESTRICT,
    mode                     tow_service_mode NOT NULL,
    state                    tow_fare_settlement_state NOT NULL DEFAULT 'preauth_requested',

    quote                    JSONB NOT NULL,  -- TowFareQuote snapshot
    preauth_amount           NUMERIC(10,2) NOT NULL CHECK (preauth_amount >= 0),
    preauth_psp_ref          VARCHAR(120),    -- Iyzico paymentId
    preauth_at               TIMESTAMPTZ,
    preauth_expires_at       TIMESTAMPTZ,

    final_amount             NUMERIC(10,2),
    final_captured_at        TIMESTAMPTZ,
    final_psp_ref            VARCHAR(120),

    refund_amount            NUMERIC(10,2) NOT NULL DEFAULT 0,
    refund_psp_ref           VARCHAR(120),
    refund_at                TIMESTAMPTZ,

    platform_commission      NUMERIC(10,2),

    kasko_declared           BOOLEAN NOT NULL DEFAULT FALSE,
    kasko_insurer            VARCHAR(120),
    kasko_policy             VARCHAR(80),
    kasko_reimbursed_amount  NUMERIC(10,2),
    kasko_reimbursed_at      TIMESTAMPTZ,

    cancellation_fee         NUMERIC(10,2) NOT NULL DEFAULT 0,

    currency                 CHAR(3) NOT NULL DEFAULT 'TRY',
    notes                    TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (final_amount IS NULL OR final_amount <= preauth_amount),  -- cap aşılmaz
    CHECK (refund_amount >= 0 AND refund_amount <= preauth_amount)
);

CREATE INDEX ix_tow_settlements_state ON tow_fare_settlements (state, updated_at DESC);
CREATE INDEX ix_tow_settlements_kasko_pending
    ON tow_fare_settlements (kasko_reimbursed_at NULLS FIRST, created_at)
    WHERE kasko_declared = TRUE AND state = 'captured';
```

### 3.6 `tow_cancellations`

```sql
CREATE TABLE tow_cancellations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id          UUID UNIQUE NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
    cancelled_by     tow_cancellation_actor NOT NULL,
    stage_at_cancel  tow_dispatch_stage NOT NULL,
    fee_amount       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
    fee_rationale    VARCHAR(200),
    reason           VARCHAR(200),
    cancelled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_tow_cancellations_time ON tow_cancellations (cancelled_at DESC);
```

### 3.7 `tow_otp_events` (K-P5 audit)

```sql
CREATE TABLE tow_otp_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id       UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
    purpose       VARCHAR(32) NOT NULL,  -- 'pickup' | 'delivery'
    issued_to_user_id UUID NOT NULL,     -- customer or recipient
    code_hash     VARCHAR(120) NOT NULL, -- bcrypt/argon2 of OTP
    issued_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at    TIMESTAMPTZ NOT NULL,
    verified_at   TIMESTAMPTZ,
    failed_attempts SMALLINT NOT NULL DEFAULT 0,
    superseded_by UUID REFERENCES tow_otp_events(id),  -- yeni OTP üretildi
    CHECK (failed_attempts <= 3)
);

CREATE INDEX ix_tow_otp_case_purpose
    ON tow_otp_events (case_id, purpose, issued_at DESC)
    WHERE verified_at IS NULL;
```

**Redis cache** (hot OTP lookup için): `tow_otp:{case_id}:{purpose}` → OTP plaintext, TTL = 10 dk. DB kaydı audit; Redis hızlı verify.

### 3.8 `tow_live_sessions` (WebSocket subscriber audit — opsiyonel)

```sql
CREATE TABLE tow_live_sessions (
    id            BIGSERIAL PRIMARY KEY,
    case_id       UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL,
    role          VARCHAR(16) NOT NULL,  -- 'customer' | 'technician' | 'admin'
    connected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    disconnected_at TIMESTAMPTZ,
    client_info   VARCHAR(200)  -- user-agent
);

CREATE INDEX ix_tow_live_sessions_case_active
    ON tow_live_sessions (case_id, connected_at DESC)
    WHERE disconnected_at IS NULL;
```

---

## 4. Shared contract (Zod ↔ Pydantic paralel)

Zod şemaları: [packages/domain/src/tow.ts](../packages/domain/src/tow.ts) ([cekici-modu-urun-spec.md §7](cekici-modu-urun-spec.md)).

Pydantic karşılığı: `naro-backend/app/schemas/tow.py`.

Isim + alan 1:1 paralel olmalı. Zod ekledikten sonra Pydantic'te aynı alan listesi + aynı default'lar + aynı constraint'ler. Test: `tests/integration/test_schema_parity.py` — JSON serialize edilmiş bir Python nesnesi TypeScript tarafında parse edilebilmeli (snapshot fixture).

Ana şemalar:
- `TowServiceMode` enum
- `TowVehicleEquipment` enum
- `TowIncidentReason` enum
- `TowDispatchStage` enum
- `TowFareQuote`
- `TowLiveLocation`
- `TowKaskoDeclaration`
- `TowRequest`
- Ek (backend-özel, frontend tüketmez ama admin tool okur): `TowDispatchAttemptSnapshot`, `TowFareSettlementSnapshot`

---

## 5. SQLAlchemy modelleri

Dosya: `naro-backend/app/models/tow.py` (yeni).

```python
from sqlalchemy import (
    CheckConstraint, Column, DateTime, Enum, ForeignKey, Index,
    Numeric, SmallInteger, String, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import Base

class TowDispatchAttempt(Base):
    __tablename__ = "tow_dispatch_attempts"
    # id, case_id, technician_id, attempt_order, distance_km, eta_minutes,
    # rank_score, sent_at, accept_window_seconds, response, responded_at,
    # decline_reason
    # + relationships: case, technician
    __table_args__ = (
        UniqueConstraint("case_id", "attempt_order"),
        UniqueConstraint("case_id", "technician_id"),
        Index("ix_tow_attempts_pending", "case_id",
              postgresql_where="response = 'pending'"),
    )

class TowLiveLocation(Base):
    __tablename__ = "tow_live_locations"
    # ...

class TowFareSettlement(Base):
    __tablename__ = "tow_fare_settlements"
    # quote: JSONB
    # relationships: case (1:1)

class TowCancellation(Base):
    __tablename__ = "tow_cancellations"
    # ...

class TowOtpEvent(Base):
    __tablename__ = "tow_otp_events"
    # ...

class TowLiveSession(Base):
    __tablename__ = "tow_live_sessions"
    # opsiyonel — fazla overhead olursa log dosyasına iner
```

`service_cases` modeline kolon eklenir ([app/models/case.py](../naro-backend/app/models/case.py)).

---

## 6. Repository layer

Dosya: `naro-backend/app/repositories/tow.py`.

```python
class TowDispatchAttemptRepo:
    async def create(self, session, case_id, technician_id, attempt_order, ...) -> TowDispatchAttempt
    async def record_response(self, session, attempt_id, response, decline_reason=None) -> None
    async def list_for_case(self, session, case_id) -> list[TowDispatchAttempt]
    async def has_pending(self, session, case_id) -> bool

class TowLiveLocationRepo:
    async def insert(self, session, case_id, technician_id, lat, lng, ...) -> None
    async def latest(self, session, case_id) -> TowLiveLocation | None
    async def purge_delivered_older_than(self, session, cutoff: datetime) -> int

class TowFareSettlementRepo:
    async def get_by_case(self, session, case_id) -> TowFareSettlement | None
    async def create_preauth_request(self, session, case_id, mode, quote, preauth_amount) -> TowFareSettlement
    async def mark_preauth_held(self, session, settlement_id, psp_ref, expires_at) -> None
    async def mark_preauth_failed(self, session, settlement_id, notes) -> None
    async def capture(self, session, settlement_id, final_amount, commission, psp_ref) -> None
    async def refund(self, session, settlement_id, amount, psp_ref, reason) -> None
    async def mark_kasko_reimbursed(self, session, settlement_id, amount) -> None
    async def list_kasko_pending(self, session, older_than_days=0) -> list[TowFareSettlement]

class TowCancellationRepo:
    async def record(self, session, case_id, by, stage, fee, reason) -> TowCancellation

class TowOtpRepo:
    async def issue(self, session, case_id, purpose, user_id, code_hash, ttl_seconds=600) -> TowOtpEvent
    async def verify(self, session, case_id, purpose, plain_code) -> bool  # Redis-first, DB audit
    async def increment_failed(self, session, otp_id) -> int
```

Tüm repo fonksiyonları **session parametresi alır**; transaction sorumluluğu service layer'da.

---

## 7. Service layer

5 servis modülü, her biri tek sorumluluk.

### 7.1 `app/services/tow_dispatch.py`

```python
async def create_immediate_tow_case(
    customer_id: UUID, request: TowRequest,
) -> ServiceCase:
    """Hemen mod case açar.
    
    1. Validate: customer aracı sahibi mi, required_equipment tutarlı mı
    2. Candidate pre-check: pickup_lat_lng radius 10km içinde uygun çekici var mı (quick count); yoksa 400
    3. TowFareQuote hesapla (estimator) → cap_amount
    4. PSP pre-auth: preauth_amount = cap_amount; psp.authorize(preauth_amount)
    5. preauth başarılıysa ServiceCase create (kind='towing', tow_mode='immediate', tow_stage='searching')
    6. ARQ enqueue: dispatch_loop(case_id)
    7. Return case
    """

async def create_scheduled_tow_case(
    customer_id: UUID, request: TowRequest,
) -> ServiceCase:
    """Randevulu mod case açar.
    
    1. Validate scheduled_at >= now + 2h AND <= now + 90d
    2. ServiceCase create (tow_mode='scheduled', tow_stage='searching')
    3. Havuz notification → uygun çekicilere push (CEKICI provider_type)
    4. ARQ enqueue: scheduled_reminder(case_id, at=scheduled_at - 1h)
    5. Return case — bidding 30dk açık
    """

async def run_dispatch_loop(case_id: UUID) -> None:
    """ARQ worker entry — immediate case için adayları sırayla dener.
    
    Toplam timeout: 180 sn.
    Her iterasyonda:
      - get_next_candidate() — bkz. §11 dispatch algoritması
      - TowDispatchAttempt create
      - Push notif çekiciye (deep link accept sheet)
      - 15 sn bekle (asyncio.wait_for) — accept event beklenir (Redis pub/sub)
      - accept → tow_stage='accepted', assigned_technician_id set, loop exit
      - decline/timeout → response kaydet, bir sonraki aday
    
    180 sn sonunda hala match yok:
      - tow_stage = 'timeout_converted_to_pool'
      - Müşteriye push: "Havuza açalım mı?" action notification
      - Müşteri kabul ederse scheduled akışa döner (tow_mode='scheduled')
      - Reddederse ServiceCase cancelled (fee=0)
    """

async def record_accept(case_id: UUID, technician_id: UUID) -> bool:
    """Çekici accept → atomic: ilk kabul eden kazanır.
    
    SELECT attempt FOR UPDATE SKIP LOCKED:
      - pending attempt var ve technician_id eşit mi → response='accepted'
      - Değilse — başka attempt zaten kabul olmuş veya süre geçmiş → False
    True dönünce: Redis pub/sub publish(tow:accept:{case_id})
    """

async def record_decline(case_id: UUID, technician_id: UUID, reason: str) -> None:
    """Çekici decline — attempt.response='declined'. Loop sonraki aday."""

async def get_next_candidate(case_id: UUID, already_tried: set[UUID], radius_km: float) -> UUID | None:
    """Dispatch algoritması (§11).
    
    SQL + Python blend:
      - Postgres circle index ile radius içinde provider_type='cekici' + available + equipment ⊇ required + admission_gate=true
      - already_tried set'ini çıkar
      - Python ranking: distance + rating + response_time + accept_rate + equipment_premium + fairness + evidence
      - En yüksek ranked döner
    """
```

### 7.2 `app/services/tow_lifecycle.py`

State machine enforcement.

```python
ALLOWED_TOW_TRANSITIONS: dict[TowDispatchStage, set[TowDispatchStage]] = {
    SEARCHING: {ACCEPTED, TIMEOUT_CONVERTED, CANCELLED},
    ACCEPTED: {EN_ROUTE, CANCELLED},
    EN_ROUTE: {NEARBY, CANCELLED},
    NEARBY: {ARRIVED, CANCELLED},
    ARRIVED: {LOADING, CANCELLED},
    LOADING: {IN_TRANSIT},  # cancel kapalı — araç yüklendi
    IN_TRANSIT: {DELIVERED},
    DELIVERED: set(),
    CANCELLED: set(),
    TIMEOUT_CONVERTED: set(),  # mode değişimi ayrı transaction
}

async def transition(
    case_id: UUID,
    from_stage: TowDispatchStage,
    to_stage: TowDispatchStage,
    actor: CaseActor,
    evidence: dict | None = None,  # foto refs, OTP code
) -> None:
    """Atomic transition:
    1. SELECT ... FOR UPDATE → current stage == from_stage kontrolü
    2. Evidence zorunluluk kontrolü (bkz. §11 trust ledger zorunluluğu)
    3. UPDATE tow_stage
    4. CaseEvent insert (timeline)
    5. Push + WS publish
    6. Special actions:
       - to=ARRIVED: OTP issue (pickup)
       - to=LOADING: OTP verify + pickup photo required
       - to=DELIVERED: OTP issue (delivery) + final photo + finalize fare
    """

async def record_arrival(case_id: UUID, technician_id: UUID, arrival_photo_id: UUID) -> None:
    """transition(NEARBY|EN_ROUTE → ARRIVED) + OTP üret + müşteriye SMS+push."""

async def confirm_pickup(
    case_id: UUID, technician_id: UUID, pickup_photos: list[UUID], otp_code: str,
) -> None:
    """OTP verify + photos evidence register + transition(ARRIVED → LOADING → IN_TRANSIT atomik)."""

async def confirm_delivery(
    case_id: UUID, technician_id: UUID, delivery_photo_id: UUID, recipient_otp: str,
) -> None:
    """Delivery OTP verify + photo register + transition(IN_TRANSIT → DELIVERED) + finalize fare."""

async def cancel(case_id: UUID, by: CaseActor, reason: str | None) -> TowCancellation:
    """İptal workflow:
    1. Mevcut stage tespit
    2. Fee hesapla (compute_cancellation_fee)
    3. TowCancellation insert
    4. TowFareSettlement state güncelle (preauth release or partial capture for fee)
    5. Case status/stage = CANCELLED
    6. WS publish + push
    """

def compute_cancellation_fee(
    mode: TowServiceMode, stage: TowDispatchStage, scheduled_at: datetime | None,
) -> Decimal:
    """K-4 tablosundan (bkz. cekici-modu-urun-spec.md §2)."""
```

### 7.3 `app/services/tow_payment.py`

```python
async def authorize_preauth(
    case_id: UUID, amount: Decimal, customer_id: UUID,
) -> TowFareSettlement:
    """Iyzico pre-auth çağrısı:
    1. TowFareSettlement insert (state='preauth_requested')
    2. psp.authorize(amount, customer_card_token, metadata={case_id})
    3. Başarılı → state='preauth_held', preauth_psp_ref, preauth_expires_at
    4. Başarısız → state='preauth_failed' + raise PaymentError
    """

async def finalize_and_capture(case_id: UUID) -> None:
    """Delivery sonrası:
    1. Real distance → actual_amount
    2. final = min(actual_amount, cap)  # cap aşılmaz
    3. commission = final * 0.10
    4. psp.capture(preauth_psp_ref, final)
    5. TowFareSettlement update (state='captured', final_amount, commission)
    6. preauth > final ise fark otomatik psp refund (partial)
    7. kasko_declared ise:
       - state='kasko_pending_reimbursement'
       - Operations queue: ticket oluştur (app/services/kasko_ops.py kuyruğa)
       - Kullanıcıya SMS: "Fatura kaskoya ibraz edin..."
       - Yine de final capture edildi — ödeme müşteri kartından; iade sonra
    """

async def apply_cancellation_fee(case_id: UUID, fee: Decimal) -> None:
    """İptal sonrası pre-auth management:
    - fee = 0 → psp.release(preauth_psp_ref) (hold bırak)
    - fee > 0 → psp.capture(preauth_psp_ref, fee) + refund diff
    """

async def reimburse_from_kasko(case_id: UUID, kasko_amount: Decimal) -> None:
    """Operations ekibi kasko'dan tahsilat yaptı — müşteri kartına iade:
    1. psp.refund(final_psp_ref, kasko_amount)
    2. TowFareSettlement state='kasko_reimbursed', kasko_reimbursed_amount
    """
```

### 7.4 `app/services/tow_location.py`

```python
async def record_live_location(
    case_id: UUID, technician_id: UUID,
    lat: float, lng: float, heading: int | None, speed: int | None,
    captured_at: datetime,
) -> None:
    """1. Validate: case var, stage ∈ {accepted, en_route, nearby, arrived, loading, in_transit}
       2. TowLiveLocation insert
       3. Redis publish(tow:location:{case_id}, TowLiveLocation JSON)
       4. Proximity check: dropoff yakın (< 500m) + stage=in_transit → auto-suggest "nearby_dropoff" frontend event
       5. Pickup yakın (< 500m) + stage=en_route → transition en_route → nearby (soft)
    """

async def get_latest_location(case_id: UUID) -> TowLiveLocation | None:
    """Önce Redis cache, yoksa DB."""

async def compute_actual_distance_km(case_id: UUID) -> Decimal:
    """Tüm live_locations segmentleri üzerinden haversine integral.
       Fallback: pickup_lat_lng → dropoff_lat_lng haversine (düz hat)."""
```

### 7.5 `app/services/tow_evidence.py`

```python
async def register_evidence(
    case_id: UUID, actor: CaseActor, stage: TowDispatchStage,
    media_asset_ids: list[UUID],
) -> None:
    """CaseAttachment'lara bağla + evidence_discipline_score hesaplamasına input ver.
       Kural (bkz. cekici-modu-urun-spec.md §11):
         - arrival: çekici'den min 1 foto
         - loading: çekici'den min 2 foto + müşteri OTP
         - delivery: çekici'den min 1 foto + recipient OTP
       Eksikse transition bloke edilir.
    """

async def issue_otp(case_id: UUID, purpose: Literal["pickup", "delivery"], to_user: UUID) -> str:
    """6-hane numeric OTP üret:
       1. TowOtpEvent insert (code_hash, expires_at=+10dk)
       2. Redis SET tow_otp:{case_id}:{purpose} = plain_code, EX 600
       3. SMS + push müşteriye (pickup) veya teslim alana (delivery)
       4. plain_code return (çekici ekranında GÖSTERILMEZ; çekici sorar)
    """

async def verify_otp(case_id: UUID, purpose: str, submitted_code: str) -> bool:
    """Redis-first verify:
       1. GET tow_otp:{case_id}:{purpose}
       2. Compare (constant-time)
       3. Match → OtpEvent verified_at = NOW, Redis DEL → True
       4. Mismatch → OtpEvent failed_attempts++; 3+ → invalidate + superseded_by = issue yeni → False
    """
```

---

## 8. REST API

Base prefix: `/api/v1/tow`. Auth: mevcut JWT middleware ([app/api/v1/deps.py](../naro-backend/app/api/v1/deps.py)). Role kontrol her endpoint'te.

| Method | Path | Role | Body (in) | Response |
|---|---|---|---|---|
| POST | `/estimate` | customer | `{pickup_lat_lng, dropoff_lat_lng?, incident_reason, vehicle_id}` | `TowFareQuote` (pre-auth yok) |
| POST | `/request` | customer | `TowRequest` (mode='immediate') | `{case_id, tow_stage, settlement_id}` |
| POST | `/schedule` | customer | `TowRequest` (mode='scheduled', scheduled_at required) | `{case_id}` |
| GET | `/{case_id}/status` | customer or assigned technician | — | `{stage, match?: TechSnapshot, eta?, fare: TowFareQuote, last_location?: LatLng}` |
| POST | `/{case_id}/cancel` | customer or technician | `{reason?}` | `{cancellation_fee, refund_amount, state}` |
| POST | `/{case_id}/convert-to-pool` | customer | — | `{case_id, new_mode: 'scheduled'}` (timeout sonrası) |
| POST | `/{case_id}/accept` | technician | — | `{accepted: bool}` (race; sadece ilk kazanır) |
| POST | `/{case_id}/decline` | technician | `{reason?}` | `{accepted: false}` |
| POST | `/{case_id}/stage/en-route` | technician | — | `{stage}` |
| POST | `/{case_id}/stage/arrived` | technician | `{arrival_photo_asset_id}` | `{stage, otp_required: true}` |
| POST | `/{case_id}/stage/loading` | technician | `{pickup_photo_asset_ids: [], pickup_otp: "######"}` | `{stage}` |
| POST | `/{case_id}/stage/delivered` | technician | `{delivery_photo_asset_id, delivery_otp: "######"}` | `{stage, fare_captured_at, final_amount}` |
| POST | `/{case_id}/location` | technician | `TowLiveLocation` (case_id server-derived) | `{accepted: bool}` |
| POST | `/{case_id}/customer-damage-photos` | customer | `{asset_ids: []}` (pre-dispatch) | `{registered: count}` |
| GET | `/technician/feed` | technician | `?cursor=&limit=20` | Pool: pending/scheduled tow cases (provider_type=cekici aday) |
| POST | `/admin/{case_id}/reimburse-kasko` | admin | `{amount}` | `{refund_psp_ref, state}` |

**Rate limit (Redis token bucket):**
- `/request` + `/schedule`: 5 / 1 dakika / customer_id
- `/location`: 60 / 1 dakika / technician_id (12 per-case bracket ≈ 5sn)
- `/accept` + `/decline`: 100 / 1 dakika / technician_id (spam protection)
- Read endpoint'leri: 600 / 1 dakika

**Hata yanıtları:** `app/api/v1/errors.py` pattern; `422 ValidationError`, `409 ConflictingStateError` (state machine ihlali), `402 PaymentRequired` (PSP pre-auth fail), `410 AlreadyAcceptedByOther` (accept race'de kaybetmek).

---

## 9. WebSocket protokolü

**Endpoint:** `WS /ws/tow/{case_id}`

**Authz:** WS connect query param `?token=<jwt>`. Middleware: user, case'e erişim izin mi (customer_id veya assigned_technician_id veya admin).

**Ayrıca:** TowLiveSession insert (connect), disconnect'te update.

### 9.1 Server → Client mesajları

Tümü JSON, `type` alanı ile discriminator.

```typescript
type TowWsMessage =
  | { type: "stage_changed", stage: TowDispatchStage, actor: CaseActor, at: string }
  | { type: "match_found", technician: TechSnapshot, eta_minutes: number }
  | { type: "location_update", location: TowLiveLocation }
  | { type: "dispatch_attempt_sent", attempt_order: number, remaining_seconds: number }
  | { type: "convert_to_pool_offered" }
  | { type: "otp_required", purpose: "pickup" | "delivery" }
  | { type: "evidence_missing", required: string[] }
  | { type: "fare_finalized", final_amount: number, refund_amount: number }
  | { type: "cancelled", by: TowCancellationActor, fee: number }
  | { type: "error", code: string, message: string };
```

### 9.2 Client → Server mesajları

Minimum — REST ile tamamlanır.

```typescript
type TowWsClientMessage =
  | { type: "ping" }
  | { type: "resume_from", at: string };  // reconnect senkron
```

**Note:** GPS push **REST** üzerinden (`POST /location`). WebSocket sadece fan-out. Sebep: REST retry + idempotent daha basit; WS connection drop'unda GPS kaybı olmaz.

### 9.3 Pub/sub topology

Redis channels:
- `tow:stage:{case_id}` — stage transitions
- `tow:location:{case_id}` — GPS stream
- `tow:match:{case_id}` — match events
- `tow:accept:{case_id}` — dispatch_loop için accept event (internal)
- `tow:cancel:{case_id}` — cancellation

Connection manager ([app/realtime/tow_ws.py](../naro-backend/app/realtime/tow_ws.py)) her connected client için sadece o case'in channel'larına subscribe olur.

---

## 10. ARQ jobs

Dosya: `naro-backend/app/workers/tasks/tow.py` (yeni).

| Task | Trigger | Sıklık | Görev |
|---|---|---|---|
| `tow_dispatch_loop` | on-demand (`create_immediate_tow_case` sonrası enqueue) | 1x / case | Hemen mod dispatch loop (§7.1) |
| `tow_scheduled_reminder` | on-demand (schedule sonrası + scheduled_at - 1h) | — | Çekici ve müşteriye reminder push/SMS; ayrıca - 15 dk önce ikinci reminder |
| `tow_location_retention_purge` | cron | günde 1x (03:00 UTC) | `tow_live_locations`'tan delivered/cancelled + 30g geçmiş case'ler silinir; `tow_live_sessions` 90g + silinir |
| `tow_fare_reconcile` | cron | saatlik | `state='preauth_held'` olup PSP'de capture-beklemede olan settlement'lar — PSP durum check + expiry uyarısı |
| `tow_no_show_enforcer` | on-demand (arrival + 10 dk sonra enqueue) | — | Çekici "vardım" dedi; müşteri OTP vermedi + 45 dk geçti → otomatik cancel (no-show by customer), fee=300 ₺ + yol tazmini |
| `tow_kasko_reminder` | cron | haftada 1x | state='kasko_pending_reimbursement' + 10g geçmiş → operations ekibine Slack bildirim |

Registration: [app/workers/settings.py](../naro-backend/app/workers/settings.py) `cron_jobs` + `functions` listelerine eklenir.

---

## 11. Dispatch algoritması (detaylı pseudocode)

Hemen mod için. Randevulu'da havuz feed sorgusu (Faz 6 offer pattern) yeterli.

```python
async def get_next_candidate(
    case_id: UUID, already_tried: set[UUID], radius_km: float,
) -> Candidate | None:
    case = await case_repo.get(case_id)
    pickup = (case.pickup_lat, case.pickup_lng)

    # Hard filter (SQL, Postgres GIST + filtered WHERE):
    candidates = await db.execute(
        """
        SELECT
          t.id AS technician_id,
          t.bayesian_rating,
          t.response_time_p50_minutes,
          t.accept_rate_30d,
          t.evidence_discipline_score,
          tsa.workshop_lat, tsa.workshop_lng,
          ST_DistanceSphere(
            ST_MakePoint(:pickup_lng, :pickup_lat)::geography,
            ST_MakePoint(tsa.workshop_lng, tsa.workshop_lat)::geography
          ) / 1000.0 AS distance_km,
          tcap.current_queue_depth, tcap.max_concurrent_jobs,
          tbc.is_authorized, tbc.is_premium_authorized,
          tdc.drivetrain_key,
          tmu.count AS mobile_unit_count
        FROM technician_profiles t
          JOIN technician_service_area tsa ON tsa.profile_id = t.id
          JOIN technician_capacity tcap ON tcap.profile_id = t.id
          LEFT JOIN technician_brand_coverage tbc
                 ON tbc.profile_id = t.id AND tbc.brand_key = :vehicle_brand
          LEFT JOIN technician_drivetrain_coverage tdc
                 ON tdc.profile_id = t.id AND tdc.drivetrain_key = :vehicle_drivetrain
          -- equipment beyanı teknisyen profile_equipment tablosunda (Faz 8 öncesi eklenmeli; §Open questions)
          LEFT JOIN technician_performance_snapshots tps
                 ON tps.profile_id = t.id AND tps.window_days = 30
                 AND tps.snapshot_at = (SELECT MAX(snapshot_at) FROM technician_performance_snapshots WHERE profile_id = t.id AND window_days = 30)
        WHERE
          t.provider_type = 'cekici'
          AND t.availability = 'available'
          AND t.admission_gate = TRUE
          AND tcap.current_queue_depth < tcap.max_concurrent_jobs
          AND t.id NOT IN :already_tried
          AND ST_DWithin(
            ST_MakePoint(tsa.workshop_lng, tsa.workshop_lat)::geography,
            ST_MakePoint(:pickup_lng, :pickup_lat)::geography,
            :radius_m
          )
        """,
        pickup_lat=pickup[0], pickup_lng=pickup[1],
        radius_m=radius_km * 1000,
        vehicle_brand=case.vehicle.make_normalized,
        vehicle_drivetrain=case.vehicle.drivetrain,
        already_tried=already_tried or {UUID("00000000-...")},
    )

    if not candidates: return None

    # Soft ranking (Python):
    def score(c):
        dist_score = max(0, 1 - c.distance_km / radius_km)  # 0-1
        rating_score = (c.bayesian_rating or 0) / 5
        response_score = max(0, 1 - (c.response_time_p50_minutes or 60) / 60)
        accept_score = c.accept_rate_30d or 0.5
        equipment_bonus = 0.1 if (
            case.vehicle.brand_tier in ("premium", "luxury")
            and c.is_premium_authorized
        ) else 0
        fairness_bonus = fairness_rotation_bonus(c.technician_id)  # §11.1
        evidence_score = c.evidence_discipline_score or 0.7
        return (
            0.35 * dist_score
            + 0.15 * rating_score
            + 0.15 * response_score
            + 0.15 * accept_score
            + 0.10 * equipment_bonus
            + 0.05 * fairness_bonus
            + 0.05 * evidence_score
        )

    candidates_scored = sorted(candidates, key=score, reverse=True)
    return candidates_scored[0]
```

### 11.1 Fairness rotation bonus

Amaç: starvation engelle — son 24 saatte çok az iş alan çekiciye küçük boost.

```python
def fairness_rotation_bonus(technician_id: UUID) -> float:
    # Son 24h'da accepted iş sayısı
    accepted_24h = count_accepted_attempts(technician_id, since=now - 24h)
    if accepted_24h == 0: return 1.0
    if accepted_24h < 2:   return 0.5
    return 0.0
```

### 11.2 Radius fallback

```
T=0 → radius = 10 km (initial)
T=60s, hala match yok → radius = 25 km
T=120s → radius = 50 km
T=180s → timeout_converted_to_pool
```

Her radius değişiminde `already_tried` reset edilmez — aynı çekiciye 2x deneme yasak.

---

## 12. State machine — tam

```
                ┌─────────────┐
                │  searching   │◄──────────── (create_immediate_tow_case)
                └─────┬──┬─────┘
       accept         │  │            timeout (180s)
         ───          │  │               ───
             ▼        │  └────► timeout_converted_to_pool
        ┌────────┐    │              │
        │accepted│    │              ▼ (user converts) → scheduled mode
        └───┬────┘    │
            │ en_route                  
            ▼                          
        ┌────────┐    
        │en_route │    
        └───┬────┘                     
            │ nearby (proximity <500m, auto)
            ▼                         
        ┌────────┐                    
        │ nearby  │                    
        └───┬────┘                    
            │ arrived (manuel button)
            ▼                          
        ┌────────┐                     
        │arrived  │───── no-show 45dk ─→ cancelled (by=system, fee=300)
        └───┬────┘                     
            │ loading (OTP + photo)
            ▼
        ┌────────┐   
        │ loading │   — CANCELLATION KAPALI (yüklendi)
        └───┬────┘
            │ in_transit (auto post-loading)
            ▼
        ┌─────────┐
        │in_transit│  — CANCELLATION KAPALI
        └───┬─────┘
            │ delivered (OTP + photo + capture)
            ▼
        ┌─────────┐
        │delivered │  TERMINAL
        └─────────┘

        ┌─────────┐
        │cancelled│  TERMINAL (herhangi bir durumdan — loading/in_transit hariç)
        └─────────┘
```

Enforcement: `app/services/tow_lifecycle.py::transition()` — mevcut `case_lifecycle.py` pattern'ini genişletir.

---

## 13. Concurrency + race conditions

### 13.1 Accept race (kritik)

Dispatch_loop çekici A'ya ping atar + çekici B'ye aynı iş için başka bir dispatch_loop ping atmaz (tek attempt_order pending). Ama:

- Çekici A kabul etti + tam o sırada loop timeout → B'ye geçti ve B de kabul etti?

**Çözüm:**
- `UPDATE tow_dispatch_attempts SET response='accepted' WHERE case_id=:c AND response='pending' AND technician_id=:t RETURNING id`
- Etkilenen 0 satır → "already accepted or timed out" → 410 Gone
- `UPDATE service_cases SET tow_stage='accepted', assigned_technician_id=:t WHERE id=:c AND tow_stage='searching'` — yine 0 ise başka birinin kazandığı
- İki update aynı transaction içinde; ikincisi fail ise rollback + attempt.response='lost_race' özel değeri
- Bu pattern **Uber "exclusive lock"** yaklaşımı.

### 13.2 OTP replay

- OTP verify Redis'te başarılı olduktan sonra Redis key DEL edilir. İkinci verify → 410
- OtpEvent.verified_at set sonrası aynı (case, purpose) için yeni issue gerekirse superseded_by zincirlenir

### 13.3 Double-charge defense

- `tow_fare_settlements.case_id UNIQUE` — aynı case 2 settlement olmaz
- `psp.authorize` idempotency key = `preauth:{case_id}` → tekrar çağrı → aynı psp_ref
- `psp.capture` idempotency key = `capture:{settlement_id}`

### 13.4 GPS stream order

- Çekici offline sonra tekrar online → birikmiş location batch gönderir
- Sunucu `captured_at` üzerinden deduplicate (aynı timestamp varsa drop) + latest published sadece en yeni

### 13.5 WS connection drop

- Reconnect sonrası `{type: "resume_from", at: ...}` → sunucu o zamandan sonraki stage event + location snapshot gönderir
- GPS kaybı **REST üzerinden** olduğundan WS drop GPS'i kesmez

---

## 14. PSP entegrasyon abstraksiyonu

Dosya: `naro-backend/app/integrations/psp/base.py`

```python
class PaymentProvider(Protocol):
    async def authorize(self, amount: Decimal, method_token: str,
                        idempotency_key: str, metadata: dict) -> PspAuthResponse: ...
    async def capture(self, auth_ref: str, amount: Decimal,
                      idempotency_key: str) -> PspCaptureResponse: ...
    async def release(self, auth_ref: str) -> None: ...
    async def refund(self, capture_ref: str, amount: Decimal,
                     idempotency_key: str, reason: str) -> PspRefundResponse: ...
    async def get_status(self, auth_ref: str) -> PspStatus: ...
```

Dosya: `naro-backend/app/integrations/psp/iyzico.py` — concrete implementation (K-P1).

Secret config: `IYZICO_API_KEY`, `IYZICO_SECRET` — [naro-backend/app/core/config.py](../naro-backend/app/core/config.py).

Test harness: `tests/fakes/fake_payment_provider.py` — in-memory PSP.

---

## 15. Map / geocoding entegrasyonu

Dosya: `naro-backend/app/integrations/mapbox/client.py` (K-P2).

```python
class MapboxClient:
    async def reverse_geocode(self, lat: float, lng: float) -> Address: ...
    async def forward_geocode(self, query: str) -> list[Address]: ...
    async def distance_matrix(self, origin: LatLng, destinations: list[LatLng]) -> list[Meters]: ...
    async def directions(self, origin: LatLng, dest: LatLng) -> Route: ...
```

Kullanım:
- Reverse geocode: pickup_lat_lng → city, district (otomatik `service_cases.pickup_address` + `city_code` doldurma)
- Distance matrix: dispatch algoritması içinde kısa mesafeli gerçek yol ETA'sı (haversine proxy yerine, ilk 3 adaya)
- Directions: müşteri ekranında çekicinin rota çizgisi

**Caching:** Reverse geocode sonuçları Redis 30g TTL (aynı lat/lng rounded to 4 decimal → aynı key).

**Fallback:** Mapbox down → haversine + static direct line (UI'da "tahmini" badge).

---

## 16. Observability

### 16.1 Metrics (Prometheus)

```
tow_dispatch_attempts_total{case_id, response}
tow_dispatch_accept_latency_seconds{bucket}  # histogram
tow_dispatch_match_time_seconds{bucket}
tow_dispatch_timeout_total
tow_fare_preauth_total{state}
tow_fare_captured_total
tow_fare_captured_amount_try_sum
tow_fare_cap_exceeded_total  # platform absorbe etti
tow_cancellation_total{by, stage}
tow_cancellation_fee_try_sum
tow_kasko_declared_total
tow_kasko_reimbursement_latency_days{bucket}
tow_ws_connections_active{role}
tow_location_ingress_total
tow_otp_issued_total{purpose}
tow_otp_failed_attempts_total
```

### 16.2 Logs (structured JSON)

Her önemli servis çağrısı: `case_id`, `user_id`, `stage`, `outcome`. Özellikle `tow_dispatch` loop her iterasyonu log'lar.

### 16.3 Traces (OpenTelemetry)

Dispatch loop bir span; içinde her attempt ayrı child span. PSP çağrıları ayrı span.

### 16.4 Alerting (kritik)

- `tow_dispatch_timeout_total` rate > %10 / saat → dispatch sağlıksız
- `tow_fare_preauth_total{state="preauth_failed"}` rate > %5 → PSP sorunu
- `tow_ws_connections_active` düşüş > %50 içinde 5dk → realtime outage
- `tow_kasko_reimbursement_latency_days{p95} > 15` → operations gecikiyor

---

## 17. KVKK & retention

| Veri | Saklama | Sonra |
|---|---|---|
| `service_cases` (tow) | Süresiz (muhasebe + dispute) | Customer KVKK silme isteği: pseudonymize customer_user_id, pickup/dropoff koordinatları rounded 2 decimal (~1.1km grid) |
| `tow_live_locations` | Case `delivered`/`cancelled` + **30 gün** | Hard delete (cron `tow_location_retention_purge`) |
| `tow_dispatch_attempts` | 2 yıl | Hard delete |
| `tow_fare_settlements` | Süresiz (KDV muhasebesi — VUK 10 yıl) | Hard delete yok; pseudonymize customer_id |
| `tow_cancellations` | 2 yıl | Hard delete |
| `tow_otp_events` | 90 gün | Hard delete |
| `tow_live_sessions` | 90 gün | Hard delete |

Cron `kvkk_tow_retention_sweep` haftalık — [app/workers/tasks/kvkk.py](../naro-backend/app/workers/tasks/kvkk.py).

---

## 18. Security

- **Auth:** JWT mevcut middleware; her endpoint role + case access check
- **WS auth:** connect query param `token` → middleware decode; yoksa/yanlışsa close(4401)
- **Rate limit:** Redis token bucket (her endpoint için farklı bucket — §8)
- **Input validation:** Pydantic strict mode; lat/lng bounds + numeric overflow
- **OTP brute force:** 3 yanlış → OTP invalidate + yeni issue zorunlu (K-P5)
- **PII:** GPS koordinatları log'lanırken rounded (4 decimal → ~11m) — full precision sadece DB
- **PSP secrets:** env + secret manager (AWS SM veya Docker secret); asla log'lanmaz
- **IDOR defense:** Her endpoint `case.customer_id == current_user.id OR case.assigned_technician_id == current_user.id` kontrolü + admin rolü override
- **CORS:** mobil app origin whitelist

---

## 19. Test stratejisi

### 19.1 Unit (pytest)

- `tow_dispatch::get_next_candidate` — mock data, ranking sıralama doğru mu
- `tow_lifecycle::transition` — forbidden transition → exception
- `tow_payment::finalize_and_capture` — cap aşımı senaryosu (platform yer)
- `compute_cancellation_fee` — 12 kombinasyon (mode × stage × zaman)

### 19.2 Integration (pytest-asyncio + testcontainers)

- Full dispatch loop — fake PSP + fake technicians, accept gelmesi
- Timeout → convert to pool → müşteri kabul akışı
- Accept race — iki paralel accept, ilkinin kazanması
- OTP happy + brute force
- WS subscribe → stage event + location event gelmesi
- GPS retention purge — 30g sonra silinmesi
- Schema parity: TowFareQuote Python JSON ↔ TypeScript Zod parse

### 19.3 Load (locust)

- 1000 eşzamanlı dispatch loop — dispatch latency p95 < 3sn
- 100 WS connection per worker — memory stable
- 5000 location POST/sn — DB insert + Redis publish sürdürülebilir

### 19.4 E2E (staging)

- Müşteri → request → match → arrival → loading → delivery → capture → fatura görünüyor
- Kasko flag'li senaryo — capture + SMS + operations ticket

---

## 20. Migration sırası

```
0012_tow_enums.py                 # brand_tier vs değil — tow_* enumlar
0013_tow_service_cases_cols.py    # ALTER service_cases ADD ...
0014_tow_tables.py                # 4+1 yeni tablo
0015_tow_indexes_gist.py          # GIST + partial index'ler (ayrı migration — index build uzun)
```

Idempotent up/down; `0015_tow_indexes_gist` `CONCURRENTLY` ile build (migration timeout uzun ayarı).

PostgreSQL extension gereksinimleri:
- `postgis` — ST_DistanceSphere, ST_MakePoint, ST_DWithin (zorunlu)
- `pgcrypto` — UUID gen (zaten var)

`postgis` yoksa alternatifler:
- `ST_DWithin` yerine haversine SQL function (biraz yavaş ama accept)
- GIST circle index yerine B-tree composite (daha büyük pool scan)

**PO kararı:** PostGIS kurulur. V1'den itibaren tow için şart. BACKEND-DEV docker-compose + Alembic için extension `CREATE EXTENSION IF NOT EXISTS postgis` eklesin.

---

## 21. Faz 8/9 deliverable checklist

### Faz 8 — Tow backend V1 (minimum viable)

- [ ] PostGIS + pgcrypto extension kuruldu
- [ ] Migration 0012-0015 green (up + down + up)
- [ ] SQLAlchemy modelleri + repository
- [ ] Pydantic şemaları (Zod parity test)
- [ ] `tow_dispatch` servisi + ARQ `tow_dispatch_loop` worker
- [ ] `tow_lifecycle` servisi + state machine enforcement
- [ ] `tow_payment` servisi + Iyzico integration + fake PSP test harness
- [ ] `tow_location` servisi + basit REST POST (WS Faz 9'a)
- [ ] `tow_evidence` servisi + OTP (Redis cache)
- [ ] 14 REST endpoint + rate limit
- [ ] Mapbox reverse geocode entegrasyonu (pickup address)
- [ ] ARQ cron: `tow_location_retention_purge`, `tow_scheduled_reminder`, `tow_no_show_enforcer`, `tow_fare_reconcile`
- [ ] pytest coverage ≥ %80
- [ ] Prometheus metric'ler yayında
- [ ] Dokümantasyon: [docs/cekici-backend-mimarisi.md](cekici-backend-mimarisi.md) (bu doc) güncel + [docs/veri-modeli/KARAR-LOG.md](veri-modeli/KARAR-LOG.md) Faz 8 girişi

### Faz 9 — Tow backend V2

- [ ] WebSocket endpoint `/ws/tow/{case_id}` + connection manager + Redis pub/sub
- [ ] Mapbox distance_matrix + directions entegrasyonu
- [ ] Kasko operasyonu workflow (BD ile koordine) — ticket queue + `tow_kasko_reminder` cron
- [ ] Advanced fraud checks: GPS tutarsızlık, çekici işaretlediği ama GPS'i göstermediği vardı
- [ ] Load test + p95 SLO'lar

---

## 22. Açık sorular (BACKEND-DEV'e)

1. **Technician equipment declaration tablosu:** Faz 7 [docs/veri-modeli/16-technician-sinyal-modeli.md](veri-modeli/16-technician-sinyal-modeli.md) çekici için `technician_capacity` + `technician_brand_coverage` var; ama **`technician_tow_equipment`** (flatbed/hook/wheel-lift/...) ayrı tablo mı yoksa `technician_drivetrain_coverage` gibi basit N:M mi? Öneri: **Yeni `technician_tow_equipment` N:M tablosu** (profile_id, equipment enum, count). Çünkü aynı çekici 2 flatbed 1 hook'a sahip olabilir.
2. **PSP: Iyzico ile gerçek entegrasyon mu, mock ile mi Faz 8?** Öneri: Iyzico sandbox entegrasyonu — PSP client + idempotency pattern çalışır; staging'de gerçek card hits.
3. **`current_queue_depth` güncellemesi:** Case accepted → +1, delivered → -1. Trigger mi, service layer explicit update mi? Öneri: **service layer explicit** (debug kolay).
4. **Mapbox token rotation:** Uygulama kullanımları (mobile) için public key + backend için secret key. Hangi endpoint hangisini kullanmalı? Öneri: backend secret only; mobile reverse geocode'u backend endpoint üzerinden çağırır (abuse önleme).
5. **Tow dispatch_loop ARQ retry:** Loop crash olursa (worker restart) case `searching` state'te takılır. Öneri: **cron `tow_dispatch_recovery` 1 dakika** — `searching` + son attempt'ı 3dk+ önce olan case'leri pickup + dispatch_loop yeniden enqueue.
6. **Customer kart tokenizasyonu:** Iyzico BasketItem ile kart kaydı nerede tutuluyor? Bu Faz 7 user profile'a bağlı mı, yoksa ayrı `payment_methods` tablo mu? Mevcut auth + user modeline bakıp belirle.
7. **Equipment inferencer:** K-3 kuralı backend mı (service layer) frontend mi yapar? Öneri: **backend** — `tow_estimate` endpoint'i vehicle + incident + user override (opsiyonel) alır, equipment döner. Frontend gösterir.

---

## 23. Referanslar

**İç (Naro):**
- [docs/cekici-modu-urun-spec.md](cekici-modu-urun-spec.md) — ürün/UX spec, PO kararları
- [docs/sinyal-hiyerarsi-mimari.md](sinyal-hiyerarsi-mimari.md) — dispatch dar sinyal seti §4
- [docs/usta-eslestirme-mimarisi.md](usta-eslestirme-mimarisi.md) — genel matching iskeleti
- [docs/backend-billing-servisi-brief.md](backend-billing-servisi-brief.md) — ödeme mimarisi (%10 komisyon V1)
- [docs/veri-modeli/04-case.md](veri-modeli/04-case.md) — ServiceCase state makinesi
- [docs/veri-modeli/05-offer.md](veri-modeli/05-offer.md) — offer pattern (randevulu mod kullanır)
- [docs/veri-modeli/06-appointment.md](veri-modeli/06-appointment.md) — randevu modeli
- [docs/veri-modeli/16-technician-sinyal-modeli.md](veri-modeli/16-technician-sinyal-modeli.md) — çekici admission + signal
- [docs/veri-modeli/KARAR-LOG.md](veri-modeli/KARAR-LOG.md) — karar günlüğü
- [packages/domain/src/tow.ts](../packages/domain/src/tow.ts) — Zod (yazılacak; spec §7 içinde örnek)
- [packages/domain/src/service-case.ts](../packages/domain/src/service-case.ts) — ServiceCase base

**Dış:**
- Iyzico developer docs: pre-auth + capture + refund
- Mapbox API reference
- Uber's dispatch documentation (public engineering blog)
- PostGIS ST_DWithin + circle index rehberi

---

## 24. Değişiklik log

- **2026-04-21** — İlk sürüm. PO altyapı kararları (K-P1..K-P5) baked-in. Faz 8/9 deliverable listesi.
