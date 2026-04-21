"""tow_dispatch_tables: 7 tow tablo + tow_live_locations partitioning + case_offer_kind + idempotency altyapı

Revision ID: 20260422_0018
Revises: 20260422_0017
Create Date: 2026-04-22 12:30:00.000000

Faz 10b — Tow dispatch veri modeli.

- tow_dispatch_attempts: dispatch attempt tracking + UNIQUE (case_id, tech, attempt_order)
- tow_live_locations PARTITIONED BY RANGE(captured_at), günlük partition + default
  - Bootstrap: ilk 30 günün partition'ları (today-1 .. today+29)
- tow_fare_settlements: 1:1 service_cases, 7-state enum (mevcut tow_settlement_status reuse)
- tow_fare_refunds: child of settlements, multi-refund separation, idempotency_key UNIQUE
- tow_payment_idempotency: durable PSP replay cache (24h TTL nightly purge)
- tow_cancellations: actor + reason + stage_at_cancel + fee/refund
- tow_otp_events: issue + verify audit
- 8 yeni enum: tow_dispatch_response, tow_refund_reason, tow_payment_operation,
  tow_cancellation_actor, tow_otp_purpose, tow_otp_delivery, tow_otp_recipient, tow_otp_verify_result
- case_offer_kind enum (yeni) + case_offers.kind column — scheduled tow bidding flow
"""

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260422_0018"
down_revision: str | None = "20260422_0017"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


tow_settlement_status = postgresql.ENUM(
    "none", "pre_auth_holding", "preauth_stale", "final_charged",
    "refunded", "cancelled", "kasko_rejected",
    name="tow_settlement_status", create_type=False,
)
tow_dispatch_stage = postgresql.ENUM(
    "searching", "accepted", "en_route", "nearby", "arrived",
    "loading", "in_transit", "delivered", "cancelled",
    "timeout_converted_to_pool", "scheduled_waiting", "bidding_open",
    "offer_accepted", "preauth_failed", "preauth_stale",
    name="tow_dispatch_stage", create_type=False,
)

PARTITION_BOOTSTRAP_DAYS_BACK = 1
PARTITION_BOOTSTRAP_DAYS_FORWARD = 30


def upgrade() -> None:
    _create_new_enums()
    _create_tow_dispatch_attempts()
    _create_tow_live_locations()
    _bootstrap_live_location_partitions()
    _create_tow_fare_settlements()
    _create_tow_fare_refunds()
    _create_tow_payment_idempotency()
    _create_tow_cancellations()
    _create_tow_otp_events()
    _add_case_offer_kind()


def downgrade() -> None:
    _drop_case_offer_kind()
    op.drop_table("tow_otp_events")
    op.drop_table("tow_cancellations")
    op.drop_table("tow_payment_idempotency")
    op.drop_table("tow_fare_refunds")
    op.drop_table("tow_fare_settlements")
    _drop_live_location_partitions()
    op.drop_table("tow_live_locations")
    op.drop_table("tow_dispatch_attempts")
    _drop_new_enums()


def _create_new_enums() -> None:
    op.execute(
        "CREATE TYPE tow_dispatch_response AS ENUM "
        "('pending', 'accepted', 'declined', 'timeout')"
    )
    op.execute(
        "CREATE TYPE tow_refund_reason AS ENUM "
        "('capture_delta', 'cancellation', 'kasko_reimbursement', 'manual')"
    )
    op.execute(
        "CREATE TYPE tow_payment_operation AS ENUM "
        "('preauth', 'capture', 'refund', 'void')"
    )
    op.execute(
        "CREATE TYPE tow_cancellation_actor AS ENUM "
        "('customer', 'technician', 'system', 'admin')"
    )
    op.execute(
        "CREATE TYPE tow_otp_purpose AS ENUM ('arrival', 'delivery')"
    )
    op.execute(
        "CREATE TYPE tow_otp_delivery AS ENUM ('sms', 'in_app')"
    )
    op.execute(
        "CREATE TYPE tow_otp_recipient AS ENUM ('customer', 'delivery_person')"
    )
    op.execute(
        "CREATE TYPE tow_otp_verify_result AS ENUM "
        "('pending', 'success', 'failed', 'expired')"
    )
    op.execute("CREATE TYPE case_offer_kind AS ENUM ('standard', 'tow_scheduled')")


