"""case subtype tables + vehicle snapshot kolonları (Faz 1a)

Revision ID: 20260423_0031
Revises: 20260422_0030
Create Date: 2026-04-23 12:00:00.000000

Domain subtype refactor Faz 1a — canonical case architecture.
Brief: docs/audits/2026-04-23-canonical-case-architecture.md

`service_cases` ortak shell olarak kalır; 4 subtype tablo 1:1 extension
ile first-class hale gelir. Her subtype satırında immutable vehicle
snapshot (pilot V1: 7 alan; V1.1'de matching v2 alanları eklenir).

Migration scope:
- CREATE tow_case, accident_case, breakdown_case, maintenance_case
- Her tablo: case_id UUID PK+FK → service_cases.id CASCADE
- Her tablo: snapshot_plate/make/model/year/fuel_type/vin/current_km
- tow_case: tow-specific kolonlar (tow_mode, tow_stage, pickup/dropoff, ...)

DATA COPY yok — scripts/backfill_case_subtypes.py çalıştırıcı 0032
öncesi. DROP service_cases.tow_* kolonları migration 0032'de.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260423_0031"
down_revision: str | None = "20260422_0030"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def _snapshot_columns() -> list[sa.Column[object]]:
    """Ortak immutable vehicle snapshot kolonları (pilot V1: 7 alan).

    V1.1'de eklenecek: body_type, vehicle_segment, gross_weight_class,
    drivetrain_class (Vehicle master'a önce eklenmeli).
    """
    return [
        sa.Column("snapshot_plate", sa.String(32), nullable=False),
        sa.Column("snapshot_make", sa.String(64), nullable=True),
        sa.Column("snapshot_model", sa.String(128), nullable=True),
        sa.Column("snapshot_year", sa.SmallInteger(), nullable=True),
        sa.Column("snapshot_fuel_type", sa.String(32), nullable=True),
        sa.Column("snapshot_vin", sa.String(32), nullable=True),
        sa.Column("snapshot_current_km", sa.Integer(), nullable=True),
    ]


def upgrade() -> None:
    # ─── tow_case ─────────────────────────────────────────────────────────
    op.create_table(
        "tow_case",
        sa.Column(
            "case_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_cases.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "tow_mode",
            sa.dialects.postgresql.ENUM(
                "immediate", "scheduled",
                name="tow_mode",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "tow_stage",
            sa.dialects.postgresql.ENUM(
                "searching", "accepted", "en_route", "nearby", "arrived",
                "loading", "in_transit", "delivered", "cancelled",
                "timeout_converted_to_pool", "scheduled_waiting",
                "bidding_open", "offer_accepted", "preauth_failed",
                "preauth_stale",
                name="tow_dispatch_stage",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "tow_required_equipment",
            sa.dialects.postgresql.ARRAY(
                sa.dialects.postgresql.ENUM(
                    name="tow_equipment", create_type=False,
                )
            ),
            nullable=True,
        ),
        sa.Column(
            "incident_reason",
            sa.dialects.postgresql.ENUM(
                name="tow_incident_reason", create_type=False,
            ),
            nullable=True,
        ),
        sa.Column(
            "scheduled_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column("pickup_lat", sa.Float(), nullable=True),
        sa.Column("pickup_lng", sa.Float(), nullable=True),
        sa.Column("pickup_address", sa.String(500), nullable=True),
        sa.Column("dropoff_lat", sa.Float(), nullable=True),
        sa.Column("dropoff_lng", sa.Float(), nullable=True),
        sa.Column("dropoff_address", sa.String(500), nullable=True),
        sa.Column(
            "tow_fare_quote",
            sa.dialects.postgresql.JSONB(),
            nullable=True,
        ),
        *_snapshot_columns(),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    # Computed geography columns (read-only, persisted)
    op.execute(
        """
        ALTER TABLE tow_case
        ADD COLUMN pickup_location geography(POINT,4326)
        GENERATED ALWAYS AS (
            CASE WHEN pickup_lng IS NOT NULL AND pickup_lat IS NOT NULL
                 THEN ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)::geography
                 ELSE NULL END
        ) STORED
        """
    )
    op.execute(
        """
        ALTER TABLE tow_case
        ADD COLUMN dropoff_location geography(POINT,4326)
        GENERATED ALWAYS AS (
            CASE WHEN dropoff_lng IS NOT NULL AND dropoff_lat IS NOT NULL
                 THEN ST_SetSRID(ST_MakePoint(dropoff_lng, dropoff_lat), 4326)::geography
                 ELSE NULL END
        ) STORED
        """
    )
    op.create_index(
        "ix_tow_case_pickup_location",
        "tow_case",
        ["pickup_location"],
        postgresql_using="gist",
    )
    op.create_index(
        "ix_tow_case_tow_stage",
        "tow_case",
        ["tow_stage"],
    )

    # ─── accident_case ────────────────────────────────────────────────────
    op.create_table(
        "accident_case",
        sa.Column(
            "case_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_cases.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("damage_area", sa.String(60), nullable=True),
        sa.Column("damage_severity", sa.String(32), nullable=True),
        sa.Column(
            "counterparty_count",
            sa.SmallInteger(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "counterparty_note", sa.Text(), nullable=True
        ),
        sa.Column(
            "kasko_selected",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "sigorta_selected",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("kasko_brand", sa.String(120), nullable=True),
        sa.Column("sigorta_brand", sa.String(120), nullable=True),
        sa.Column(
            "ambulance_contacted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("report_method", sa.String(32), nullable=True),
        sa.Column(
            "emergency_acknowledged",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        *_snapshot_columns(),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "counterparty_count >= 0",
            name="ck_accident_counterparty_nonneg",
        ),
    )

    # ─── breakdown_case ───────────────────────────────────────────────────
    op.create_table(
        "breakdown_case",
        sa.Column(
            "case_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_cases.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("breakdown_category", sa.String(32), nullable=False),
        sa.Column("symptoms", sa.Text(), nullable=True),
        sa.Column(
            "vehicle_drivable",
            sa.Boolean(),
            nullable=True,  # unknown OK — customer bazen bilmiyor
        ),
        sa.Column(
            "on_site_repair_requested",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "valet_requested",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "pickup_preference", sa.String(32), nullable=True
        ),
        sa.Column(
            "price_preference", sa.String(32), nullable=True
        ),
        *_snapshot_columns(),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # ─── maintenance_case ─────────────────────────────────────────────────
    op.create_table(
        "maintenance_case",
        sa.Column(
            "case_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_cases.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("maintenance_category", sa.String(40), nullable=False),
        sa.Column(
            "maintenance_detail",
            sa.dialects.postgresql.JSONB(),
            nullable=True,
        ),
        sa.Column("maintenance_tier", sa.String(16), nullable=True),
        sa.Column(
            "service_style_preference", sa.String(32), nullable=True
        ),
        sa.Column("mileage_km", sa.Integer(), nullable=True),
        sa.Column(
            "valet_requested",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "pickup_preference", sa.String(32), nullable=True
        ),
        sa.Column(
            "price_preference", sa.String(32), nullable=True
        ),
        *_snapshot_columns(),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("maintenance_case")
    op.drop_table("breakdown_case")
    op.drop_table("accident_case")
    op.drop_index("ix_tow_case_tow_stage", table_name="tow_case")
    op.drop_index("ix_tow_case_pickup_location", table_name="tow_case")
    op.drop_table("tow_case")
