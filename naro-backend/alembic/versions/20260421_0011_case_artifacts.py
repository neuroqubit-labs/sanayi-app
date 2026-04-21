"""case_artifacts: evidence_items + documents + attachments + 2 M:N link

Revision ID: 20260421_0011
Revises: 20260421_0010
Create Date: 2026-04-21 13:00:00.000000

Faz 7b — kanıt + belge + ek + M:N link tabloları. Medya FK'sı SET NULL
(audit + case geçmişi korunur).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260421_0011"
down_revision: str | None = "20260421_0010"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


case_attachment_kind = postgresql.ENUM(
    "photo", "video", "audio", "invoice", "report", "document", "location",
    name="case_attachment_kind", create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    case_attachment_kind.create(bind, checkfirst=True)

    # ── case_evidence_items ──
    if not inspector.has_table("case_evidence_items"):
        op.create_table(
            "case_evidence_items",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("case_id", sa.UUID(), nullable=False),
            sa.Column("task_id", sa.UUID(), nullable=True),
            sa.Column("milestone_id", sa.UUID(), nullable=True),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("subtitle", sa.String(length=255), nullable=True),
            sa.Column("kind", case_attachment_kind, nullable=False),
            sa.Column("actor", sa.String(length=32), nullable=False),
            sa.Column("source_label", sa.String(length=255), nullable=False),
            sa.Column("status_label", sa.String(length=255), nullable=False),
            sa.Column("media_asset_id", sa.UUID(), nullable=True),
            sa.Column("is_new", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["case_id"], ["service_cases.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["task_id"], ["case_tasks.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["milestone_id"], ["case_milestones.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["media_asset_id"], ["media_assets.id"], ondelete="SET NULL"),
            sa.CheckConstraint(
                "actor IN ('customer','technician','system')",
                name="ck_case_evidence_actor",
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_case_evidence_case",
            "case_evidence_items",
            ["case_id", sa.text("created_at DESC")],
            unique=False,
        )
        op.create_index(
            "ix_case_evidence_task",
            "case_evidence_items",
            ["task_id"],
            unique=False,
            postgresql_where=sa.text("task_id IS NOT NULL"),
        )
        op.create_index(
            "ix_case_evidence_new",
            "case_evidence_items",
            ["case_id", "is_new"],
            unique=False,
            postgresql_where=sa.text("is_new IS TRUE"),
        )

    # ── case_documents ──
    if not inspector.has_table("case_documents"):
        op.create_table(
            "case_documents",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("case_id", sa.UUID(), nullable=False),
            sa.Column("kind", case_attachment_kind, nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("subtitle", sa.String(length=255), nullable=True),
            sa.Column("source_label", sa.String(length=255), nullable=False),
            sa.Column("status_label", sa.String(length=255), nullable=False),
            sa.Column("media_asset_id", sa.UUID(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["case_id"], ["service_cases.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["media_asset_id"], ["media_assets.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_case_documents_case",
            "case_documents",
            ["case_id", sa.text("created_at DESC")],
            unique=False,
        )

    # ── case_attachments ──
    if not inspector.has_table("case_attachments"):
        op.create_table(
            "case_attachments",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("case_id", sa.UUID(), nullable=False),
            sa.Column("kind", case_attachment_kind, nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("subtitle", sa.String(length=255), nullable=True),
            sa.Column("status_label", sa.String(length=255), nullable=True),
            sa.Column("media_asset_id", sa.UUID(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["case_id"], ["service_cases.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["media_asset_id"], ["media_assets.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_case_attachments_case",
            "case_attachments",
            ["case_id"],
            unique=False,
        )

    # ── M:N link: case_approval_evidence_links ──
    if not inspector.has_table("case_approval_evidence_links"):
        op.create_table(
            "case_approval_evidence_links",
            sa.Column("approval_id", sa.UUID(), nullable=False),
            sa.Column("evidence_id", sa.UUID(), nullable=False),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["approval_id"], ["case_approvals.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["evidence_id"], ["case_evidence_items.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("approval_id", "evidence_id", name="pk_case_approval_evidence_links"),
        )

    # ── M:N link: case_task_evidence_links ──
    if not inspector.has_table("case_task_evidence_links"):
        op.create_table(
            "case_task_evidence_links",
            sa.Column("task_id", sa.UUID(), nullable=False),
            sa.Column("evidence_id", sa.UUID(), nullable=False),
            sa.Column("requirement_id", sa.String(length=64), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["task_id"], ["case_tasks.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["evidence_id"], ["case_evidence_items.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("task_id", "evidence_id", name="pk_case_task_evidence_links"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    for table in [
        "case_task_evidence_links",
        "case_approval_evidence_links",
    ]:
        if inspector.has_table(table):
            op.drop_table(table)

    if inspector.has_table("case_attachments"):
        op.drop_index("ix_case_attachments_case", table_name="case_attachments")
        op.drop_table("case_attachments")

    if inspector.has_table("case_documents"):
        op.drop_index("ix_case_documents_case", table_name="case_documents")
        op.drop_table("case_documents")

    if inspector.has_table("case_evidence_items"):
        op.drop_index("ix_case_evidence_new", table_name="case_evidence_items")
        op.drop_index("ix_case_evidence_task", table_name="case_evidence_items")
        op.drop_index("ix_case_evidence_case", table_name="case_evidence_items")
        op.drop_table("case_evidence_items")

    case_attachment_kind.drop(bind, checkfirst=True)
