"""technician_profiles.is_mock + partial index (Faz B Seed Kick)

Revision ID: 20260422_0028
Revises: 20260422_0027
Create Date: 2026-04-22 15:00:00.000000

Pilot (Kayseri 10+10) için mock technician profile flag. /public/feed
filtresi ETMEZ — kullanıcı karışık görür, şeffaf mock. Admin moderation
partial index üzerinden hızlı.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260422_0028"
down_revision: str | None = "20260422_0027"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "technician_profiles",
        sa.Column(
            "is_mock",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.create_index(
        "ix_technician_profiles_is_mock",
        "technician_profiles",
        ["is_mock"],
        unique=False,
        postgresql_where=sa.text("is_mock = true"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_technician_profiles_is_mock", table_name="technician_profiles"
    )
    op.drop_column("technician_profiles", "is_mock")
