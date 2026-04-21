"""appointments: source + counter_proposal + counter_pending enum (Kural 5)

Revision ID: 20260421_0009
Revises: 20260421_0008
Create Date: 2026-04-21 11:00:00.000000

Not: ADD VALUE 'counter_pending' PG 12+ transaction içinde çalışır ama aynı
işlemde kullanılamaz; bu yüzden downgrade'de enum değerini silemiyoruz
(PG desteklemez) — downgrade enum'u olduğu gibi bırakır. Uygulama seviyesi
kod COUNTER_PENDING statüsünü tanır/tanımaz.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260421_0009"
down_revision: str | None = "20260421_0008"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # PG enum genişletme (downgrade imkansız — tek yönlü)
    op.execute("ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'counter_pending'")

    # appointments tablosuna yeni kolonlar
    op.add_column(
        "appointments",
        sa.Column(
            "source",
            sa.String(length=16),
            nullable=False,
            server_default="offer_accept",
        ),
    )
    op.add_column(
        "appointments",
        sa.Column("counter_proposal", sa.dialects.postgresql.JSONB(), nullable=True),
    )
    op.add_column(
        "appointments",
        sa.Column("counter_proposal_by_user_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "appointments_counter_proposal_by_user_id_fkey",
        "appointments",
        "users",
        ["counter_proposal_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_check_constraint(
        "ck_appointments_source",
        "appointments",
        "source IN ('offer_accept','direct_request','counter')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_appointments_source", "appointments", type_="check")
    op.drop_constraint(
        "appointments_counter_proposal_by_user_id_fkey",
        "appointments",
        type_="foreignkey",
    )
    op.drop_column("appointments", "counter_proposal_by_user_id")
    op.drop_column("appointments", "counter_proposal")
    op.drop_column("appointments", "source")
    # 'counter_pending' enum değeri DROP edilemez; olduğu gibi kalır.
