"""billing 4 tablo (Faz B-1): commission settlements + refunds + kasko + payment idempotency

Revision ID: 20260422_0029
Revises: 20260422_0028
Create Date: 2026-04-22 16:00:00.000000

Brief §4.3 + §5.4 + §6.3 + §7.3 literal SQL — non-tow kind'lar için
(bakım/arıza/hasar) escrow + commission + kasko + refund ledger altyapısı.

Tow'dan (Faz 10) farklı: generic case-level ledger. Tow ayrı tablolarını
(tow_fare_settlements vb.) kendi scope'unda tutar; bu billing tabloları
bakım/arıza/hasar için devreye girer. Migration'da schema-only;
commission/refund/kasko enum'ları StrEnum olarak uygulamada, DB'de
VARCHAR + CHECK constraint ile tutulur (brief spec aynısı).
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260422_0029"
down_revision: str | None = "20260422_0028"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # ─── case_commission_settlements ──────────────────────────────────────
    op.create_table(
        "case_commission_settlements",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "case_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_cases.id", ondelete="RESTRICT"),
            nullable=False,
            unique=True,
        ),
        sa.Column("gross_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("commission_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("commission_rate", sa.Numeric(5, 4), nullable=False),
        sa.Column(
            "net_to_technician_amount", sa.Numeric(12, 2), nullable=False
        ),
        sa.Column(
            "platform_currency",
            sa.CHAR(3),
            nullable=False,
            server_default="TRY",
        ),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "payout_scheduled_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column(
            "payout_completed_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column("payout_reference", sa.String(120), nullable=True),
        sa.Column("invoice_url", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "gross_amount >= 0 AND commission_amount >= 0 "
            "AND net_to_technician_amount >= 0",
            name="ck_commission_nonneg",
        ),
        sa.CheckConstraint(
            "commission_rate >= 0 AND commission_rate <= 1",
            name="ck_commission_rate_range",
        ),
        sa.CheckConstraint(
            "ROUND(gross_amount - commission_amount - net_to_technician_amount, 2) = 0",
            name="ck_commission_balance",
        ),
        sa.CheckConstraint(
            "payout_scheduled_at IS NULL OR payout_completed_at IS NULL "
            "OR payout_completed_at >= payout_scheduled_at",
            name="ck_payout_order",
        ),
        sa.UniqueConstraint(
            "payout_reference", name="uq_commission_payout_reference"
        ),
    )
    op.create_index(
        "ix_commission_settlements_pending_payout",
        "case_commission_settlements",
        ["payout_scheduled_at"],
        unique=False,
        postgresql_where=sa.text("payout_scheduled_at IS NULL"),
    )

    # ─── case_refunds ─────────────────────────────────────────────────────
    op.create_table(
        "case_refunds",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "case_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_cases.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("reason", sa.String(60), nullable=False),
        sa.Column("psp_ref", sa.String(120), nullable=True),
        sa.Column(
            "idempotency_key",
            sa.String(120),
            nullable=False,
            unique=True,
        ),
        sa.Column("state", sa.String(32), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "completed_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column(
            "initiated_by_user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.CheckConstraint("amount > 0", name="ck_refund_amount_pos"),
        sa.CheckConstraint(
            "reason IN ('cancellation','dispute','excess_preauth',"
            "'kasko_reimbursement','admin_override')",
            name="ck_refund_reason",
        ),
        sa.CheckConstraint(
            "state IN ('pending','success','failed')",
            name="ck_refund_state",
        ),
    )
    op.create_index(
        "ix_case_refunds_case",
        "case_refunds",
        ["case_id", "created_at"],
        unique=False,
    )

    # ─── case_kasko_settlements ───────────────────────────────────────────
    op.create_table(
        "case_kasko_settlements",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "case_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_cases.id", ondelete="RESTRICT"),
            nullable=False,
            unique=True,
        ),
        sa.Column("insurer_name", sa.String(120), nullable=False),
        sa.Column("policy_number", sa.String(80), nullable=True),
        sa.Column("claim_reference", sa.String(120), nullable=True),
        sa.Column(
            "reimbursement_amount", sa.Numeric(12, 2), nullable=True
        ),
        sa.Column("state", sa.String(32), nullable=False),
        sa.Column(
            "submitted_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column(
            "reimbursed_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.Column(
            "refund_to_customer_psp_ref", sa.String(120), nullable=True
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "state IN ('pending','submitted','approved','rejected',"
            "'reimbursed','partially_reimbursed')",
            name="ck_kasko_state",
        ),
        sa.CheckConstraint(
            "reimbursement_amount IS NULL OR reimbursement_amount >= 0",
            name="ck_kasko_reimbursement_nonneg",
        ),
    )
    op.create_index(
        "ix_kasko_pending_state",
        "case_kasko_settlements",
        ["state", "submitted_at"],
        unique=False,
        postgresql_where=sa.text(
            "state IN ('pending','submitted','approved')"
        ),
    )

    # ─── payment_idempotency (generic) ────────────────────────────────────
    op.create_table(
        "payment_idempotency",
        sa.Column(
            "idempotency_key",
            sa.String(120),
            primary_key=True,
        ),
        sa.Column("operation", sa.String(32), nullable=False),
        sa.Column(
            "case_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("service_cases.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("psp_provider", sa.String(32), nullable=False),
        sa.Column("psp_ref", sa.String(120), nullable=True),
        sa.Column(
            "request_payload",
            sa.dialects.postgresql.JSONB(),
            nullable=True,
        ),
        sa.Column(
            "response_payload",
            sa.dialects.postgresql.JSONB(),
            nullable=True,
        ),
        sa.Column("state", sa.String(32), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "completed_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.CheckConstraint(
            "operation IN ('authorize','capture','refund','void')",
            name="ck_payment_idempotency_operation",
        ),
        sa.CheckConstraint(
            "state IN ('pending','success','failed')",
            name="ck_payment_idempotency_state",
        ),
        sa.CheckConstraint(
            "psp_provider IN ('iyzico','mock')",
            name="ck_payment_idempotency_provider",
        ),
    )
    op.create_index(
        "ix_payment_idempotency_case",
        "payment_idempotency",
        ["case_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_payment_idempotency_case", table_name="payment_idempotency"
    )
    op.drop_table("payment_idempotency")

    op.drop_index(
        "ix_kasko_pending_state", table_name="case_kasko_settlements"
    )
    op.drop_table("case_kasko_settlements")

    op.drop_index("ix_case_refunds_case", table_name="case_refunds")
    op.drop_table("case_refunds")

    op.drop_index(
        "ix_commission_settlements_pending_payout",
        table_name="case_commission_settlements",
    )
    op.drop_table("case_commission_settlements")
