"""vehicles: muayene + sigorta (kasko/trafik) + egzoz expiry alanları

Revision ID: 20260422_0016
Revises: 20260422_0015
Create Date: 2026-04-22 10:00:00.000000

Genel araç sahibi için lifecycle bildirim altyapısı — muayene + kasko +
trafik + egzoz expiry. Cron (Faz 10) bu alanları tarayıp
`case_notification_intents` (veya yeni `vehicle_reminders` tablosu) ile
30/7/1 gün hatırlatıcı intent üretecek.

Hepsi nullable (kullanıcı opt-in; eski kayıtlar etkilenmez).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260422_0016"
down_revision: str | None = "20260422_0015"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "vehicles",
        sa.Column("inspection_valid_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "vehicles",
        sa.Column("inspection_kind", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "vehicles",
        sa.Column("kasko_valid_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "vehicles",
        sa.Column("kasko_insurer", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "vehicles",
        sa.Column("trafik_valid_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "vehicles",
        sa.Column("trafik_insurer", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "vehicles",
        sa.Column("exhaust_valid_until", sa.DateTime(timezone=True), nullable=True),
    )

    # Yaklaşan expiry tarama index'leri (cron için)
    op.create_index(
        "ix_vehicles_inspection_expiring",
        "vehicles",
        ["inspection_valid_until"],
        unique=False,
        postgresql_where=sa.text(
            "inspection_valid_until IS NOT NULL AND deleted_at IS NULL"
        ),
    )
    op.create_index(
        "ix_vehicles_kasko_expiring",
        "vehicles",
        ["kasko_valid_until"],
        unique=False,
        postgresql_where=sa.text(
            "kasko_valid_until IS NOT NULL AND deleted_at IS NULL"
        ),
    )
    op.create_index(
        "ix_vehicles_trafik_expiring",
        "vehicles",
        ["trafik_valid_until"],
        unique=False,
        postgresql_where=sa.text(
            "trafik_valid_until IS NOT NULL AND deleted_at IS NULL"
        ),
    )


def downgrade() -> None:
    op.drop_index("ix_vehicles_trafik_expiring", table_name="vehicles")
    op.drop_index("ix_vehicles_kasko_expiring", table_name="vehicles")
    op.drop_index("ix_vehicles_inspection_expiring", table_name="vehicles")
    op.drop_column("vehicles", "exhaust_valid_until")
    op.drop_column("vehicles", "trafik_insurer")
    op.drop_column("vehicles", "trafik_valid_until")
    op.drop_column("vehicles", "kasko_insurer")
    op.drop_column("vehicles", "kasko_valid_until")
    op.drop_column("vehicles", "inspection_kind")
    op.drop_column("vehicles", "inspection_valid_until")
