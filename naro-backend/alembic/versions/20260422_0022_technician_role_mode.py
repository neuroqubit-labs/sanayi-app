"""technician_role_mode: provider_mode + active_provider_type + role_config_version + tow_operator + 6 AuthEvent

Revision ID: 20260422_0022
Revises: 20260422_0021
Create Date: 2026-04-22 21:00:00.000000

Faz 13 PR 4 — /technicians/me/* rol + mode + cert matrisi altyapısı.

**Forward-only migration**: `ALTER TYPE ... ADD VALUE` Postgres'te drop edilemez.
- `technician_certificate_kind` ADD VALUE 'tow_operator' — bir daha silinemez
- `auth_event_type` ADD VALUE ×6 — technician mutation audit için

Yeni enum:
- `provider_mode` ('business' | 'individual') — V1 scope; 'side_gig' V2'de

Yeni kolonlar (technician_profiles):
- `provider_mode` (NOT NULL DEFAULT 'business') — KYC cert matrisi bu üzerinden
- `active_provider_type` (NULL) — multi-role kişi "şu an hangi rolde"
- `role_config_version` (SMALLINT NOT NULL DEFAULT 1) — monotonic; mutation başına bump

Constraint:
- `ck_active_provider_in_roles`: active_provider_type NULL veya provider_type
  veya secondary_provider_types içinden

Partial index:
- `ix_tech_profiles_active_role` — (active_provider_type, provider_mode) WHERE deleted_at IS NULL
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260422_0022"
down_revision: str | None = "20260422_0021"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


_AUTH_EVENT_NEW_VALUES: tuple[str, ...] = (
    "technician_profile_updated",
    "technician_coverage_replaced",
    "technician_provider_mode_switched",
    "technician_active_role_switched",
    "technician_cert_submitted",
    "technician_admission_recomputed",
)


def upgrade() -> None:
    connection = op.get_bind()

    # ENUM ADD VALUE — AUTOCOMMIT gerekli
    connection.execute(sa.text("COMMIT"))
    connection.execute(
        sa.text(
            "ALTER TYPE technician_certificate_kind ADD VALUE IF NOT EXISTS 'tow_operator'"
        )
    )
    for value in _AUTH_EVENT_NEW_VALUES:
        connection.execute(
            sa.text(
                f"ALTER TYPE auth_event_type ADD VALUE IF NOT EXISTS '{value}'"
            )
        )

    # Yeni enum — provider_mode
    op.execute("CREATE TYPE provider_mode AS ENUM ('business', 'individual')")

    # Yeni kolonlar (technician_profiles)
    op.add_column(
        "technician_profiles",
        sa.Column(
            "provider_mode",
            postgresql.ENUM("business", "individual", name="provider_mode", create_type=False),
            nullable=False,
            server_default="business",
        ),
    )
    op.add_column(
        "technician_profiles",
        sa.Column(
            "active_provider_type",
            postgresql.ENUM(name="provider_type", create_type=False),
            nullable=True,
        ),
    )
    op.add_column(
        "technician_profiles",
        sa.Column(
            "role_config_version",
            sa.SmallInteger(),
            nullable=False,
            server_default="1",
        ),
    )

    # Constraint — active_provider_type ∈ {provider_type} ∪ secondary_provider_types
    op.execute(
        """
        ALTER TABLE technician_profiles
        ADD CONSTRAINT ck_active_provider_in_roles
        CHECK (
            active_provider_type IS NULL
            OR active_provider_type = provider_type
            OR active_provider_type = ANY(secondary_provider_types)
        )
        """
    )

    # Partial index
    op.create_index(
        "ix_tech_profiles_active_role",
        "technician_profiles",
        ["active_provider_type", "provider_mode"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    # tow_operator enum value + auth_event_type ADD VALUE'lar forward-only.
    # Kolonlar + constraint + index drop edilir; enum'lar DB'de kalır (zararsız).
    op.drop_index("ix_tech_profiles_active_role", table_name="technician_profiles")
    op.execute(
        "ALTER TABLE technician_profiles DROP CONSTRAINT IF EXISTS ck_active_provider_in_roles"
    )
    op.drop_column("technician_profiles", "role_config_version")
    op.drop_column("technician_profiles", "active_provider_type")
    op.drop_column("technician_profiles", "provider_mode")
    op.execute("DROP TYPE IF EXISTS provider_mode")
