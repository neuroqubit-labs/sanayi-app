"""case_process core: milestones + tasks + approvals + line_items

Revision ID: 20260421_0010
Revises: 20260421_0009
Create Date: 2026-04-21 12:00:00.000000

Faz 7a — case_process katmanı iskeleti. Milestone + task backbone'ü +
approval (parts/invoice/completion) + line_items.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260421_0010"
down_revision: str | None = "20260421_0009"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


case_actor = postgresql.ENUM(
    "customer", "technician", "system", name="case_actor", create_type=False
)
case_milestone_status = postgresql.ENUM(
    "completed", "active", "upcoming", "blocked",
    name="case_milestone_status", create_type=False,
)
case_task_kind = postgresql.ENUM(
    "refresh_matching", "review_offers", "confirm_appointment", "review_progress",
    "approve_parts", "approve_invoice", "confirm_completion", "message_service",
    "upload_intake_proof", "upload_progress_proof", "share_status_update",
    "request_parts_approval", "share_invoice", "upload_delivery_proof",
    "mark_ready_for_delivery", "start_similar_request", "open_documents",
    name="case_task_kind", create_type=False,
)
case_task_status = postgresql.ENUM(
    "pending", "active", "completed", "blocked",
    name="case_task_status", create_type=False,
)
case_task_urgency = postgresql.ENUM(
    "background", "soon", "now",
    name="case_task_urgency", create_type=False,
)
case_approval_kind = postgresql.ENUM(
    "parts_request", "invoice", "completion",
    name="case_approval_kind", create_type=False,
)
case_approval_status = postgresql.ENUM(
    "pending", "approved", "rejected",
    name="case_approval_status", create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    case_actor.create(bind, checkfirst=True)
    case_milestone_status.create(bind, checkfirst=True)
    case_task_kind.create(bind, checkfirst=True)
    case_task_status.create(bind, checkfirst=True)
    case_task_urgency.create(bind, checkfirst=True)
    case_approval_kind.create(bind, checkfirst=True)
    case_approval_status.create(bind, checkfirst=True)

    # ── case_milestones ──
    if not inspector.has_table("case_milestones"):
        op.create_table(
            "case_milestones",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("case_id", sa.UUID(), nullable=False),
            sa.Column("key", sa.String(length=64), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("actor", case_actor, nullable=False),
            sa.Column("sequence", sa.SmallInteger(), nullable=False),
            sa.Column("status", case_milestone_status, nullable=False, server_default="upcoming"),
            sa.Column("badge_label", sa.String(length=64), nullable=True),
            sa.Column("blocker_reason", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["case_id"], ["service_cases.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_case_milestones_case",
            "case_milestones",
            ["case_id", "sequence"],
            unique=False,
        )
        op.create_index(
            "ix_case_milestones_active",
            "case_milestones",
            ["case_id", "status"],
            unique=False,
            postgresql_where=sa.text("status = 'active'"),
        )

    # ── case_tasks ──
    if not inspector.has_table("case_tasks"):
        op.create_table(
            "case_tasks",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("case_id", sa.UUID(), nullable=False),
            sa.Column("milestone_id", sa.UUID(), nullable=False),
            sa.Column("kind", case_task_kind, nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("actor", case_actor, nullable=False),
            sa.Column("status", case_task_status, nullable=False, server_default="pending"),
            sa.Column("urgency", case_task_urgency, nullable=False, server_default="background"),
            sa.Column("cta_label", sa.String(length=255), nullable=False),
            sa.Column("helper_label", sa.String(length=255), nullable=True),
            sa.Column("blocker_reason", sa.Text(), nullable=True),
            sa.Column(
                "evidence_requirements",
                postgresql.JSONB(),
                nullable=False,
                server_default=sa.text("'[]'::jsonb"),
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["case_id"], ["service_cases.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["milestone_id"], ["case_milestones.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_case_tasks_case_actor_status",
            "case_tasks",
            ["case_id", "actor", "status", "urgency"],
            unique=False,
        )
        op.create_index(
            "ix_case_tasks_milestone",
            "case_tasks",
            ["milestone_id"],
            unique=False,
        )
        op.create_index(
            "ix_case_tasks_active_now",
            "case_tasks",
            ["case_id", "actor"],
            unique=False,
            postgresql_where=sa.text("status = 'active' AND urgency = 'now'"),
        )

    # ── case_approvals ──
    if not inspector.has_table("case_approvals"):
        op.create_table(
            "case_approvals",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("case_id", sa.UUID(), nullable=False),
            sa.Column("kind", case_approval_kind, nullable=False),
            sa.Column("status", case_approval_status, nullable=False, server_default="pending"),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("requested_by_user_id", sa.UUID(), nullable=True),
            sa.Column("requested_by_snapshot_name", sa.String(length=255), nullable=True),
            sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("amount", sa.Numeric(12, 2), nullable=True),
            sa.Column("currency", sa.String(length=8), nullable=False, server_default="TRY"),
            sa.Column("service_comment", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["case_id"], ["service_cases.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["requested_by_user_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_case_approvals_case_kind_status",
            "case_approvals",
            ["case_id", "kind", "status"],
            unique=False,
        )
        op.create_index(
            "ix_case_approvals_pending",
            "case_approvals",
            ["case_id"],
            unique=False,
            postgresql_where=sa.text("status = 'pending'"),
        )

    # ── case_approval_line_items ──
    if not inspector.has_table("case_approval_line_items"):
        op.create_table(
            "case_approval_line_items",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("approval_id", sa.UUID(), nullable=False),
            sa.Column("label", sa.String(length=255), nullable=False),
            sa.Column("value", sa.String(length=255), nullable=False),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("sequence", sa.SmallInteger(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.CheckConstraint("sequence >= 0", name="ck_case_approval_line_items_seq"),
            sa.ForeignKeyConstraint(["approval_id"], ["case_approvals.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_case_approval_line_items_approval",
            "case_approval_line_items",
            ["approval_id", "sequence"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    for table, indexes in [
        ("case_approval_line_items", ["ix_case_approval_line_items_approval"]),
        ("case_approvals", ["ix_case_approvals_pending", "ix_case_approvals_case_kind_status"]),
        ("case_tasks", ["ix_case_tasks_active_now", "ix_case_tasks_milestone", "ix_case_tasks_case_actor_status"]),
        ("case_milestones", ["ix_case_milestones_active", "ix_case_milestones_case"]),
    ]:
        if inspector.has_table(table):
            for idx in indexes:
                op.drop_index(idx, table_name=table)
            op.drop_table(table)

    case_approval_status.drop(bind, checkfirst=True)
    case_approval_kind.drop(bind, checkfirst=True)
    case_task_urgency.drop(bind, checkfirst=True)
    case_task_status.drop(bind, checkfirst=True)
    case_task_kind.drop(bind, checkfirst=True)
    case_milestone_status.drop(bind, checkfirst=True)
    case_actor.drop(bind, checkfirst=True)
