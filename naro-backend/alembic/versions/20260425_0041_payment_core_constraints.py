"""payment core hardening constraints

Revision ID: 20260425_0041
Revises: 20260425_0040
Create Date: 2026-04-25 22:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260425_0041"
down_revision: str | None = "20260425_0040"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("payment_orders") or not inspector.has_table("payment_attempts"):
        return

    constraints = {
        constraint["name"]
        for constraint in inspector.get_check_constraints("payment_orders")
    }
    if "ck_payment_orders_provider" not in constraints:
        op.create_check_constraint(
            "ck_payment_orders_provider",
            "payment_orders",
            "provider IN ('iyzico','mock')",
        )

    attempt_constraints = {
        constraint["name"]
        for constraint in inspector.get_check_constraints("payment_attempts")
    }
    if "ck_payment_attempts_provider" not in attempt_constraints:
        op.create_check_constraint(
            "ck_payment_attempts_provider",
            "payment_attempts",
            "provider IN ('iyzico','mock')",
        )

    bind.execute(
        sa.text(
            """
            UPDATE payment_orders
            SET latest_attempt_id = NULL
            WHERE latest_attempt_id IS NOT NULL
              AND NOT EXISTS (
                SELECT 1
                FROM payment_attempts
                WHERE payment_attempts.id = payment_orders.latest_attempt_id
              )
            """
        )
    )

    foreign_keys = {
        constraint["name"]
        for constraint in inspector.get_foreign_keys("payment_orders")
    }
    if "fk_payment_orders_latest_attempt_id" not in foreign_keys:
        op.create_foreign_key(
            "fk_payment_orders_latest_attempt_id",
            "payment_orders",
            "payment_attempts",
            ["latest_attempt_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("payment_orders"):
        foreign_keys = {
            constraint["name"]
            for constraint in inspector.get_foreign_keys("payment_orders")
        }
        if "fk_payment_orders_latest_attempt_id" in foreign_keys:
            op.drop_constraint(
                "fk_payment_orders_latest_attempt_id",
                "payment_orders",
                type_="foreignkey",
            )
        constraints = {
            constraint["name"]
            for constraint in inspector.get_check_constraints("payment_orders")
        }
        if "ck_payment_orders_provider" in constraints:
            op.drop_constraint(
                "ck_payment_orders_provider",
                "payment_orders",
                type_="check",
            )
    if inspector.has_table("payment_attempts"):
        constraints = {
            constraint["name"]
            for constraint in inspector.get_check_constraints("payment_attempts")
        }
        if "ck_payment_attempts_provider" in constraints:
            op.drop_constraint(
                "ck_payment_attempts_provider",
                "payment_attempts",
                type_="check",
            )
