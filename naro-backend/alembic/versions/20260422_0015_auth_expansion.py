"""auth_expansion: user_identities + auth_events + auth_sessions extension (Faz 9a)

Revision ID: 20260422_0015
Revises: 20260421_0014
Create Date: 2026-04-22 09:00:00.000000

Faz 9a:
- 2 yeni tablo: user_identities (account linking), auth_events (append-only audit)
- 2 yeni enum: auth_identity_provider (4), auth_event_type (21)
- auth_sessions'a 3 yeni kolon: token_family_id, parent_session_id, issued_via
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers
revision: str = "20260422_0015"
down_revision: str | None = "20260421_0014"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


auth_identity_provider = postgresql.ENUM(
    "otp_phone", "otp_email", "oauth_google", "oauth_apple",
    name="auth_identity_provider", create_type=False,
)
auth_event_type = postgresql.ENUM(
    "otp_requested", "otp_verified", "otp_failed",
    "login_success", "login_failed",
    "refresh_rotated", "refresh_reused_attack",
    "logout", "logout_all",
    "oauth_authorize", "oauth_callback_success", "oauth_callback_failed",
    "identity_linked", "identity_unlinked",
    "session_revoked", "session_revoked_all",
    "lockout_triggered", "lockout_cleared",
    "rate_limit_breach", "suspicious_login", "account_soft_deleted",
    name="auth_event_type", create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    auth_identity_provider.create(bind, checkfirst=True)
    auth_event_type.create(bind, checkfirst=True)

    # ── user_identities ──
    if not inspector.has_table("user_identities"):
        op.create_table(
            "user_identities",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("user_id", sa.UUID(), nullable=False),
            sa.Column("provider", auth_identity_provider, nullable=False),
            sa.Column("provider_user_id", sa.String(length=255), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=True),
            sa.Column(
                "raw_profile",
                postgresql.JSONB(),
                nullable=False,
                server_default=sa.text("'{}'::jsonb"),
            ),
            sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
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
            sa.ForeignKeyConstraint(
                ["user_id"], ["users.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "uq_user_identities_provider",
            "user_identities",
            ["provider", "provider_user_id"],
            unique=True,
        )
        op.create_index(
            "ix_user_identities_user",
            "user_identities",
            ["user_id", "provider"],
            unique=False,
        )
        op.create_index(
            "ix_user_identities_email",
            "user_identities",
            ["email"],
            unique=False,
            postgresql_where=sa.text("email IS NOT NULL"),
        )

    # ── auth_sessions extension ──
    if not _column_exists(inspector, "auth_sessions", "token_family_id"):
        op.add_column(
            "auth_sessions",
            sa.Column("token_family_id", sa.UUID(), nullable=True),
        )
        op.create_index(
            "ix_auth_sessions_family",
            "auth_sessions",
            ["token_family_id"],
            unique=False,
            postgresql_where=sa.text("token_family_id IS NOT NULL"),
        )
    if not _column_exists(inspector, "auth_sessions", "parent_session_id"):
        op.add_column(
            "auth_sessions",
            sa.Column("parent_session_id", sa.UUID(), nullable=True),
        )
        op.create_foreign_key(
            "auth_sessions_parent_session_id_fkey",
            "auth_sessions",
            "auth_sessions",
            ["parent_session_id"],
            ["id"],
            ondelete="SET NULL",
        )
    if not _column_exists(inspector, "auth_sessions", "issued_via"):
        op.add_column(
            "auth_sessions",
            sa.Column(
                "issued_via",
                auth_identity_provider,
                nullable=False,
                server_default="otp_phone",
            ),
        )

    # ── auth_events ──
    if not inspector.has_table("auth_events"):
        op.create_table(
            "auth_events",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("user_id", sa.UUID(), nullable=True),
            sa.Column("session_id", sa.UUID(), nullable=True),
            sa.Column("event_type", auth_event_type, nullable=False),
            sa.Column(
                "actor",
                sa.String(length=32),
                nullable=False,
                server_default="user",
            ),
            sa.Column("ip_address", postgresql.INET(), nullable=True),
            sa.Column("user_agent", sa.String(length=512), nullable=True),
            sa.Column("target", sa.String(length=255), nullable=True),
            sa.Column(
                "context",
                postgresql.JSONB(),
                nullable=False,
                server_default=sa.text("'{}'::jsonb"),
            ),
            sa.Column("body", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.CheckConstraint(
                "actor IN ('user','system','admin')",
                name="ck_auth_events_actor",
            ),
            sa.ForeignKeyConstraint(
                ["user_id"], ["users.id"], ondelete="SET NULL"
            ),
            sa.ForeignKeyConstraint(
                ["session_id"], ["auth_sessions.id"], ondelete="SET NULL"
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_auth_events_user_created",
            "auth_events",
            ["user_id", sa.text("created_at DESC")],
            unique=False,
        )
        op.create_index(
            "ix_auth_events_ip_created",
            "auth_events",
            ["ip_address", sa.text("created_at DESC")],
            unique=False,
            postgresql_where=sa.text("ip_address IS NOT NULL"),
        )
        op.create_index(
            "ix_auth_events_type",
            "auth_events",
            ["event_type", sa.text("created_at DESC")],
            unique=False,
        )
        op.create_index(
            "ix_auth_events_lockout",
            "auth_events",
            ["target", sa.text("created_at DESC")],
            unique=False,
            postgresql_where=sa.text(
                "event_type IN ('otp_failed','login_failed')"
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("auth_events"):
        op.drop_index("ix_auth_events_lockout", table_name="auth_events")
        op.drop_index("ix_auth_events_type", table_name="auth_events")
        op.drop_index("ix_auth_events_ip_created", table_name="auth_events")
        op.drop_index("ix_auth_events_user_created", table_name="auth_events")
        op.drop_table("auth_events")

    if _column_exists(inspector, "auth_sessions", "issued_via"):
        op.drop_column("auth_sessions", "issued_via")
    if _column_exists(inspector, "auth_sessions", "parent_session_id"):
        op.drop_constraint(
            "auth_sessions_parent_session_id_fkey",
            "auth_sessions",
            type_="foreignkey",
        )
        op.drop_column("auth_sessions", "parent_session_id")
    if _column_exists(inspector, "auth_sessions", "token_family_id"):
        op.drop_index("ix_auth_sessions_family", table_name="auth_sessions")
        op.drop_column("auth_sessions", "token_family_id")

    if inspector.has_table("user_identities"):
        op.drop_index("ix_user_identities_email", table_name="user_identities")
        op.drop_index("ix_user_identities_user", table_name="user_identities")
        op.drop_index("uq_user_identities_provider", table_name="user_identities")
        op.drop_table("user_identities")

    auth_event_type.drop(bind, checkfirst=True)
    auth_identity_provider.drop(bind, checkfirst=True)


def _column_exists(inspector, table: str, column: str) -> bool:  # type: ignore[no-untyped-def]
    if not inspector.has_table(table):
        return False
    return any(col["name"] == column for col in inspector.get_columns(table))
