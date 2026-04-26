"""add case service tags and technician vehicle kind coverage

Revision ID: 20260426_0047
Revises: 20260426_0046
Create Date: 2026-04-26 23:58:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260426_0047"
down_revision: str | None = "20260426_0046"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "case_service_tags",
        sa.Column("case_id", sa.UUID(), nullable=False),
        sa.Column("tag_key", sa.String(length=60), nullable=False),
        sa.Column(
            "source",
            sa.String(length=16),
            nullable=False,
            server_default="composer",
        ),
        sa.Column(
            "confidence",
            sa.Numeric(3, 2),
            nullable=False,
            server_default="1.00",
        ),
        sa.Column("id", sa.UUID(), nullable=False),
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
        sa.CheckConstraint(
            "confidence >= 0 AND confidence <= 1",
            name="ck_case_service_tags_confidence",
        ),
        sa.CheckConstraint(
            "source IN ('composer','system')",
            name="ck_case_service_tags_source",
        ),
        sa.ForeignKeyConstraint(
            ["case_id"], ["service_cases.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "case_id", "tag_key", name="uq_case_service_tags_case_tag"
        ),
    )
    op.create_index(
        "ix_case_service_tags_case_id",
        "case_service_tags",
        ["case_id"],
    )
    op.create_index(
        "ix_case_service_tags_tag_key",
        "case_service_tags",
        ["tag_key"],
    )

    vehicle_kind = postgresql.ENUM(name="vehicle_kind", create_type=False)
    op.create_table(
        "technician_vehicle_kind_coverage",
        sa.Column("profile_id", sa.UUID(), nullable=False),
        sa.Column("vehicle_kind", vehicle_kind, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["profile_id"], ["technician_profiles.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("profile_id", "vehicle_kind"),
    )


def downgrade() -> None:
    op.drop_table("technician_vehicle_kind_coverage")
    op.drop_index("ix_case_service_tags_tag_key", table_name="case_service_tags")
    op.drop_index("ix_case_service_tags_case_id", table_name="case_service_tags")
    op.drop_table("case_service_tags")
