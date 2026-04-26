"""add tow no_candidate_found stage

Revision ID: 20260426_0046
Revises: 20260426_0045
Create Date: 2026-04-26 23:45:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260426_0046"
down_revision: str | None = "20260426_0045"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TYPE tow_dispatch_stage "
        "ADD VALUE IF NOT EXISTS 'no_candidate_found'"
    )


def downgrade() -> None:
    # PostgreSQL enum values cannot be safely removed without rebuilding the type.
    pass
