"""auth_event_type: 11 yeni admin action değeri (Faz A PR 9)

Revision ID: 20260422_0027
Revises: 20260422_0026
Create Date: 2026-04-22 14:30:00.000000

Admin aksiyon audit trail için AuthEvent enum extend. Forward-only:
Postgres enum value drop desteklenmediği için downgrade no-op.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260422_0027"
down_revision: str | None = "20260422_0026"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


_ADMIN_ACTION_VALUES = (
    "admin_technician_approved",
    "admin_technician_rejected",
    "admin_technician_suspended",
    "admin_cert_approved",
    "admin_cert_rejected",
    "admin_insurance_claim_accepted",
    "admin_insurance_claim_rejected",
    "admin_insurance_claim_paid",
    "admin_case_override",
    "admin_user_suspended",
    "admin_user_unsuspended",
)


def upgrade() -> None:
    for value in _ADMIN_ACTION_VALUES:
        op.execute(
            f"ALTER TYPE auth_event_type ADD VALUE IF NOT EXISTS '{value}'"
        )


def downgrade() -> None:
    # Enum value drop Postgres'te desteklenmez — forward-only.
    pass
