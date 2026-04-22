"""vehicles: history_consent_granted + granted_at + revoked_at (audit P1-1)

Revision ID: 20260422_0025
Revises: 20260422_0024
Create Date: 2026-04-22 12:30:00.000000

Audit item P1-1 — "Araç geçmişi izin akışı": müşteri araç ekleme flow'unda
geçmiş verisi (servis geçmişi, hasar raporları) paylaşım iznini açık/kapalı
işaretler. Dossier endpoint consent yoksa anonymized (count-only) dönüş.

Ek olarak auth_event_type enum'una 2 yeni değer — grant/revoke audit için.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260422_0025"
down_revision: str | None = "20260422_0024"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "vehicles",
        sa.Column(
            "history_consent_granted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "vehicles",
        sa.Column(
            "history_consent_granted_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "vehicles",
        sa.Column(
            "history_consent_revoked_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # auth_event_type enum — vehicle consent event'leri (idempotent ADD VALUE)
    op.execute(
        "ALTER TYPE auth_event_type ADD VALUE IF NOT EXISTS "
        "'vehicle_consent_granted'"
    )
    op.execute(
        "ALTER TYPE auth_event_type ADD VALUE IF NOT EXISTS "
        "'vehicle_consent_revoked'"
    )


def downgrade() -> None:
    # Enum value drop Postgres'te desteklenmez — forward-only.
    op.drop_column("vehicles", "history_consent_revoked_at")
    op.drop_column("vehicles", "history_consent_granted_at")
    op.drop_column("vehicles", "history_consent_granted")
