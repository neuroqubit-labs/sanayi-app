"""service approval payments and technician payment accounts

Revision ID: 20260425_0043
Revises: 20260425_0042
Create Date: 2026-04-25 23:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260425_0043"
down_revision: str | None = "20260425_0042"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


approval_payment_method = postgresql.ENUM(
    "online",
    "service_card",
    "cash",
    name="case_approval_payment_method",
    create_type=False,
)
approval_payment_state = postgresql.ENUM(
    "not_required",
    "required",
    "requested",
    "paid",
    "offline_recorded",
    "failed",
    name="case_approval_payment_state",
    create_type=False,
)
payment_account_status = postgresql.ENUM(
    "not_started",
    "draft",
    "submitted",
    "pending_review",
    "approved",
    "rejected",
    "disabled",
    name="technician_payment_account_status",
    create_type=False,
)
payment_legal_type = postgresql.ENUM(
    "individual_sole_prop",
    "company",
    name="technician_payment_legal_type",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    bind.execute(
        sa.text(
            """
            DO $$ BEGIN
                CREATE TYPE case_approval_payment_method AS ENUM ('online','service_card','cash');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
    )
    bind.execute(
        sa.text(
            """
            DO $$ BEGIN
                CREATE TYPE case_approval_payment_state AS ENUM (
                    'not_required','required','requested','paid','offline_recorded','failed'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
    )
    bind.execute(
        sa.text(
            """
            DO $$ BEGIN
                CREATE TYPE technician_payment_account_status AS ENUM (
                    'not_started','draft','submitted','pending_review','approved','rejected','disabled'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
    )
    bind.execute(
        sa.text(
            """
            DO $$ BEGIN
                CREATE TYPE technician_payment_legal_type AS ENUM ('individual_sole_prop','company');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
    )

    if inspector.has_table("payment_orders"):
        constraints = {
            constraint["name"]
            for constraint in inspector.get_check_constraints("payment_orders")
        }
        if "ck_payment_orders_subject_type" in constraints:
            op.drop_constraint(
                "ck_payment_orders_subject_type",
                "payment_orders",
                type_="check",
            )
        op.create_check_constraint(
            "ck_payment_orders_subject_type",
            "payment_orders",
            "subject_type IN ('tow_case','service_case','case_approval','campaign_purchase')",
        )

    if inspector.has_table("case_approvals"):
        existing_cols = {col["name"] for col in inspector.get_columns("case_approvals")}
        if "payment_method" not in existing_cols:
            op.add_column(
                "case_approvals",
                sa.Column(
                    "payment_method",
                    approval_payment_method,
                    nullable=True,
                ),
            )
        if "payment_state" not in existing_cols:
            op.add_column(
                "case_approvals",
                sa.Column(
                    "payment_state",
                    approval_payment_state,
                    nullable=False,
                    server_default="not_required",
                ),
            )
        if "payment_order_id" not in existing_cols:
            op.add_column(
                "case_approvals",
                sa.Column("payment_order_id", sa.UUID(), nullable=True),
            )
            op.create_foreign_key(
                "fk_case_approvals_payment_order_id",
                "case_approvals",
                "payment_orders",
                ["payment_order_id"],
                ["id"],
                ondelete="SET NULL",
            )
            op.create_index(
                "ix_case_approvals_payment_order_id",
                "case_approvals",
                ["payment_order_id"],
            )

    if not inspector.has_table("technician_payment_accounts"):
        op.create_table(
            "technician_payment_accounts",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("technician_user_id", sa.UUID(), nullable=False),
            sa.Column("provider", sa.String(length=32), server_default="mock", nullable=False),
            sa.Column(
                "status",
                payment_account_status,
                server_default="not_started",
                nullable=False,
            ),
            sa.Column("sub_merchant_key", sa.String(length=160), nullable=True),
            sa.Column("legal_type", payment_legal_type, nullable=True),
            sa.Column("legal_name", sa.String(length=255), nullable=True),
            sa.Column("tax_number_ref", sa.String(length=80), nullable=True),
            sa.Column("iban_ref", sa.String(length=80), nullable=True),
            sa.Column("authorized_person_name", sa.String(length=255), nullable=True),
            sa.Column("address_snapshot", postgresql.JSONB(), server_default="{}", nullable=False),
            sa.Column("business_snapshot", postgresql.JSONB(), server_default="{}", nullable=False),
            sa.Column("can_receive_online_payments", sa.Boolean(), server_default=sa.text("false"), nullable=False),
            sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("reviewer_note", sa.Text(), nullable=True),
            sa.CheckConstraint(
                "provider IN ('iyzico','mock')",
                name="ck_technician_payment_accounts_provider",
            ),
            sa.ForeignKeyConstraint(
                ["technician_user_id"], ["users.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "technician_user_id",
                name="uq_technician_payment_accounts_user",
            ),
        )
        op.create_index(
            "ix_technician_payment_accounts_status",
            "technician_payment_accounts",
            ["status"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("technician_payment_accounts"):
        op.drop_index(
            "ix_technician_payment_accounts_status",
            table_name="technician_payment_accounts",
        )
        op.drop_table("technician_payment_accounts")

    if inspector.has_table("case_approvals"):
        existing_cols = {col["name"] for col in inspector.get_columns("case_approvals")}
        if "payment_order_id" in existing_cols:
            indexes = {idx["name"] for idx in inspector.get_indexes("case_approvals")}
            if "ix_case_approvals_payment_order_id" in indexes:
                op.drop_index(
                    "ix_case_approvals_payment_order_id",
                    table_name="case_approvals",
                )
            foreign_keys = {
                constraint["name"]
                for constraint in inspector.get_foreign_keys("case_approvals")
            }
            if "fk_case_approvals_payment_order_id" in foreign_keys:
                op.drop_constraint(
                    "fk_case_approvals_payment_order_id",
                    "case_approvals",
                    type_="foreignkey",
                )
            op.drop_column("case_approvals", "payment_order_id")
        if "payment_state" in existing_cols:
            op.drop_column("case_approvals", "payment_state")
        if "payment_method" in existing_cols:
            op.drop_column("case_approvals", "payment_method")

    if inspector.has_table("payment_orders"):
        constraints = {
            constraint["name"]
            for constraint in inspector.get_check_constraints("payment_orders")
        }
        if "ck_payment_orders_subject_type" in constraints:
            op.drop_constraint(
                "ck_payment_orders_subject_type",
                "payment_orders",
                type_="check",
            )
        op.create_check_constraint(
            "ck_payment_orders_subject_type",
            "payment_orders",
            "subject_type IN ('tow_case','service_case','campaign_purchase')",
        )

    bind.execute(sa.text("DROP TYPE IF EXISTS technician_payment_legal_type"))
    bind.execute(sa.text("DROP TYPE IF EXISTS technician_payment_account_status"))
    bind.execute(sa.text("DROP TYPE IF EXISTS case_approval_payment_state"))
    bind.execute(sa.text("DROP TYPE IF EXISTS case_approval_payment_method"))
