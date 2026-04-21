"""tow_foundation: PostGIS + 5 enum + ServiceCase/Technician ALTER + tow_equipment N:M + user_payment_methods + event enum ADD VALUE

Revision ID: 20260422_0017
Revises: 20260422_0016
Create Date: 2026-04-22 11:00:00.000000

Faz 10a — Tow dispatch altyapı temeli.

- CREATE EXTENSION postgis (zaten postgis/postgis image'da default enabled ama idempotent)
- 5 yeni enum: tow_mode, tow_equipment, tow_incident_reason, tow_dispatch_stage (15), tow_settlement_status (7)
- service_cases ALTER: tow_mode, tow_stage, tow_required_equipment tow_equipment[],
  incident_reason, scheduled_at, pickup_lat/lng/address, dropoff_lat/lng/address,
  tow_fare_quote JSONB + 2 generated geography column + CHECK (kind='towing') = (tow_stage IS NOT NULL)
- technician_profiles ALTER: last_known_location geography + last_location_at +
  current_offer_case_id + current_offer_issued_at + evidence_discipline_score
- technician_tow_equipment N:M (profile_id + equipment PK CASCADE)
- user_payment_methods (V1 rezerve — V1.1 aktif)
- case_event_type ADD VALUE ×6
- auth_event_type ADD VALUE ×2
- Partial GIST index: technician_profiles(last_known_location) WHERE provider_type='cekici' AND availability='available'
- Autovacuum tune: technician_profiles
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260422_0017"
down_revision: str | None = "20260422_0016"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


tow_mode = postgresql.ENUM(
    "immediate", "scheduled", name="tow_mode", create_type=False
)
tow_equipment = postgresql.ENUM(
    "flatbed", "hook", "wheel_lift", "heavy_duty", "motorcycle",
    name="tow_equipment", create_type=False,
)
tow_incident_reason = postgresql.ENUM(
    "not_running", "accident", "flat_tire", "battery", "fuel",
    "locked_keys", "stuck", "other",
    name="tow_incident_reason", create_type=False,
)
tow_dispatch_stage = postgresql.ENUM(
    "searching", "accepted", "en_route", "nearby", "arrived",
    "loading", "in_transit", "delivered", "cancelled",
    "timeout_converted_to_pool", "scheduled_waiting", "bidding_open",
    "offer_accepted", "preauth_failed", "preauth_stale",
    name="tow_dispatch_stage", create_type=False,
)
tow_settlement_status = postgresql.ENUM(
    "none", "pre_auth_holding", "preauth_stale",
    "final_charged", "refunded", "cancelled", "kasko_rejected",
    name="tow_settlement_status", create_type=False,
)


def upgrade() -> None:
    # 1) PostGIS extension (postgis/postgis image'da default enabled ama idempotent)
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    # 2) Yeni enum'lar
    tow_mode.create(op.get_bind(), checkfirst=True)
    tow_equipment.create(op.get_bind(), checkfirst=True)
    tow_incident_reason.create(op.get_bind(), checkfirst=True)
    tow_dispatch_stage.create(op.get_bind(), checkfirst=True)
    tow_settlement_status.create(op.get_bind(), checkfirst=True)

    # 3) case_event_type ADD VALUE ×6 (tow event tipleri)
    for value in (
        "tow_stage_requested",
        "tow_stage_committed",
        "tow_evidence_added",
        "tow_location_recorded",
        "tow_fare_captured",
        "tow_dispatch_candidate_selected",
    ):
        op.execute(
            f"ALTER TYPE case_event_type ADD VALUE IF NOT EXISTS '{value}'"
        )

    # 4) auth_event_type ADD VALUE ×2
    for value in ("fraud_suspected", "payment_method_added"):
        op.execute(
            f"ALTER TYPE auth_event_type ADD VALUE IF NOT EXISTS '{value}'"
        )

    # 5) service_cases ALTER — tow-özel kolonlar
    op.add_column(
        "service_cases",
        sa.Column("tow_mode", tow_mode, nullable=True),
    )
    op.add_column(
        "service_cases",
        sa.Column("tow_stage", tow_dispatch_stage, nullable=True),
    )
    op.add_column(
        "service_cases",
        sa.Column(
            "tow_required_equipment",
            postgresql.ARRAY(tow_equipment),
            nullable=True,
        ),
    )
    op.add_column(
        "service_cases",
        sa.Column("incident_reason", tow_incident_reason, nullable=True),
    )
    op.add_column(
        "service_cases",
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "service_cases",
        sa.Column("pickup_lat", sa.Float(precision=53), nullable=True),
    )
    op.add_column(
        "service_cases",
        sa.Column("pickup_lng", sa.Float(precision=53), nullable=True),
    )
    op.add_column(
        "service_cases",
        sa.Column("pickup_address", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "service_cases",
        sa.Column("dropoff_lat", sa.Float(precision=53), nullable=True),
    )
    op.add_column(
        "service_cases",
        sa.Column("dropoff_lng", sa.Float(precision=53), nullable=True),
    )
    op.add_column(
        "service_cases",
        sa.Column("dropoff_address", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "service_cases",
        sa.Column(
            "tow_fare_quote",
            postgresql.JSONB(),
            nullable=True,
        ),
    )

    # Generated geography columns (PostGIS ST_MakePoint)
    op.execute(
        """
        ALTER TABLE service_cases
        ADD COLUMN pickup_location geography(Point, 4326)
        GENERATED ALWAYS AS (
            CASE
                WHEN pickup_lng IS NOT NULL AND pickup_lat IS NOT NULL
                THEN ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)::geography
                ELSE NULL
            END
        ) STORED
        """
    )
    op.execute(
        """
        ALTER TABLE service_cases
        ADD COLUMN dropoff_location geography(Point, 4326)
        GENERATED ALWAYS AS (
            CASE
                WHEN dropoff_lng IS NOT NULL AND dropoff_lat IS NOT NULL
                THEN ST_SetSRID(ST_MakePoint(dropoff_lng, dropoff_lat), 4326)::geography
                ELSE NULL
            END
        ) STORED
        """
    )

    # CHECK — kind='towing' iff tow_stage IS NOT NULL (XOR)
    op.create_check_constraint(
        "ck_service_cases_tow_stage_xor_kind",
        "service_cases",
        "(kind = 'towing' AND tow_stage IS NOT NULL) OR (kind != 'towing' AND tow_stage IS NULL)",
    )

    # 6) technician_profiles ALTER — tow hot pool alanları
    op.add_column(
        "technician_profiles",
        sa.Column("last_known_location_lat", sa.Float(precision=53), nullable=True),
    )
    op.add_column(
        "technician_profiles",
        sa.Column("last_known_location_lng", sa.Float(precision=53), nullable=True),
    )
    op.execute(
        """
        ALTER TABLE technician_profiles
        ADD COLUMN last_known_location geography(Point, 4326)
        GENERATED ALWAYS AS (
            CASE
                WHEN last_known_location_lng IS NOT NULL AND last_known_location_lat IS NOT NULL
                THEN ST_SetSRID(ST_MakePoint(last_known_location_lng, last_known_location_lat), 4326)::geography
                ELSE NULL
            END
        ) STORED
        """
    )
    op.add_column(
        "technician_profiles",
        sa.Column("last_location_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "technician_profiles",
        sa.Column("current_offer_case_id", sa.UUID(), nullable=True),
    )
    op.add_column(
        "technician_profiles",
        sa.Column("current_offer_issued_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "technician_profiles",
        sa.Column(
            "evidence_discipline_score",
            sa.Numeric(3, 2),
            nullable=False,
            server_default=sa.text("1.00"),
        ),
    )

    # 7) technician_tow_equipment N:M
    op.create_table(
        "technician_tow_equipment",
        sa.Column("profile_id", sa.UUID(), nullable=False),
        sa.Column("equipment", tow_equipment, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["profile_id"], ["technician_profiles.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("profile_id", "equipment"),
    )
    op.create_index(
        "ix_technician_tow_equipment_equipment",
        "technician_tow_equipment",
        ["equipment"],
        unique=False,
    )

    # 8) user_payment_methods (V1 rezerve)
    op.create_table(
        "user_payment_methods",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),  # iyzico|stripe|...
        sa.Column("card_token", sa.String(length=512), nullable=False),
        sa.Column("brand", sa.String(length=32), nullable=True),  # visa|mastercard|...
        sa.Column("last4", sa.String(length=4), nullable=True),
        sa.Column("expires_month", sa.SmallInteger(), nullable=True),
        sa.Column("expires_year", sa.SmallInteger(), nullable=True),
        sa.Column(
            "is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_user_payment_methods_user",
        "user_payment_methods",
        ["user_id", "is_default"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    # Her user için 1 default kart
    op.create_index(
        "uq_user_payment_methods_default",
        "user_payment_methods",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("is_default IS TRUE AND deleted_at IS NULL"),
    )

    # 9) Partial GIST index — tow hot pool
    op.execute(
        """
        CREATE INDEX ix_tech_profiles_tow_hot_pool
        ON technician_profiles
        USING GIST (last_known_location)
        WHERE provider_type = 'cekici'
          AND availability = 'available'
          AND deleted_at IS NULL
          AND last_known_location IS NOT NULL
        """
    )
    # Fraud + stale detection için
    op.create_index(
        "ix_tech_profiles_last_location_at",
        "technician_profiles",
        ["last_location_at"],
        unique=False,
        postgresql_where=sa.text(
            "provider_type = 'cekici' AND availability = 'available'"
        ),
    )
    op.create_index(
        "ix_tech_profiles_current_offer",
        "technician_profiles",
        ["current_offer_case_id"],
        unique=False,
        postgresql_where=sa.text("current_offer_case_id IS NOT NULL"),
    )
    # Service_cases pickup_location GIST (tow + active case'ler için dispatch target)
    op.execute(
        """
        CREATE INDEX ix_service_cases_pickup_gist
        ON service_cases
        USING GIST (pickup_location)
        WHERE kind = 'towing'
          AND pickup_location IS NOT NULL
          AND deleted_at IS NULL
        """
    )

    # 10) Autovacuum tune — technician_profiles (hot update with current_offer_case_id)
    op.execute(
        """
        ALTER TABLE technician_profiles SET (
            autovacuum_vacuum_scale_factor = 0.01,
            autovacuum_vacuum_cost_limit = 2000
        )
        """
    )


def downgrade() -> None:
    # Autovacuum reset
    op.execute(
        "ALTER TABLE technician_profiles RESET ("
        "autovacuum_vacuum_scale_factor, autovacuum_vacuum_cost_limit)"
    )

    # Drop indexes
    op.execute("DROP INDEX IF EXISTS ix_service_cases_pickup_gist")
    op.execute("DROP INDEX IF EXISTS ix_tech_profiles_current_offer")
    op.execute("DROP INDEX IF EXISTS ix_tech_profiles_last_location_at")
    op.execute("DROP INDEX IF EXISTS ix_tech_profiles_tow_hot_pool")

    # user_payment_methods
    op.drop_index("uq_user_payment_methods_default", table_name="user_payment_methods")
    op.drop_index("ix_user_payment_methods_user", table_name="user_payment_methods")
    op.drop_table("user_payment_methods")

    # technician_tow_equipment
    op.drop_index(
        "ix_technician_tow_equipment_equipment",
        table_name="technician_tow_equipment",
    )
    op.drop_table("technician_tow_equipment")

    # technician_profiles geri dönüş
    op.drop_column("technician_profiles", "evidence_discipline_score")
    op.drop_column("technician_profiles", "current_offer_issued_at")
    op.drop_column("technician_profiles", "current_offer_case_id")
    op.drop_column("technician_profiles", "last_location_at")
    op.drop_column("technician_profiles", "last_known_location")  # generated
    op.drop_column("technician_profiles", "last_known_location_lng")
    op.drop_column("technician_profiles", "last_known_location_lat")

    # service_cases geri dönüş
    op.drop_constraint(
        "ck_service_cases_tow_stage_xor_kind", "service_cases", type_="check"
    )
    op.drop_column("service_cases", "dropoff_location")  # generated
    op.drop_column("service_cases", "pickup_location")  # generated
    op.drop_column("service_cases", "tow_fare_quote")
    op.drop_column("service_cases", "dropoff_address")
    op.drop_column("service_cases", "dropoff_lng")
    op.drop_column("service_cases", "dropoff_lat")
    op.drop_column("service_cases", "pickup_address")
    op.drop_column("service_cases", "pickup_lng")
    op.drop_column("service_cases", "pickup_lat")
    op.drop_column("service_cases", "scheduled_at")
    op.drop_column("service_cases", "incident_reason")
    op.drop_column("service_cases", "tow_required_equipment")
    op.drop_column("service_cases", "tow_stage")
    op.drop_column("service_cases", "tow_mode")

    # Enum ADD VALUE geri alınamaz (PG kısıtı) — enum değerleri kalır

    tow_settlement_status.drop(op.get_bind(), checkfirst=True)
    tow_dispatch_stage.drop(op.get_bind(), checkfirst=True)
    tow_incident_reason.drop(op.get_bind(), checkfirst=True)
    tow_equipment.drop(op.get_bind(), checkfirst=True)
    tow_mode.drop(op.get_bind(), checkfirst=True)

    # PostGIS extension bırakılır (diğer kullanımlar olabilir)
