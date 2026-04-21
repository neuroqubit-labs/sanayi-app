"""identity: extend users + add auth_sessions + otp_codes

Revision ID: 20260420_0002
Revises: 20260420_0001
Create Date: 2026-04-20 14:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260420_0002"
down_revision: str | None = "20260420_0001"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


user_approval_status = postgresql.ENUM(
    "pending",
    "active",
    "suspended",
    "rejected",
    name="user_approval_status",
    create_type=False,
)
otp_channel = postgresql.ENUM(
    "sms",
    "console",
    "whatsapp",
    name="otp_channel",
    create_type=False,
)
user_role = postgresql.ENUM(
    "customer",
    "technician",
    "admin",
    name="user_role",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    user_approval_status.create(bind, checkfirst=True)
    otp_channel.create(bind, checkfirst=True)

    # ── users: new columns ──
    user_cols = {col["name"] for col in inspector.get_columns("users")}
    if "approval_status" not in user_cols:
        op.add_column(
            "users",
            sa.Column("approval_status", user_approval_status, nullable=True),
        )
    if "locale" not in user_cols:
        op.add_column(
            "users",
            sa.Column(
                "locale",
                sa.String(length=10),
                nullable=False,
                server_default="tr-TR",
            ),
        )
    if "last_login_at" not in user_cols:
        op.add_column(
            "users",
            sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        )
    if "deleted_at" not in user_cols:
        op.add_column(
            "users",
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )

    # ── auth_sessions ──
    if not inspector.has_table("auth_sessions"):
        op.create_table(
            "auth_sessions",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("user_id", sa.UUID(), nullable=False),
            sa.Column("refresh_token_hash", sa.String(length=128), nullable=False),
            sa.Column("device_label", sa.String(length=255), nullable=True),
            sa.Column("ip_address", postgresql.INET(), nullable=True),
            sa.Column("user_agent", sa.String(length=512), nullable=True),
            sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
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
            sa.UniqueConstraint("refresh_token_hash", name="uq_auth_sessions_refresh_token_hash"),
        )
        op.create_index(
            "ix_auth_sessions_user_id", "auth_sessions", ["user_id"], unique=False
        )
        op.create_index(
            "ix_auth_sessions_expires_at_active",
            "auth_sessions",
            ["expires_at"],
            unique=False,
            postgresql_where=sa.text("revoked_at IS NULL"),
        )

    # ── otp_codes ──
    if not inspector.has_table("otp_codes"):
        op.create_table(
            "otp_codes",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("phone", sa.String(length=32), nullable=False),
            sa.Column("channel", otp_channel, nullable=False),
            sa.Column("code_hash", sa.String(length=128), nullable=False),
            sa.Column("target_role", user_role, nullable=False),
            sa.Column("delivery_id", sa.String(length=128), nullable=True),
            sa.Column("attempts", sa.SmallInteger(), nullable=False, server_default="0"),
            sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_otp_codes_phone_created",
            "otp_codes",
            ["phone", sa.text("created_at DESC")],
            unique=False,
        )
        op.create_index(
            "ix_otp_codes_expires_active",
            "otp_codes",
            ["expires_at"],
            unique=False,
            postgresql_where=sa.text("consumed_at IS NULL"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("otp_codes"):
        op.drop_index("ix_otp_codes_expires_active", table_name="otp_codes")
        op.drop_index("ix_otp_codes_phone_created", table_name="otp_codes")
        op.drop_table("otp_codes")

    if inspector.has_table("auth_sessions"):
        op.drop_index(
            "ix_auth_sessions_expires_at_active", table_name="auth_sessions"
        )
        op.drop_index("ix_auth_sessions_user_id", table_name="auth_sessions")
        op.drop_table("auth_sessions")

    user_cols = {col["name"] for col in inspector.get_columns("users")}
    if "deleted_at" in user_cols:
        op.drop_column("users", "deleted_at")
    if "last_login_at" in user_cols:
        op.drop_column("users", "last_login_at")
    if "locale" in user_cols:
        op.drop_column("users", "locale")
    if "approval_status" in user_cols:
        op.drop_column("users", "approval_status")

    otp_channel.drop(bind, checkfirst=True)
    user_approval_status.drop(bind, checkfirst=True)
