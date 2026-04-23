"""DROP service_cases tow_* kolonları (Faz 1 canonical case architecture)

Revision ID: 20260423_0032
Revises: 20260423_0031
Create Date: 2026-04-23 15:00:00.000000

Domain subtype refactor Faz 1 — shell → subtype kolon taşıması tamamlandı.
Brief: docs/audits/2026-04-23-canonical-case-architecture.md

Migration 0031 (CREATE subtype tables) + backfill script
(scripts/backfill_case_subtypes.py) SONRASINDA çalıştırılır. Pilot DB'de
her mevcut TOWING case için TowCase subtype row zaten yazılı olmalı.

DROP scope:
- CHECK constraint ck_service_cases_tow_stage_xor_kind
- GIST index ix_service_cases_pickup_gist
- generated geography: pickup_location, dropoff_location
- tow-specific kolonlar: tow_mode, tow_stage, tow_required_equipment,
  incident_reason, scheduled_at, pickup/dropoff lat/lng/address,
  tow_fare_quote

Shell (service_cases) generic vaka alanlarını saklamaya devam eder.
Geography + GIST index yeni ev: tow_case tablosu (migration 0031).

Enum tipleri (tow_mode, tow_dispatch_stage, tow_equipment,
tow_incident_reason) DROP EDİLMEZ — tow_case tablosu aynı enum'ları
kullanıyor.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260423_0032"
down_revision: str | None = "20260423_0031"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # 1. CHECK constraint önce (kolon DROP'u engeller)
    op.drop_constraint(
        "ck_service_cases_tow_stage_xor_kind",
        "service_cases",
        type_="check",
    )

    # 2. GIST index
    op.execute("DROP INDEX IF EXISTS ix_service_cases_pickup_gist")

    # 3. Generated geography columns
    op.drop_column("service_cases", "dropoff_location")
    op.drop_column("service_cases", "pickup_location")

    # 4. Tow-specific kolonlar (reverse creation order)
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


def downgrade() -> None:
    # Enum tipleri DROP edilmedi — create_type=False ile re-bind
    tow_mode = postgresql.ENUM(
        "immediate", "scheduled", name="tow_mode", create_type=False
    )
    tow_equipment = postgresql.ENUM(
        "flatbed",
        "hook",
        "wheel_lift",
        "heavy_duty",
        "motorcycle",
        name="tow_equipment",
        create_type=False,
    )
    tow_incident_reason = postgresql.ENUM(
        "not_running",
        "accident",
        "flat_tire",
        "battery",
        "fuel",
        "locked_keys",
        "stuck",
        "other",
        name="tow_incident_reason",
        create_type=False,
    )
    tow_dispatch_stage = postgresql.ENUM(
        "searching",
        "accepted",
        "en_route",
        "nearby",
        "arrived",
        "loading",
        "in_transit",
        "delivered",
        "cancelled",
        "timeout_converted_to_pool",
        "scheduled_waiting",
        "bidding_open",
        "offer_accepted",
        "preauth_failed",
        "preauth_stale",
        name="tow_dispatch_stage",
        create_type=False,
    )

    # Re-create columns (0017 order)
    op.add_column(
        "service_cases", sa.Column("tow_mode", tow_mode, nullable=True)
    )
    op.add_column(
        "service_cases",
        sa.Column("tow_stage", tow_dispatch_stage, nullable=True),
    )
    op.add_column(
        "service_cases",
        sa.Column(
            "tow_required_equipment",
            sa.ARRAY(tow_equipment),
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
        "service_cases", sa.Column("pickup_lat", sa.Float(), nullable=True)
    )
    op.add_column(
        "service_cases", sa.Column("pickup_lng", sa.Float(), nullable=True)
    )
    op.add_column(
        "service_cases",
        sa.Column("pickup_address", sa.String(500), nullable=True),
    )
    op.add_column(
        "service_cases", sa.Column("dropoff_lat", sa.Float(), nullable=True)
    )
    op.add_column(
        "service_cases", sa.Column("dropoff_lng", sa.Float(), nullable=True)
    )
    op.add_column(
        "service_cases",
        sa.Column("dropoff_address", sa.String(500), nullable=True),
    )
    op.add_column(
        "service_cases",
        sa.Column(
            "tow_fare_quote", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
    )

    # Generated geography columns
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

    # GIST partial index
    op.execute(
        """
        CREATE INDEX ix_service_cases_pickup_gist
        ON service_cases
        USING GIST (pickup_location)
        WHERE kind = 'towing'
          AND pickup_location IS NOT NULL
        """
    )

    # CHECK constraint (XOR)
    op.create_check_constraint(
        "ck_service_cases_tow_stage_xor_kind",
        "service_cases",
        "(kind = 'towing' AND tow_stage IS NOT NULL) OR "
        "(kind != 'towing' AND tow_stage IS NULL)",
    )
