"""case public showcases

Revision ID: 20260424_0039
Revises: 20260424_0038
Create Date: 2026-04-24 20:00:00.000000

Tamamlanan vaka özetlerinin iki taraf onayıyla public usta profilinde
görünmesi için PII-safe showcase tabloları.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260424_0039"
down_revision: str | None = "20260424_0038"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


showcase_status = postgresql.ENUM(
    "pending_customer",
    "pending_technician",
    "published",
    "revoked",
    "hidden",
    name="case_public_showcase_status",
    create_type=False,
)
service_request_kind = postgresql.ENUM(
    "accident",
    "towing",
    "breakdown",
    "maintenance",
    name="service_request_kind",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    showcase_status.create(bind, checkfirst=True)

    if not inspector.has_table("case_public_showcases"):
        op.create_table(
            "case_public_showcases",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("case_id", sa.UUID(), nullable=False),
            sa.Column("technician_profile_id", sa.UUID(), nullable=False),
            sa.Column("technician_user_id", sa.UUID(), nullable=False),
            sa.Column("customer_user_id", sa.UUID(), nullable=False),
            sa.Column("review_id", sa.UUID(), nullable=True),
            sa.Column("kind", service_request_kind, nullable=False),
            sa.Column(
                "status",
                showcase_status,
                server_default="pending_customer",
                nullable=False,
            ),
            sa.Column(
                "public_snapshot",
                postgresql.JSONB(astext_type=sa.Text()),
                server_default=sa.text("'{}'::jsonb"),
                nullable=False,
            ),
            sa.Column("technician_consented_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("customer_consented_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("technician_revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("customer_revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("hidden_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["case_id"], ["service_cases.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["technician_profile_id"], ["technician_profiles.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["technician_user_id"], ["users.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["customer_user_id"], ["users.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["review_id"], ["reviews.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("case_id", name="uq_case_public_showcases_case"),
        )
        op.create_index(
            "ix_case_public_showcases_profile_status",
            "case_public_showcases",
            ["technician_profile_id", "status", sa.text("published_at DESC")],
            unique=False,
        )
        op.create_index(
            "ix_case_public_showcases_customer",
            "case_public_showcases",
            ["customer_user_id"],
            unique=False,
        )

    if not inspector.has_table("case_public_showcase_media"):
        op.create_table(
            "case_public_showcase_media",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("showcase_id", sa.UUID(), nullable=False),
            sa.Column("media_asset_id", sa.UUID(), nullable=True),
            sa.Column("evidence_id", sa.UUID(), nullable=True),
            sa.Column("kind", sa.String(length=16), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=True),
            sa.Column("caption", sa.Text(), nullable=True),
            sa.Column("sequence", sa.SmallInteger(), server_default="0", nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["showcase_id"], ["case_public_showcases.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["media_asset_id"], ["media_assets.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["evidence_id"], ["case_evidence_items.id"], ondelete="SET NULL"),
            sa.CheckConstraint("sequence >= 0", name="ck_case_public_showcase_media_seq"),
            sa.CheckConstraint("kind IN ('photo','video')", name="ck_case_public_showcase_media_kind"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_case_public_showcase_media_showcase_seq",
            "case_public_showcase_media",
            ["showcase_id", "sequence"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("case_public_showcase_media"):
        op.drop_index(
            "ix_case_public_showcase_media_showcase_seq",
            table_name="case_public_showcase_media",
        )
        op.drop_table("case_public_showcase_media")
    if inspector.has_table("case_public_showcases"):
        op.drop_index(
            "ix_case_public_showcases_customer",
            table_name="case_public_showcases",
        )
        op.drop_index(
            "ix_case_public_showcases_profile_status",
            table_name="case_public_showcases",
        )
        op.drop_table("case_public_showcases")
    showcase_status.drop(op.get_bind(), checkfirst=True)
