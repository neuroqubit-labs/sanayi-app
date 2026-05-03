"""user_push_tokens table — push notification token registry

Revision ID: 20260503_0048
Revises: 20260426_0047
Create Date: 2026-05-03 18:30:00.000000

Plan: P1.7 push notification ALMA iskeleti. Mobil app bootstrap'te device
push token (FCM/APN, ya da Expo push token) alır ve POST /users/me/push-tokens
ile bu tabloya idempotent yazar. (user_id, device_id) unique → aynı cihaz
yeniden register olursa UPDATE.

V1.1: gönderme akışı bu tabloyu okuyup FCM/APN provider'a forward eder.
last_seen_at periyodik temizlik (stale token cleanup) için izlenir.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260503_0048"
down_revision: str | None = "20260426_0047"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "user_push_tokens" in inspector.get_table_names():
        return

    push_platform = postgresql.ENUM(
        "ios", "android", name="push_platform", create_type=False
    )
    push_platform.create(bind, checkfirst=True)

    op.create_table(
        "user_push_tokens",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("platform", push_platform, nullable=False),
        sa.Column("token", sa.String(length=512), nullable=False),
        sa.Column("device_id", sa.String(length=255), nullable=False),
        sa.Column("app_version", sa.String(length=32), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
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
    )
    op.create_index(
        "ix_user_push_tokens_user_id",
        "user_push_tokens",
        ["user_id"],
    )
    op.create_unique_constraint(
        "uq_user_push_tokens_user_device",
        "user_push_tokens",
        ["user_id", "device_id"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "user_push_tokens" in inspector.get_table_names():
        op.drop_constraint(
            "uq_user_push_tokens_user_device",
            "user_push_tokens",
            type_="unique",
        )
        op.drop_index(
            "ix_user_push_tokens_user_id", table_name="user_push_tokens"
        )
        op.drop_table("user_push_tokens")

    push_platform = postgresql.ENUM(
        "ios", "android", name="push_platform", create_type=False
    )
    push_platform.drop(bind, checkfirst=True)
