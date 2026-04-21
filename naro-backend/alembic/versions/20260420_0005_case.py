"""case: service_cases + 5 enums + pool/assigned/jsonb/trgm indexes

Revision ID: 20260420_0005
Revises: 20260420_0004
Create Date: 2026-04-20 17:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260420_0005"
down_revision: str | None = "20260420_0004"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


service_request_kind = postgresql.ENUM(
    "accident",
    "towing",
    "breakdown",
    "maintenance",
    name="service_request_kind",
    create_type=False,
)
service_request_urgency = postgresql.ENUM(
    "planned",
    "today",
    "urgent",
    name="service_request_urgency",
    create_type=False,
)
service_case_status = postgresql.ENUM(
    "matching",
    "offers_ready",
    "appointment_pending",
    "scheduled",
    "service_in_progress",
    "parts_approval",
    "invoice_approval",
    "completed",
    "archived",
    "cancelled",
    name="service_case_status",
    create_type=False,
)
case_origin = postgresql.ENUM(
    "customer",
    "technician",
    name="case_origin",
    create_type=False,
)
case_wait_actor = postgresql.ENUM(
    "customer",
    "technician",
    "system",
    "none",
    name="case_wait_actor",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    service_request_kind.create(bind, checkfirst=True)
    service_request_urgency.create(bind, checkfirst=True)
    service_case_status.create(bind, checkfirst=True)
    case_origin.create(bind, checkfirst=True)
    case_wait_actor.create(bind, checkfirst=True)

    if not inspector.has_table("service_cases"):
        op.create_table(
            "service_cases",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("vehicle_id", sa.UUID(), nullable=False),
            sa.Column("customer_user_id", sa.UUID(), nullable=False),
            sa.Column("kind", service_request_kind, nullable=False),
            sa.Column(
                "urgency",
                service_request_urgency,
                nullable=False,
                server_default="planned",
            ),
            sa.Column(
                "status",
                service_case_status,
                nullable=False,
                server_default="matching",
            ),
            sa.Column(
                "origin",
                case_origin,
                nullable=False,
                server_default="customer",
            ),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("subtitle", sa.String(length=255), nullable=True),
            sa.Column("summary", sa.Text(), nullable=True),
            sa.Column("location_label", sa.String(length=255), nullable=True),
            sa.Column("preferred_technician_id", sa.UUID(), nullable=True),
            sa.Column("assigned_technician_id", sa.UUID(), nullable=True),
            sa.Column("workflow_blueprint", sa.String(length=64), nullable=False),
            sa.Column("request_draft", postgresql.JSONB(), nullable=False),
            sa.Column(
                "wait_state_actor",
                case_wait_actor,
                nullable=False,
                server_default="system",
            ),
            sa.Column("wait_state_label", sa.String(length=255), nullable=True),
            sa.Column("wait_state_description", sa.Text(), nullable=True),
            sa.Column(
                "last_seen_by_customer", sa.DateTime(timezone=True), nullable=True
            ),
            sa.Column(
                "last_seen_by_technician",
                sa.DateTime(timezone=True),
                nullable=True,
            ),
            sa.Column("total_amount", sa.Numeric(12, 2), nullable=True),
            sa.Column("estimate_amount", sa.Numeric(12, 2), nullable=True),
            sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
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
                ["vehicle_id"], ["vehicles.id"], ondelete="RESTRICT"
            ),
            sa.ForeignKeyConstraint(
                ["customer_user_id"], ["users.id"], ondelete="RESTRICT"
            ),
            sa.ForeignKeyConstraint(
                ["preferred_technician_id"],
                ["users.id"],
                ondelete="SET NULL",
            ),
            sa.ForeignKeyConstraint(
                ["assigned_technician_id"],
                ["users.id"],
                ondelete="SET NULL",
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_cases_pool_feed",
            "service_cases",
            ["status", "kind", "urgency", sa.text("created_at DESC")],
            unique=False,
            postgresql_where=sa.text(
                "deleted_at IS NULL AND status IN ('matching','offers_ready')"
            ),
        )
        op.create_index(
            "ix_cases_assigned_tech",
            "service_cases",
            [
                "assigned_technician_id",
                "status",
                sa.text("updated_at DESC"),
            ],
            unique=False,
            postgresql_where=sa.text("assigned_technician_id IS NOT NULL"),
        )
        op.create_index(
            "ix_cases_preferred_tech",
            "service_cases",
            ["preferred_technician_id", "status"],
            unique=False,
            postgresql_where=sa.text("preferred_technician_id IS NOT NULL"),
        )
        op.create_index(
            "ix_cases_customer",
            "service_cases",
            ["customer_user_id", "status", sa.text("created_at DESC")],
            unique=False,
            postgresql_where=sa.text("deleted_at IS NULL"),
        )
        op.create_index(
            "ix_cases_vehicle",
            "service_cases",
            ["vehicle_id", sa.text("created_at DESC")],
            unique=False,
        )
        op.create_index(
            "ix_cases_request_gin",
            "service_cases",
            ["request_draft"],
            unique=False,
            postgresql_using="gin",
            postgresql_ops={"request_draft": "jsonb_path_ops"},
        )
        op.create_index(
            "ix_cases_title_trgm",
            "service_cases",
            ["title"],
            unique=False,
            postgresql_using="gin",
            postgresql_ops={"title": "gin_trgm_ops"},
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("service_cases"):
        op.drop_index("ix_cases_title_trgm", table_name="service_cases")
        op.drop_index("ix_cases_request_gin", table_name="service_cases")
        op.drop_index("ix_cases_vehicle", table_name="service_cases")
        op.drop_index("ix_cases_customer", table_name="service_cases")
        op.drop_index("ix_cases_preferred_tech", table_name="service_cases")
        op.drop_index("ix_cases_assigned_tech", table_name="service_cases")
        op.drop_index("ix_cases_pool_feed", table_name="service_cases")
        op.drop_table("service_cases")

    case_wait_actor.drop(bind, checkfirst=True)
    case_origin.drop(bind, checkfirst=True)
    service_case_status.drop(bind, checkfirst=True)
    service_request_urgency.drop(bind, checkfirst=True)
    service_request_kind.drop(bind, checkfirst=True)
