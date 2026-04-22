"""reviews table (Faz A PR 8) — case × reviewer unique + rating 1-5

Revision ID: 20260422_0026
Revises: 20260422_0025
Create Date: 2026-04-22 13:30:00.000000

Müşteri vaka tamamlandıktan sonra usta puanlaması. `rating_bayesian`
aggregate (TechnicianPerformanceSnapshot) bu tablodan beslenir (ARQ cron
Faz 14).

UNIQUE (case_id, reviewer_user_id) — 1 vaka × 1 reviewer; double-review
engel DB-enforce.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260422_0026"
down_revision: str | None = "20260422_0025"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "reviews",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "case_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_cases.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "reviewer_user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "reviewee_user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("rating", sa.SmallInteger(), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("response_body", sa.Text(), nullable=True),
        sa.Column(
            "responded_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "rating BETWEEN 1 AND 5", name="ck_reviews_rating_range"
        ),
        sa.UniqueConstraint(
            "case_id", "reviewer_user_id", name="uq_reviews_case_reviewer"
        ),
    )
    op.create_index(
        "ix_reviews_reviewee_created",
        "reviews",
        ["reviewee_user_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_reviews_reviewer",
        "reviews",
        ["reviewer_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_reviews_reviewer", table_name="reviews")
    op.drop_index("ix_reviews_reviewee_created", table_name="reviews")
    op.drop_table("reviews")
