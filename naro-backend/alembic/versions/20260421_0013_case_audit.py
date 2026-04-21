"""case_audit: events + notification_intents (append-only + bildirim queue)

Revision ID: 20260421_0013
Revises: 20260421_0012
Create Date: 2026-04-21 15:00:00.000000

Faz 7d — audit trail + bildirim intent. case_events append-only (UPDATE yok);
retention cron Faz 15.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260421_0013"
down_revision: str | None = "20260421_0012"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


case_event_type = postgresql.ENUM(
    "submitted", "offer_received", "offer_accepted", "offer_rejected", "offer_withdrawn",
    "appointment_requested", "appointment_approved", "appointment_declined",
    "appointment_cancelled", "appointment_expired", "appointment_counter",
    "technician_selected", "technician_unassigned",
    "status_update", "parts_requested", "parts_approved", "parts_rejected",
    "invoice_shared", "invoice_approved",
    "evidence_added", "document_added", "message", "wait_state_changed",
    "completed", "cancelled", "archived", "soft_deleted",
    name="case_event_type", create_type=False,
)
case_notification_intent_type = postgresql.ENUM(
    "customer_approval_needed", "quote_ready", "appointment_confirmation",
    "evidence_missing", "status_update_required", "delivery_ready", "payment_review",
    name="case_notification_intent_type", create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    case_event_type.create(bind, checkfirst=True)
    case_notification_intent_type.create(bind, checkfirst=True)

    # ── case_events ──
    if not inspector.has_table("case_events"):
        op.create_table(
            "case_events",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("case_id", sa.UUID(), nullable=False),
            sa.Column("type", case_event_type, nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("body", sa.Text(), nullable=True),
            sa.Column("tone", sa.String(length=16), nullable=False, server_default="neutral"),
            sa.Column("actor_user_id", sa.UUID(), nullable=True),
            sa.Column("context", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.CheckConstraint(
                "tone IN ('accent','neutral','success','warning','critical','info')",
                name="ck_case_events_tone",
            ),
            sa.ForeignKeyConstraint(["case_id"], ["service_cases.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_case_events_case_created",
            "case_events",
            ["case_id", sa.text("created_at DESC")],
            unique=False,
        )
        op.create_index(
            "ix_case_events_type",
            "case_events",
            ["case_id", "type"],
            unique=False,
        )

    # ── case_notification_intents ──
    if not inspector.has_table("case_notification_intents"):
        op.create_table(
            "case_notification_intents",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("case_id", sa.UUID(), nullable=False),
            sa.Column("task_id", sa.UUID(), nullable=True),
            sa.Column("type", case_notification_intent_type, nullable=False),
            sa.Column("actor", sa.String(length=32), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("body", sa.Text(), nullable=True),
            sa.Column("route_hint", sa.String(length=512), nullable=True),
            sa.Column("is_new", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.CheckConstraint(
                "actor IN ('customer','technician','system')",
                name="ck_case_notification_intents_actor",
            ),
            sa.ForeignKeyConstraint(["case_id"], ["service_cases.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["task_id"], ["case_tasks.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_case_notifications_case_new",
            "case_notification_intents",
            ["case_id"],
            unique=False,
            postgresql_where=sa.text("is_new IS TRUE"),
        )
        op.create_index(
            "ix_case_notifications_actor",
            "case_notification_intents",
            ["actor", "is_new", sa.text("created_at DESC")],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("case_notification_intents"):
        op.drop_index("ix_case_notifications_actor", table_name="case_notification_intents")
        op.drop_index("ix_case_notifications_case_new", table_name="case_notification_intents")
        op.drop_table("case_notification_intents")

    if inspector.has_table("case_events"):
        op.drop_index("ix_case_events_type", table_name="case_events")
        op.drop_index("ix_case_events_case_created", table_name="case_events")
        op.drop_table("case_events")

    case_notification_intent_type.drop(bind, checkfirst=True)
    case_event_type.drop(bind, checkfirst=True)
