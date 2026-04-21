"""offer + appointment: case_offers + appointments + 3 enums

Revision ID: 20260420_0006
Revises: 20260420_0005
Create Date: 2026-04-20 18:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260420_0006"
down_revision: str | None = "20260420_0005"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


case_offer_status = postgresql.ENUM(
    "pending",
    "shortlisted",
    "accepted",
    "rejected",
    "expired",
    "withdrawn",
    name="case_offer_status",
    create_type=False,
)
appointment_slot_kind = postgresql.ENUM(
    "today",
    "tomorrow",
    "custom",
    "flexible",
    name="appointment_slot_kind",
    create_type=False,
)
appointment_status = postgresql.ENUM(
    "pending",
    "approved",
    "declined",
    "expired",
    "cancelled",
    name="appointment_status",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    case_offer_status.create(bind, checkfirst=True)
    appointment_slot_kind.create(bind, checkfirst=True)
    appointment_status.create(bind, checkfirst=True)

    # ── case_offers ──
    if not inspector.has_table("case_offers"):
        op.create_table(
            "case_offers",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("case_id", sa.UUID(), nullable=False),
            sa.Column("technician_id", sa.UUID(), nullable=False),
            sa.Column("headline", sa.String(length=255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column(
                "currency",
                sa.String(length=8),
                nullable=False,
                server_default="TRY",
            ),
            sa.Column("eta_minutes", sa.Integer(), nullable=False),
            sa.Column("delivery_mode", sa.String(length=64), nullable=False),
            sa.Column("warranty_label", sa.String(length=128), nullable=False),
            sa.Column("available_at_label", sa.String(length=128), nullable=True),
            sa.Column(
                "badges",
                postgresql.ARRAY(sa.String()),
                nullable=False,
                server_default="{}",
            ),
            sa.Column(
                "status",
                case_offer_status,
                nullable=False,
                server_default="pending",
            ),
            sa.Column(
                "submitted_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
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
            sa.CheckConstraint("amount >= 0", name="ck_case_offers_amount_nonneg"),
            sa.CheckConstraint(
                "eta_minutes >= 0", name="ck_case_offers_eta_nonneg"
            ),
            sa.ForeignKeyConstraint(
                ["case_id"], ["service_cases.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(
                ["technician_id"], ["users.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "uq_active_offer_per_tech_case",
            "case_offers",
            ["case_id", "technician_id"],
            unique=True,
            postgresql_where=sa.text(
                "status IN ('pending','shortlisted','accepted')"
            ),
        )
        op.create_index(
            "ix_case_offers_case",
            "case_offers",
            ["case_id", "status", "amount"],
            unique=False,
        )
        op.create_index(
            "ix_case_offers_tech",
            "case_offers",
            ["technician_id", "status", sa.text("submitted_at DESC")],
            unique=False,
        )
        op.create_index(
            "ix_case_offers_expiring",
            "case_offers",
            ["expires_at"],
            unique=False,
            postgresql_where=sa.text(
                "status = 'pending' AND expires_at IS NOT NULL"
            ),
        )

    # ── appointments ──
    if not inspector.has_table("appointments"):
        op.create_table(
            "appointments",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("case_id", sa.UUID(), nullable=False),
            sa.Column("technician_id", sa.UUID(), nullable=False),
            sa.Column("offer_id", sa.UUID(), nullable=True),
            sa.Column("slot", postgresql.JSONB(), nullable=False),
            sa.Column("slot_kind", appointment_slot_kind, nullable=False),
            sa.Column(
                "note",
                sa.Text(),
                nullable=True,
                server_default="",
            ),
            sa.Column(
                "status",
                appointment_status,
                nullable=False,
                server_default="pending",
            ),
            sa.Column(
                "requested_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("decline_reason", sa.Text(), nullable=True),
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
            sa.ForeignKeyConstraint(
                ["case_id"], ["service_cases.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(
                ["technician_id"], ["users.id"], ondelete="RESTRICT"
            ),
            sa.ForeignKeyConstraint(
                ["offer_id"], ["case_offers.id"], ondelete="SET NULL"
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "uq_active_appointment_per_case",
            "appointments",
            ["case_id"],
            unique=True,
            postgresql_where=sa.text("status = 'pending'"),
        )
        op.create_index(
            "ix_appointments_technician",
            "appointments",
            ["technician_id", "status", sa.text("requested_at DESC")],
            unique=False,
        )
        op.create_index(
            "ix_appointments_case",
            "appointments",
            ["case_id", "status"],
            unique=False,
        )
        op.create_index(
            "ix_appointments_expiring",
            "appointments",
            ["expires_at"],
            unique=False,
            postgresql_where=sa.text("status = 'pending'"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("appointments"):
        op.drop_index("ix_appointments_expiring", table_name="appointments")
        op.drop_index("ix_appointments_case", table_name="appointments")
        op.drop_index("ix_appointments_technician", table_name="appointments")
        op.drop_index(
            "uq_active_appointment_per_case", table_name="appointments"
        )
        op.drop_table("appointments")

    if inspector.has_table("case_offers"):
        op.drop_index("ix_case_offers_expiring", table_name="case_offers")
        op.drop_index("ix_case_offers_tech", table_name="case_offers")
        op.drop_index("ix_case_offers_case", table_name="case_offers")
        op.drop_index(
            "uq_active_offer_per_tech_case", table_name="case_offers"
        )
        op.drop_table("case_offers")

    appointment_status.drop(bind, checkfirst=True)
    appointment_slot_kind.drop(bind, checkfirst=True)
    case_offer_status.drop(bind, checkfirst=True)
