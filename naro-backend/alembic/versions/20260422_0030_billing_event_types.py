"""billing event types + service_cases.billing_state (Faz B-3)

Revision ID: 20260422_0030
Revises: 20260422_0029
Create Date: 2026-04-22 17:00:00.000000

12 yeni enum değeri (forward-only ADD VALUE):
- auth_event_type: 4 admin billing action
- case_event_type: 8 payment lifecycle event

service_cases'e `billing_state` kolonu — BillingState enum'un current
state'i (brief §11.2 decision: coupled on service_cases, ayrı tablo
yerine basit yaklaşım).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260422_0030"
down_revision: str | None = "20260422_0029"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


_AUTH_EVENT_VALUES = (
    "admin_billing_capture_override",
    "admin_billing_refund",
    "admin_billing_kasko_reimburse",
    "admin_billing_payout_completed",
)

_CASE_EVENT_VALUES = (
    "payment_initiated",
    "payment_authorized",
    "payment_captured",
    "payment_refunded",
    "commission_calculated",
    "payout_scheduled",
    "payout_completed",
    "billing_state_changed",
    "invoice_issued",
)


def upgrade() -> None:
    for value in _AUTH_EVENT_VALUES:
        op.execute(
            f"ALTER TYPE auth_event_type ADD VALUE IF NOT EXISTS '{value}'"
        )
    for value in _CASE_EVENT_VALUES:
        op.execute(
            f"ALTER TYPE case_event_type ADD VALUE IF NOT EXISTS '{value}'"
        )

    # service_cases.billing_state — nullable; sadece ödeme akışı olan
    # case'lerde dolu (initial ESTIMATE). Tow case'lerinde null kalır
    # (tow_fare_settlements kendi state'ini tutuyor).
    op.add_column(
        "service_cases",
        sa.Column("billing_state", sa.String(40), nullable=True),
    )
    op.create_index(
        "ix_service_cases_billing_state",
        "service_cases",
        ["billing_state"],
        unique=False,
        postgresql_where=sa.text("billing_state IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_service_cases_billing_state", table_name="service_cases"
    )
    op.drop_column("service_cases", "billing_state")
    # Enum value drop Postgres'te desteklenmez — forward-only.
