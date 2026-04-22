"""technician_signal_relations: 9 technician eklenti tablosu (V2 sinyal modeli)

Revision ID: 20260422_0024
Revises: 20260422_0023
Create Date: 2026-04-22 22:30:00.000000

Faz 13 PR 4 Gün 3b — Usta sinyal tabloları (brief §4.1 + sinyal-modeli §).

Tablolar:
- technician_service_domains (N:M profile × domain)
- technician_procedures (N:M + confidence)
- technician_procedure_tags (serbest etiket; pgvector V2'de)
- technician_brand_coverage (N:M + authorized flag)
- technician_drivetrain_coverage (N:M)
- technician_service_area (1:1 + radius)
- technician_working_districts (N:M)
- technician_working_schedule (haftalık slot grid)
- technician_capacity (1:1 + staff/concurrency)
- technician_performance_snapshots (rolling aggregation)

Tüm ON DELETE CASCADE technician_profiles.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260422_0024"
down_revision: str | None = "20260422_0023"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    _service_domains()
    _procedures()
    _procedure_tags()
    _brand_coverage()
    _drivetrain_coverage()
    _service_area()
    _working_districts()
    _working_schedule()
    _capacity()
    _performance_snapshots()


def downgrade() -> None:
    op.drop_table("technician_performance_snapshots")
    op.drop_table("technician_capacity")
    op.drop_table("technician_working_schedule")
    op.drop_table("technician_working_districts")
    op.drop_table("technician_service_area")
    op.drop_table("technician_drivetrain_coverage")
    op.drop_table("technician_brand_coverage")
    op.drop_table("technician_procedure_tags")
    op.drop_table("technician_procedures")
    op.drop_table("technician_service_domains")


def _service_domains() -> None:
    op.create_table(
        "technician_service_domains",
        sa.Column(
            "profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("technician_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "domain_key",
            sa.String(40),
            sa.ForeignKey("taxonomy_service_domains.domain_key"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("profile_id", "domain_key"),
    )
    op.create_index(
        "ix_tech_domains_domain",
        "technician_service_domains",
        ["domain_key", "profile_id"],
    )


def _procedures() -> None:
    op.create_table(
        "technician_procedures",
        sa.Column(
            "profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("technician_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "procedure_key",
            sa.String(60),
            sa.ForeignKey("taxonomy_procedures.procedure_key"),
            nullable=False,
        ),
        sa.Column(
            "confidence_self_declared",
            sa.Numeric(3, 2),
            nullable=False,
            server_default="1.00",
        ),
        sa.Column("confidence_verified", sa.Numeric(3, 2)),
        sa.Column(
            "completed_count", sa.Integer, nullable=False, server_default="0"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("profile_id", "procedure_key"),
    )
    op.create_index(
        "ix_tech_procedures_procedure",
        "technician_procedures",
        ["procedure_key", "profile_id"],
    )


def _procedure_tags() -> None:
    # pgvector V2'de — şimdilik embedding kolonu yok, gin_trgm search.
    op.create_table(
        "technician_procedure_tags",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("technician_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tag", sa.String(120), nullable=False),
        sa.Column("tag_normalized", sa.String(120), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "profile_id", "tag_normalized", name="uq_tech_tags_profile_tag"
        ),
    )
    op.execute(
        "CREATE INDEX ix_tech_tags_search "
        "ON technician_procedure_tags USING GIN (tag_normalized gin_trgm_ops)"
    )


def _brand_coverage() -> None:
    op.create_table(
        "technician_brand_coverage",
        sa.Column(
            "profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("technician_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "brand_key",
            sa.String(40),
            sa.ForeignKey("taxonomy_brands.brand_key"),
            nullable=False,
        ),
        sa.Column(
            "is_authorized",
            sa.Boolean,
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "is_premium_authorized",
            sa.Boolean,
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("notes", sa.Text),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("profile_id", "brand_key"),
    )
    op.create_index(
        "ix_tech_brands_brand",
        "technician_brand_coverage",
        ["brand_key", "profile_id"],
    )
    op.create_index(
        "ix_tech_brands_authorized",
        "technician_brand_coverage",
        ["profile_id"],
        postgresql_where=sa.text("is_authorized = TRUE"),
    )


def _drivetrain_coverage() -> None:
    op.create_table(
        "technician_drivetrain_coverage",
        sa.Column(
            "profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("technician_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "drivetrain_key",
            sa.String(40),
            sa.ForeignKey("taxonomy_drivetrains.drivetrain_key"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("profile_id", "drivetrain_key"),
    )


def _service_area() -> None:
    op.create_table(
        "technician_service_area",
        sa.Column(
            "profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("technician_profiles.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("workshop_lat", sa.Numeric(9, 6), nullable=False),
        sa.Column("workshop_lng", sa.Numeric(9, 6), nullable=False),
        sa.Column(
            "service_radius_km",
            sa.Integer,
            nullable=False,
            server_default="15",
        ),
        sa.Column(
            "city_code",
            sa.String(8),
            sa.ForeignKey("taxonomy_cities.city_code"),
            nullable=False,
        ),
        sa.Column(
            "primary_district_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("taxonomy_districts.district_id"),
        ),
        sa.Column(
            "mobile_unit_count",
            sa.SmallInteger,
            nullable=False,
            server_default="0",
        ),
        sa.Column("workshop_address", sa.Text),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "service_radius_km BETWEEN 1 AND 500",
            name="ck_tech_area_radius",
        ),
    )
    op.create_index(
        "ix_tech_area_city", "technician_service_area", ["city_code"]
    )


def _working_districts() -> None:
    op.create_table(
        "technician_working_districts",
        sa.Column(
            "profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("technician_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "district_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("taxonomy_districts.district_id"),
            nullable=False,
        ),
        sa.Column(
            "is_auto_suggested",
            sa.Boolean,
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("profile_id", "district_id"),
    )
    op.create_index(
        "ix_tech_districts_district",
        "technician_working_districts",
        ["district_id", "profile_id"],
    )


def _working_schedule() -> None:
    op.create_table(
        "technician_working_schedule",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("technician_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("weekday", sa.SmallInteger, nullable=False),
        sa.Column("open_time", sa.Time),
        sa.Column("close_time", sa.Time),
        sa.Column(
            "is_closed", sa.Boolean, nullable=False, server_default=sa.false()
        ),
        sa.Column(
            "slot_order", sa.SmallInteger, nullable=False, server_default="0"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint("weekday BETWEEN 0 AND 6", name="ck_tech_schedule_weekday"),
        sa.CheckConstraint(
            "(is_closed = TRUE) OR (open_time IS NOT NULL AND close_time IS NOT NULL AND close_time > open_time)",
            name="ck_tech_schedule_times",
        ),
        sa.UniqueConstraint(
            "profile_id", "weekday", "slot_order",
            name="uq_tech_schedule_profile_weekday_slot",
        ),
    )
    op.create_index(
        "ix_tech_schedule_profile",
        "technician_working_schedule",
        ["profile_id", "weekday"],
    )


def _capacity() -> None:
    op.create_table(
        "technician_capacity",
        sa.Column(
            "profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("technician_profiles.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "staff_count", sa.SmallInteger, nullable=False, server_default="1"
        ),
        sa.Column(
            "max_concurrent_jobs",
            sa.SmallInteger,
            nullable=False,
            server_default="3",
        ),
        sa.Column(
            "night_service", sa.Boolean, nullable=False, server_default=sa.false()
        ),
        sa.Column(
            "weekend_service",
            sa.Boolean,
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "emergency_service",
            sa.Boolean,
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "current_queue_depth",
            sa.SmallInteger,
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def _performance_snapshots() -> None:
    op.create_table(
        "technician_performance_snapshots",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("technician_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("window_days", sa.SmallInteger, nullable=False),
        sa.Column(
            "snapshot_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "completed_jobs", sa.Integer, nullable=False, server_default="0"
        ),
        sa.Column("rating_bayesian", sa.Numeric(3, 2)),
        sa.Column(
            "rating_count", sa.Integer, nullable=False, server_default="0"
        ),
        sa.Column("response_time_p50_minutes", sa.Integer),
        sa.Column("on_time_rate", sa.Numeric(4, 3)),
        sa.Column("cancellation_rate", sa.Numeric(4, 3)),
        sa.Column("dispute_rate", sa.Numeric(4, 3)),
        sa.Column("warranty_honor_rate", sa.Numeric(4, 3)),
        sa.Column("evidence_discipline_score", sa.Numeric(4, 3)),
        sa.Column("hidden_cost_rate", sa.Numeric(4, 3)),
        sa.Column("market_band_percentile", sa.SmallInteger),
        sa.UniqueConstraint(
            "profile_id", "window_days", "snapshot_at",
            name="uq_tech_perf_snapshot",
        ),
    )
    op.create_index(
        "ix_tech_perf_latest",
        "technician_performance_snapshots",
        ["profile_id", "window_days", sa.text("snapshot_at DESC")],
    )
