"""case_communication: threads + messages + message_attachments

Revision ID: 20260421_0012
Revises: 20260421_0011
Create Date: 2026-04-21 14:00:00.000000

Faz 7c — thread-only iletişim. Case başına 1 thread; system mesajları
author_user_id=NULL; message attachments M:N (cascade her iki taraf).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260421_0012"
down_revision: str | None = "20260421_0011"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # ── case_threads ──
    if not inspector.has_table("case_threads"):
        op.create_table(
            "case_threads",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("case_id", sa.UUID(), nullable=False),
            sa.Column("preview", sa.String(length=512), nullable=True),
            sa.Column("unread_customer", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("unread_technician", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["case_id"], ["service_cases.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("case_id", name="uq_case_threads_case_id"),
        )

    # ── case_messages ──
    if not inspector.has_table("case_messages"):
        op.create_table(
            "case_messages",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("thread_id", sa.UUID(), nullable=False),
            sa.Column("case_id", sa.UUID(), nullable=False),
            sa.Column("author_user_id", sa.UUID(), nullable=True),
            sa.Column("author_role", sa.String(length=16), nullable=False),
            sa.Column("author_snapshot_name", sa.String(length=255), nullable=True),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.CheckConstraint(
                "author_role IN ('customer','technician','system')",
                name="ck_case_messages_author_role",
            ),
            sa.ForeignKeyConstraint(["thread_id"], ["case_threads.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["case_id"], ["service_cases.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["author_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_case_messages_thread_created",
            "case_messages",
            ["thread_id", sa.text("created_at DESC")],
            unique=False,
        )
        op.create_index(
            "ix_case_messages_case",
            "case_messages",
            ["case_id", sa.text("created_at DESC")],
            unique=False,
        )

    # ── case_message_attachments ──
    if not inspector.has_table("case_message_attachments"):
        op.create_table(
            "case_message_attachments",
            sa.Column("message_id", sa.UUID(), nullable=False),
            sa.Column("media_asset_id", sa.UUID(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["message_id"], ["case_messages.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["media_asset_id"], ["media_assets.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("message_id", "media_asset_id"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("case_message_attachments"):
        op.drop_table("case_message_attachments")
    if inspector.has_table("case_messages"):
        op.drop_index("ix_case_messages_case", table_name="case_messages")
        op.drop_index("ix_case_messages_thread_created", table_name="case_messages")
        op.drop_table("case_messages")
    if inspector.has_table("case_threads"):
        op.drop_table("case_threads")
