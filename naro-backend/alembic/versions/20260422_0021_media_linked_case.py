"""media_linked_case: media_assets.linked_case_id FK + partial unique index

Revision ID: 20260422_0021
Revises: 20260422_0020
Create Date: 2026-04-22 20:30:00.000000

Faz 12 (Case Create) — §9.3: asset bir case'e bağlandığında `linked_case_id`
set edilir. Partial index aynı asset'in birden fazla case'e bağlanmasını
engeller (reuse guard). FK SET NULL on case delete (asset kalır; ownership
audit için).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260422_0021"
down_revision: str | None = "20260422_0020"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "media_assets",
        sa.Column(
            "linked_case_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_cases.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_media_assets_linked_case",
        "media_assets",
        ["linked_case_id"],
        postgresql_where=sa.text("linked_case_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_media_assets_linked_case", table_name="media_assets")
    op.drop_column("media_assets", "linked_case_id")
