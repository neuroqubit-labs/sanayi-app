"""case matching and technician notifications

Revision ID: 20260426_0044
Revises: 20260425_0043
Create Date: 2026-04-26 21:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260426_0044"
down_revision: str | None = "20260425_0043"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


match_visibility = postgresql.ENUM(
    "candidate",
    "shown_to_customer",
    "hidden",
    "invalidated",
    name="case_technician_match_visibility",
    create_type=False,
)
match_source = postgresql.ENUM(
    "system",
    "customer_notify",
    "manual",
    name="case_technician_match_source",
    create_type=False,
)
notification_status = postgresql.ENUM(
    "sent",
    "seen",
    "dismissed",
    "offer_created",
    "expired",
    name="case_technician_notification_status",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            DO $$ BEGIN
                CREATE TYPE case_technician_match_visibility AS ENUM (
                    'candidate','shown_to_customer','hidden','invalidated'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
    )
    bind.execute(
        sa.text(
            """
            DO $$ BEGIN
                CREATE TYPE case_technician_match_source AS ENUM (
                    'system','customer_notify','manual'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
    )
    bind.execute(
        sa.text(
            """
            DO $$ BEGIN
                CREATE TYPE case_technician_notification_status AS ENUM (
                    'sent','seen','dismissed','offer_created','expired'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
    )

    op.create_table(
        "case_technician_matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("technician_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("technician_profile_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("score", sa.Numeric(6, 2), server_default="0", nullable=False),
        sa.Column("reason_codes", postgresql.ARRAY(sa.String()), server_default="{}", nullable=False),
        sa.Column("reason_label", sa.String(length=255), nullable=False),
        sa.Column("visibility_state", match_visibility, nullable=False),
        sa.Column("source", match_source, nullable=False),
        sa.Column("context", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("invalidated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("score >= 0", name="ck_case_technician_matches_score_nonneg"),
        sa.ForeignKeyConstraint(["case_id"], ["service_cases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["technician_profile_id"], ["technician_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["technician_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("case_id", "technician_user_id", name="uq_case_technician_matches_case_tech"),
    )
    op.create_index("ix_case_technician_matches_case", "case_technician_matches", ["case_id"])
    op.create_index(
        "ix_case_technician_matches_technician",
        "case_technician_matches",
        ["technician_user_id", "computed_at"],
    )

    op.create_table(
        "case_technician_notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("technician_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("technician_profile_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("match_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", notification_status, nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["case_id"], ["service_cases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["customer_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["match_id"], ["case_technician_matches.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["technician_profile_id"], ["technician_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["technician_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("case_id", "technician_user_id", name="uq_case_technician_notifications_case_tech"),
    )
    op.create_index("ix_case_technician_notifications_case", "case_technician_notifications", ["case_id"])
    op.create_index(
        "ix_case_technician_notifications_technician",
        "case_technician_notifications",
        ["technician_user_id", "status", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_case_technician_notifications_technician", table_name="case_technician_notifications")
    op.drop_index("ix_case_technician_notifications_case", table_name="case_technician_notifications")
    op.drop_table("case_technician_notifications")
    op.drop_index("ix_case_technician_matches_technician", table_name="case_technician_matches")
    op.drop_index("ix_case_technician_matches_case", table_name="case_technician_matches")
    op.drop_table("case_technician_matches")
    notification_status.drop(op.get_bind(), checkfirst=True)
    match_source.drop(op.get_bind(), checkfirst=True)
    match_visibility.drop(op.get_bind(), checkfirst=True)
