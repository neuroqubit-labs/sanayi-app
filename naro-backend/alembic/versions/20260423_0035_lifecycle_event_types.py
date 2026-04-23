"""lifecycle audit event types + approval uniqueness (B-P0-4 + B-P2-2)

Revision ID: 20260423_0035
Revises: 20260423_0034
Create Date: 2026-04-23 18:00:00.000000

Plan: be-pilot-finale-lifecycle-fixes.

B-P0-4: Case cancel cascade için 3 yeni event type:
- offer_auto_rejected
- appointment_auto_cancelled
- approval_auto_rejected
B-P1-6: offer_expired (cron ARQ)
B-P1-7: auto_archived (stale 48h)
B-P1-10: Eksik emit eventleri için yeni tip: parts_requested (service'te
  emit edilecek)
B-P2-2: case_approvals partial UNIQUE (case_id, kind) WHERE status='pending'.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260423_0035"
down_revision: str | None = "20260423_0034"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

_NEW_EVENT_TYPES = (
    "offer_auto_rejected",
    "appointment_auto_cancelled",
    "approval_auto_rejected",
    "offer_expired",
    "auto_archived",
)


def upgrade() -> None:
    # ALTER TYPE case_event_type ADD VALUE IF NOT EXISTS (idempotent).
    for value in _NEW_EVENT_TYPES:
        op.execute(
            sa.text(
                f"ALTER TYPE case_event_type ADD VALUE IF NOT EXISTS '{value}'"
            )
        )

    # B-P2-2: partial unique — 1 pending approval per (case, kind)
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS
            uq_active_approval_per_case_kind
        ON case_approvals (case_id, kind)
        WHERE status = 'pending'
        """
    )


def downgrade() -> None:
    # PostgreSQL enum value DROP desteklemiyor — V1.1 geri alma için
    # type re-create + table alter gerekir. Pilot scope dışı.
    op.execute("DROP INDEX IF EXISTS uq_active_approval_per_case_kind")
