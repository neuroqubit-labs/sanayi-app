"""case match score upper bound

Revision ID: 20260426_0045
Revises: 20260426_0044
Create Date: 2026-04-26 23:10:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260426_0045"
down_revision: str | None = "20260426_0044"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_case_technician_matches_score_max",
        "case_technician_matches",
        "score <= 100",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_case_technician_matches_score_max",
        "case_technician_matches",
        type_="check",
    )
