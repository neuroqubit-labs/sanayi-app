"""tow_case.parent_case_id — accident/breakdown → tow linkage (Faz 2)

Revision ID: 20260423_0033
Revises: 20260423_0032
Create Date: 2026-04-23 16:00:00.000000

Domain subtype refactor Faz 2 — accident/breakdown case'leri opsiyonel
olarak sonradan oluşan tow talebine bağlar (müşteri kaza/arıza sonrası
çekici çağırdığında).

Brief: docs/audits/2026-04-23-canonical-case-architecture.md Faz 2

Kolonla şema kararı (PO approval, 2026-04-23):
- column-based FK (tow_case.parent_case_id) — YAGNI için generic
  case_linkage tablosundan kaçınıldı. Pilot V1 tek yönlü bağlantı
  yeterli (tow kind'ın parent'ı var; başka kind'ların parent'ı yok).
- Cardinality: bir parent 0..n tow çocuğu olabilir (yeniden çekici
  çağrısı). Ters yön query: SELECT case_id FROM tow_case WHERE
  parent_case_id = :parent.

FK behaviour: ondelete SET NULL — parent soft delete edilirse
tow_case kayıtta kalır ama bağlantı null'a düşer.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260423_0033"
down_revision: str | None = "20260423_0032"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "tow_case",
        sa.Column(
            "parent_case_id",
            sa.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_tow_case_parent_case_id",
        "tow_case",
        "service_cases",
        ["parent_case_id"],
        ["id"],
        ondelete="SET NULL",
    )
    # Reverse lookup index (parent → tow_case list)
    op.execute(
        """
        CREATE INDEX ix_tow_case_parent_case_id
        ON tow_case (parent_case_id)
        WHERE parent_case_id IS NOT NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_tow_case_parent_case_id")
    op.drop_constraint(
        "fk_tow_case_parent_case_id", "tow_case", type_="foreignkey"
    )
    op.drop_column("tow_case", "parent_case_id")
