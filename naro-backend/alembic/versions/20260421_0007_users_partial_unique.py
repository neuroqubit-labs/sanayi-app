"""users: partial unique phone/email (KVKK soft delete uyumluluk)

Revision ID: 20260421_0007
Revises: 20260420_0006
Create Date: 2026-04-21 09:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260421_0007"
down_revision: str | None = "20260420_0006"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # Eski tam unique index'leri düşür
    op.drop_index("ix_users_phone", table_name="users")
    op.drop_index("ix_users_email", table_name="users")

    # Partial unique index (sadece aktif user için geçerli)
    op.create_index(
        "uq_users_phone",
        "users",
        ["phone"],
        unique=True,
        postgresql_where=sa.text("phone IS NOT NULL AND deleted_at IS NULL"),
    )
    op.create_index(
        "uq_users_email",
        "users",
        ["email"],
        unique=True,
        postgresql_where=sa.text("email IS NOT NULL AND deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_users_email", table_name="users")
    op.drop_index("uq_users_phone", table_name="users")

    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_phone", "users", ["phone"], unique=True)
