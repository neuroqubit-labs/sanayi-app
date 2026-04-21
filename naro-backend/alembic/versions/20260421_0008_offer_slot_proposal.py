"""case_offers: slot_proposal JSONB + slot_is_firm (B akışı — firm slot)

Revision ID: 20260421_0008
Revises: 20260421_0007
Create Date: 2026-04-21 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260421_0008"
down_revision: str | None = "20260421_0007"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "case_offers",
        sa.Column("slot_proposal", postgresql.JSONB(), nullable=True),
    )
    op.add_column(
        "case_offers",
        sa.Column(
            "slot_is_firm",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.create_check_constraint(
        "ck_case_offers_firm_slot_required",
        "case_offers",
        "NOT slot_is_firm OR slot_proposal IS NOT NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_case_offers_firm_slot_required", "case_offers", type_="check"
    )
    op.drop_column("case_offers", "slot_is_firm")
    op.drop_column("case_offers", "slot_proposal")
