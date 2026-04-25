"""payment core + tow payment required stage

Revision ID: 20260425_0040
Revises: 20260424_0039
Create Date: 2026-04-25 18:00:00.000000

Reusable payment order/attempt ledger. Tow immediate dispatch now waits for a
hosted PSP preauth callback before candidate search starts.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260425_0040"
down_revision: str | None = "20260424_0039"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Postgres enum ADD VALUE is forward-only. Keep this idempotent because
    # local pilot DBs can be at slightly different heads while we iterate.
    bind.execute(sa.text("COMMIT"))
    bind.execute(
        sa.text(
            "ALTER TYPE tow_dispatch_stage "
            "ADD VALUE IF NOT EXISTS 'payment_required'"
        )
    )

    if not inspector.has_table("payment_orders"):
        op.create_table(
            "payment_orders",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("subject_type", sa.String(length=40), nullable=False),
            sa.Column("subject_id", sa.UUID(), nullable=False),
            sa.Column("case_id", sa.UUID(), nullable=True),
            sa.Column("customer_user_id", sa.UUID(), nullable=False),
            sa.Column("payment_mode", sa.String(length=40), nullable=False),
            sa.Column("state", sa.String(length=40), nullable=False),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("currency", sa.CHAR(length=3), server_default="TRY", nullable=False),
            sa.Column("provider", sa.String(length=32), nullable=False),
            sa.Column(
                "quote_snapshot",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=False,
            ),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("latest_attempt_id", sa.UUID(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.CheckConstraint(
                "subject_type IN ('tow_case','service_case','campaign_purchase')",
                name="ck_payment_orders_subject_type",
            ),
            sa.CheckConstraint(
                "payment_mode IN ('preauth_capture','direct_capture')",
                name="ck_payment_orders_mode",
            ),
            sa.CheckConstraint(
                "state IN ('payment_required','preauth_requested','preauth_held',"
                "'preauth_failed','capture_requested','captured','voided',"
                "'refunded','cancelled')",
                name="ck_payment_orders_state",
            ),
            sa.CheckConstraint("amount >= 0", name="ck_payment_orders_amount_nonneg"),
            sa.ForeignKeyConstraint(["case_id"], ["service_cases.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["customer_user_id"], ["users.id"], ondelete="RESTRICT"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "subject_type",
                "subject_id",
                "payment_mode",
                name="uq_payment_orders_subject_mode",
            ),
        )
        op.create_index(
            "ix_payment_orders_subject",
            "payment_orders",
            ["subject_type", "subject_id"],
            unique=False,
        )
        op.create_index(
            "ix_payment_orders_customer",
            "payment_orders",
            ["customer_user_id", "created_at"],
            unique=False,
        )

    if not inspector.has_table("payment_attempts"):
        op.create_table(
            "payment_attempts",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("order_id", sa.UUID(), nullable=False),
            sa.Column("provider", sa.String(length=32), nullable=False),
            sa.Column("provider_conversation_id", sa.String(length=120), nullable=False),
            sa.Column("provider_payment_id", sa.String(length=160), nullable=True),
            sa.Column("provider_token", sa.String(length=240), nullable=True),
            sa.Column("checkout_url", sa.Text(), nullable=True),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("currency", sa.CHAR(length=3), server_default="TRY", nullable=False),
            sa.Column("state", sa.String(length=40), nullable=False),
            sa.Column("raw_request", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("raw_response", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("failure_code", sa.String(length=120), nullable=True),
            sa.Column("failure_message", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.CheckConstraint(
                "state IN ('payment_required','preauth_requested','preauth_held',"
                "'preauth_failed','capture_requested','captured','voided',"
                "'refunded','cancelled')",
                name="ck_payment_attempts_state",
            ),
            sa.CheckConstraint("amount >= 0", name="ck_payment_attempts_amount_nonneg"),
            sa.ForeignKeyConstraint(["order_id"], ["payment_orders.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "provider_conversation_id",
                name="uq_payment_attempts_provider_conversation",
            ),
        )
        op.create_index(
            "ix_payment_attempts_order",
            "payment_attempts",
            ["order_id", "created_at"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("payment_attempts"):
        op.drop_index("ix_payment_attempts_order", table_name="payment_attempts")
        op.drop_table("payment_attempts")
    if inspector.has_table("payment_orders"):
        op.drop_index("ix_payment_orders_customer", table_name="payment_orders")
        op.drop_index("ix_payment_orders_subject", table_name="payment_orders")
        op.drop_table("payment_orders")
    # tow_dispatch_stage enum value is forward-only in Postgres.