def _drop_new_enums() -> None:
    for enum_name in [
        "tow_dispatch_response",
        "tow_refund_reason",
        "tow_payment_operation",
        "tow_cancellation_actor",
        "tow_otp_purpose",
        "tow_otp_delivery",
        "tow_otp_recipient",
        "tow_otp_verify_result",
        "case_offer_kind",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")


def _create_tow_dispatch_attempts() -> None:
    op.create_table(
        "tow_dispatch_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("case_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("service_cases.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("technician_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="RESTRICT"),
                  nullable=False),
        sa.Column("attempt_order", sa.SmallInteger(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True)),
        sa.Column(
            "response",
            postgresql.ENUM(name="tow_dispatch_response", create_type=False),
            nullable=False,
            server_default=sa.text("'pending'::tow_dispatch_response"),
        ),
        sa.Column("distance_km", sa.Numeric(8, 3)),
        sa.Column("eta_minutes", sa.SmallInteger()),
        sa.Column("score", sa.Numeric(7, 4)),
        sa.Column("radius_km", sa.SmallInteger()),
        sa.Column("rejection_reason", sa.String(64)),
        sa.Column("snapshot", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint(
            "case_id", "technician_id", "attempt_order",
            name="uq_tow_dispatch_attempts_case_tech_order",
        ),
        sa.CheckConstraint("attempt_order >= 1",
                           name="ck_tow_dispatch_attempts_order_pos"),
        sa.CheckConstraint("distance_km IS NULL OR distance_km >= 0",
                           name="ck_tow_dispatch_attempts_distance_nonneg"),
    )
    op.create_index(
        "ix_tow_dispatch_attempts_case",
        "tow_dispatch_attempts",
        ["case_id", "response", "attempt_order"],
    )
    op.create_index(
        "ix_tow_dispatch_attempts_tech_pending",
        "tow_dispatch_attempts",
        ["technician_id", "sent_at"],
        postgresql_where=sa.text("response = 'pending'"),
    )


def _create_tow_live_locations() -> None:
    op.execute(
        """
        CREATE TABLE tow_live_locations (
            id              UUID NOT NULL DEFAULT gen_random_uuid(),
            case_id         UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
            technician_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            lat             DOUBLE PRECISION NOT NULL,
            lng             DOUBLE PRECISION NOT NULL,
            location        GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (
                ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
            ) STORED,
            heading_deg     SMALLINT,
            speed_kmh       SMALLINT,
            accuracy_m      SMALLINT,
            captured_at     TIMESTAMPTZ NOT NULL,
            server_received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (id, captured_at),
            CONSTRAINT ck_tow_live_locations_lat CHECK (lat BETWEEN -90 AND 90),
            CONSTRAINT ck_tow_live_locations_lng CHECK (lng BETWEEN -180 AND 180),
            CONSTRAINT ck_tow_live_locations_heading CHECK (heading_deg IS NULL OR heading_deg BETWEEN 0 AND 360),
            CONSTRAINT ck_tow_live_locations_speed CHECK (speed_kmh IS NULL OR speed_kmh >= 0)
        ) PARTITION BY RANGE (captured_at)
        """
    )
    op.execute(
        """
        CREATE TABLE tow_live_locations_default PARTITION OF tow_live_locations DEFAULT
        """
    )
    # Autovacuum tuning applied per-partition (PG disallows storage params on partitioned parent).


def _bootstrap_live_location_partitions() -> None:
    today = datetime.now(UTC).date()
    start = today - timedelta(days=PARTITION_BOOTSTRAP_DAYS_BACK)
    for i in range(PARTITION_BOOTSTRAP_DAYS_BACK + PARTITION_BOOTSTRAP_DAYS_FORWARD):
        day = start + timedelta(days=i)
        next_day = day + timedelta(days=1)
        partition_name = f"tow_live_locations_{day.strftime('%Y%m%d')}"
        op.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {partition_name}
            PARTITION OF tow_live_locations
            FOR VALUES FROM ('{day.isoformat()}') TO ('{next_day.isoformat()}')
            """
        )
        op.execute(
            f"CREATE INDEX IF NOT EXISTS ix_{partition_name}_case_time "
            f"ON {partition_name} (case_id, captured_at DESC)"
        )
        op.execute(
            f"CREATE INDEX IF NOT EXISTS ix_{partition_name}_tech_time "
            f"ON {partition_name} (technician_id, captured_at DESC)"
        )
        op.execute(
            f"CREATE INDEX IF NOT EXISTS ix_{partition_name}_location_gist "
            f"ON {partition_name} USING GIST (location)"
        )
        op.execute(
            f"ALTER TABLE {partition_name} SET ("
            f"autovacuum_vacuum_scale_factor = 0.01, "
            f"autovacuum_vacuum_cost_limit = 2000)"
        )


def _drop_live_location_partitions() -> None:
    today = datetime.now(UTC).date()
    start = today - timedelta(days=PARTITION_BOOTSTRAP_DAYS_BACK)
    for i in range(PARTITION_BOOTSTRAP_DAYS_BACK + PARTITION_BOOTSTRAP_DAYS_FORWARD):
        day = start + timedelta(days=i)
        partition_name = f"tow_live_locations_{day.strftime('%Y%m%d')}"
        op.execute(f"DROP TABLE IF EXISTS {partition_name}")
    op.execute("DROP TABLE IF EXISTS tow_live_locations_default")


def _create_tow_fare_settlements() -> None:
    op.create_table(
        "tow_fare_settlements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("case_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("service_cases.id", ondelete="RESTRICT"),
                  nullable=False, unique=True),
        sa.Column(
            "state",
            postgresql.ENUM(name="tow_settlement_status", create_type=False),
            nullable=False,
            server_default=sa.text("'none'::tow_settlement_status"),
        ),
        sa.Column("preauth_id", sa.String(128)),
        sa.Column("preauth_authorized_at", sa.DateTime(timezone=True)),
        sa.Column("preauth_expires_at", sa.DateTime(timezone=True)),
        sa.Column("capture_id", sa.String(128)),
        sa.Column("captured_at", sa.DateTime(timezone=True)),
        sa.Column("cap_amount", sa.Numeric(10, 2)),
        sa.Column("quoted_amount", sa.Numeric(10, 2)),
        sa.Column("actual_amount", sa.Numeric(10, 2)),
        sa.Column("final_amount", sa.Numeric(10, 2)),
        sa.Column("kasko_owed_amount", sa.Numeric(10, 2)),
        sa.Column("currency", sa.String(3), nullable=False,
                  server_default=sa.text("'TRY'")),
        sa.Column("retry_count", sa.SmallInteger(), nullable=False,
                  server_default=sa.text("0")),
        sa.Column("last_error", sa.Text()),
        sa.Column("psp_response", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "cap_amount IS NULL OR cap_amount >= 0",
            name="ck_tow_settlements_cap_nonneg",
        ),
        sa.CheckConstraint(
            "final_amount IS NULL OR final_amount >= 0",
            name="ck_tow_settlements_final_nonneg",
        ),
    )
    op.create_index(
        "ix_tow_settlements_preauth_expiring",
        "tow_fare_settlements",
        ["preauth_expires_at"],
        postgresql_where=sa.text(
            "state = 'pre_auth_holding' AND preauth_expires_at IS NOT NULL"
        ),
    )
    op.create_index(
        "ix_tow_settlements_state",
        "tow_fare_settlements",
        ["state", "updated_at"],
    )


def _create_tow_fare_refunds() -> None:
    op.create_table(
        "tow_fare_refunds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("settlement_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("tow_fare_settlements.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False,
                  server_default=sa.text("'TRY'")),
        sa.Column(
            "reason",
            postgresql.ENUM(name="tow_refund_reason", create_type=False),
            nullable=False,
        ),
        sa.Column("psp_ref", sa.String(128)),
        sa.Column("idempotency_key", sa.String(128), nullable=False, unique=True),
        sa.Column("psp_response", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("amount > 0", name="ck_tow_refunds_amount_pos"),
    )
    op.create_index(
        "ix_tow_refunds_settlement",
        "tow_fare_refunds",
        ["settlement_id", "created_at"],
    )


def _create_tow_payment_idempotency() -> None:
    op.create_table(
        "tow_payment_idempotency",
        sa.Column("key", sa.String(160), primary_key=True),
        sa.Column("settlement_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("tow_fare_settlements.id", ondelete="SET NULL")),
        sa.Column(
            "operation",
            postgresql.ENUM(name="tow_payment_operation", create_type=False),
            nullable=False,
        ),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("response_status", sa.SmallInteger(), nullable=False),
        sa.Column("response_body", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_tow_payment_idempotency_expires",
        "tow_payment_idempotency",
        ["expires_at"],
    )


def _create_tow_cancellations() -> None:
    op.create_table(
        "tow_cancellations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("case_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("service_cases.id", ondelete="CASCADE"),
                  nullable=False, unique=True),
        sa.Column(
            "actor",
            postgresql.ENUM(name="tow_cancellation_actor", create_type=False),
            nullable=False,
        ),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("reason_code", sa.String(64), nullable=False),
        sa.Column("reason_note", sa.Text()),
        sa.Column(
            "stage_at_cancel",
            postgresql.ENUM(name="tow_dispatch_stage", create_type=False),
            nullable=False,
        ),
        sa.Column("cancellation_fee", sa.Numeric(10, 2), nullable=False,
                  server_default=sa.text("0")),
        sa.Column("refund_amount", sa.Numeric(10, 2), nullable=False,
                  server_default=sa.text("0")),
        sa.Column("canceled_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "cancellation_fee >= 0",
            name="ck_tow_cancellations_fee_nonneg",
        ),
        sa.CheckConstraint(
            "refund_amount >= 0",
            name="ck_tow_cancellations_refund_nonneg",
        ),
    )


def _create_tow_otp_events() -> None:
    op.create_table(
        "tow_otp_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("case_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("service_cases.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column(
            "purpose",
            postgresql.ENUM(name="tow_otp_purpose", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "recipient",
            postgresql.ENUM(name="tow_otp_recipient", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "delivered_via",
            postgresql.ENUM(name="tow_otp_delivery", create_type=False),
            nullable=False,
        ),
        sa.Column("code_hash", sa.String(128), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True)),
        sa.Column("attempts", sa.SmallInteger(), nullable=False,
                  server_default=sa.text("0")),
        sa.Column(
            "verify_result",
            postgresql.ENUM(name="tow_otp_verify_result", create_type=False),
            nullable=False,
            server_default=sa.text("'pending'::tow_otp_verify_result"),
        ),
        sa.Column("issued_by_user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("attempts >= 0 AND attempts <= 10",
                           name="ck_tow_otp_attempts_range"),
    )
    # One active (pending) OTP per (case, purpose)
    op.create_index(
        "uq_tow_otp_active_per_case_purpose",
        "tow_otp_events",
        ["case_id", "purpose"],
        unique=True,
        postgresql_where=sa.text("verify_result = 'pending'"),
    )
    op.create_index(
        "ix_tow_otp_case",
        "tow_otp_events",
        ["case_id", "issued_at"],
    )


def _add_case_offer_kind() -> None:
    # Add column with default 'standard' to backfill existing rows
    op.execute(
        "ALTER TABLE case_offers "
        "ADD COLUMN kind case_offer_kind NOT NULL "
        "DEFAULT 'standard'::case_offer_kind"
    )
    op.create_index(
        "ix_case_offers_kind_case",
        "case_offers",
        ["case_id", "kind", "status"],
    )


def _drop_case_offer_kind() -> None:
    op.drop_index("ix_case_offers_kind_case", table_name="case_offers")
    op.drop_column("case_offers", "kind")
