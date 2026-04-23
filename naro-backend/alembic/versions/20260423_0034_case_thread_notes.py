"""case_messages.deleted_at + service_cases.customer_notes (İş 3)

Revision ID: 20260423_0034
Revises: 20260423_0033
Create Date: 2026-04-23 17:00:00.000000

PO brief 2026-04-23 "3 yeni endpoint" — thread + notes.

Seçenek A (PO karar): mevcut case_threads/case_messages tablolarını
kullan, yeni tablo AÇMA. Brief'teki `case_thread_messages` + naming
API response layer'da alias ile sağlanır (BE internal DB field ismi
değişmez).

Bu migration:
- case_messages: soft delete için `deleted_at` ekle
- service_cases: `customer_notes` TEXT (owner-private, max 2000 char)

last_seen alanları zaten var: service_cases.last_seen_by_customer /
last_seen_by_technician (brief'teki customer_last_seen_at aynı semantic,
rename gerekmez).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260423_0034"
down_revision: str | None = "20260423_0033"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "case_messages",
        sa.Column(
            "deleted_at", sa.DateTime(timezone=True), nullable=True
        ),
    )
    op.add_column(
        "service_cases",
        sa.Column("customer_notes", sa.Text(), nullable=True),
    )
    op.create_check_constraint(
        "ck_service_cases_customer_notes_length",
        "service_cases",
        "customer_notes IS NULL OR length(customer_notes) <= 2000",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_service_cases_customer_notes_length",
        "service_cases",
        type_="check",
    )
    op.drop_column("service_cases", "customer_notes")
    op.drop_column("case_messages", "deleted_at")
