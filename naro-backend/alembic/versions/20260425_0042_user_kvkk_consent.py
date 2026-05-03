"""users.kvkk_consented_at column

Revision ID: 20260425_0042
Revises: 20260425_0041
Create Date: 2026-04-25 21:00:00.000000

Plan: customer-app auth + register uçtan uca kurgu (Faz 1.2).

Login altında pasif kabul edilen KVKK + Kullanım koşulları onayının
timestamp'i kayıt altına alınır. Mobile profile-setup submit anında
PATCH /users/me ile yazılır (industry-standard pasif kabul).

Backlog: detaylı consent kayıtları için ayrı `user_consents` tablosu
(versiyon + KVKK / pazarlama / üçüncü taraf paylaşım kategorileri) —
V1.1+. Bu MVP yalnızca KVKK kabul timestamp'ini tutar.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260425_0042"
down_revision: str | None = "20260425_0041"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {col["name"] for col in inspector.get_columns("users")}

    if "kvkk_consented_at" not in existing_cols:
        op.add_column(
            "users",
            sa.Column(
                "kvkk_consented_at",
                sa.DateTime(timezone=True),
                nullable=True,
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {col["name"] for col in inspector.get_columns("users")}

    if "kvkk_consented_at" in existing_cols:
        op.drop_column("users", "kvkk_consented_at")
