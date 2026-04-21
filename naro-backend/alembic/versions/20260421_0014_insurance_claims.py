"""insurance_claims: sigorta hasar dosyası (Faz 8)

Revision ID: 20260421_0014
Revises: 20260421_0013
Create Date: 2026-04-21 16:00:00.000000

Ürün kararları:
- [K1] Taslak backend'de YOK (mobil local storage)
- [K2] Submit sonrası düzenleme YOK (taahhüt)
- [K3] Partial unique: aktif claim (submitted/accepted/paid) case başına 1
- [K4] Status 4 değer (drafted silindi): submitted | accepted | paid | rejected

Not: case_event_type enum'a 4 yeni değer ADD VALUE (tek yönlü;
downgrade enum değerlerini silemez — PG kısıtı).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260421_0014"
down_revision: str | None = "20260421_0013"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


insurance_coverage_kind = postgresql.ENUM(
    "kasko", "trafik", name="insurance_coverage_kind", create_type=False
)
insurance_claim_status = postgresql.ENUM(
    "submitted", "accepted", "paid", "rejected",
    name="insurance_claim_status", create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    insurance_coverage_kind.create(bind, checkfirst=True)
    insurance_claim_status.create(bind, checkfirst=True)

    # case_event_type ADD VALUE — Faz 8 eventleri
    op.execute(
        "ALTER TYPE case_event_type ADD VALUE IF NOT EXISTS 'insurance_claim_submitted'"
    )
    op.execute(
        "ALTER TYPE case_event_type ADD VALUE IF NOT EXISTS 'insurance_claim_accepted'"
    )
    op.execute(
        "ALTER TYPE case_event_type ADD VALUE IF NOT EXISTS 'insurance_claim_paid'"
    )
    op.execute(
        "ALTER TYPE case_event_type ADD VALUE IF NOT EXISTS 'insurance_claim_rejected'"
    )

    if not inspector.has_table("insurance_claims"):
        op.create_table(
            "insurance_claims",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("case_id", sa.UUID(), nullable=False),
            sa.Column("policy_number", sa.String(length=64), nullable=False),
            sa.Column("insurer", sa.String(length=255), nullable=False),
            sa.Column("coverage_kind", insurance_coverage_kind, nullable=False),
            sa.Column("insurer_claim_reference", sa.String(length=128), nullable=True),
            sa.Column(
                "status",
                insurance_claim_status,
                nullable=False,
                server_default="submitted",
            ),
            sa.Column("estimate_amount", sa.Numeric(12, 2), nullable=True),
            sa.Column("accepted_amount", sa.Numeric(12, 2), nullable=True),
            sa.Column("paid_amount", sa.Numeric(12, 2), nullable=True),
            sa.Column("currency", sa.String(length=8), nullable=False, server_default="TRY"),
            sa.Column("policy_holder_name", sa.String(length=255), nullable=True),
            sa.Column("policy_holder_phone", sa.String(length=32), nullable=True),
            sa.Column(
                "submitted_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("rejection_reason", sa.Text(), nullable=True),
            sa.Column("created_by_user_id", sa.UUID(), nullable=True),
            sa.Column("created_by_snapshot_name", sa.String(length=255), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.CheckConstraint(
                "estimate_amount IS NULL OR estimate_amount >= 0",
                name="ck_insurance_claims_estimate_nonneg",
            ),
            sa.CheckConstraint(
                "accepted_amount IS NULL OR accepted_amount >= 0",
                name="ck_insurance_claims_accepted_nonneg",
            ),
            sa.CheckConstraint(
                "paid_amount IS NULL OR paid_amount >= 0",
                name="ck_insurance_claims_paid_nonneg",
            ),
            sa.ForeignKeyConstraint(
                ["case_id"], ["service_cases.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(
                ["created_by_user_id"], ["users.id"], ondelete="SET NULL"
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        # [K3] partial unique — aktif claim case başına 1
        op.create_index(
            "uq_active_insurance_claim_per_case",
            "insurance_claims",
            ["case_id"],
            unique=True,
            postgresql_where=sa.text(
                "status IN ('submitted','accepted','paid')"
            ),
        )
        op.create_index(
            "ix_insurance_claims_case",
            "insurance_claims",
            ["case_id"],
            unique=False,
        )
        op.create_index(
            "ix_insurance_claims_status",
            "insurance_claims",
            ["status", sa.text("updated_at DESC")],
            unique=False,
        )
        op.create_index(
            "ix_insurance_claims_insurer",
            "insurance_claims",
            ["insurer", "status"],
            unique=False,
        )
        op.create_index(
            "ix_insurance_claims_pending_accept",
            "insurance_claims",
            ["submitted_at"],
            unique=False,
            postgresql_where=sa.text("status = 'submitted'"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("insurance_claims"):
        op.drop_index("ix_insurance_claims_pending_accept", table_name="insurance_claims")
        op.drop_index("ix_insurance_claims_insurer", table_name="insurance_claims")
        op.drop_index("ix_insurance_claims_status", table_name="insurance_claims")
        op.drop_index("ix_insurance_claims_case", table_name="insurance_claims")
        op.drop_index(
            "uq_active_insurance_claim_per_case",
            table_name="insurance_claims",
        )
        op.drop_table("insurance_claims")

    insurance_claim_status.drop(bind, checkfirst=True)
    insurance_coverage_kind.drop(bind, checkfirst=True)
    # case_event_type ADD VALUE geri alınamaz (PG kısıtı) — enum değerleri kalır.
