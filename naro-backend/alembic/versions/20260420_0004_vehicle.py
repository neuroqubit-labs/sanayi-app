"""vehicle: vehicles + user_vehicle_links

Revision ID: 20260420_0004
Revises: 20260420_0003
Create Date: 2026-04-20 16:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260420_0004"
down_revision: str | None = "20260420_0003"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


vehicle_fuel_type = postgresql.ENUM(
    "petrol",
    "diesel",
    "lpg",
    "electric",
    "hybrid",
    "other",
    name="vehicle_fuel_type",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    vehicle_fuel_type.create(bind, checkfirst=True)

    if not inspector.has_table("vehicles"):
        op.create_table(
            "vehicles",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("plate", sa.String(length=32), nullable=False),
            sa.Column("plate_normalized", sa.String(length=32), nullable=False),
            sa.Column("make", sa.String(length=64), nullable=True),
            sa.Column("model", sa.String(length=128), nullable=True),
            sa.Column("year", sa.SmallInteger(), nullable=True),
            sa.Column("color", sa.String(length=64), nullable=True),
            sa.Column("fuel_type", vehicle_fuel_type, nullable=True),
            sa.Column("vin", sa.String(length=32), nullable=True),
            sa.Column("current_km", sa.Integer(), nullable=True),
            sa.Column("note", sa.String(length=500), nullable=True),
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
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "uq_vehicles_plate_normalized",
            "vehicles",
            ["plate_normalized"],
            unique=True,
            postgresql_where=sa.text("deleted_at IS NULL"),
        )
        op.create_index(
            "ix_vehicles_plate_trgm",
            "vehicles",
            ["plate_normalized"],
            unique=False,
            postgresql_using="gin",
            postgresql_ops={"plate_normalized": "gin_trgm_ops"},
        )
        op.create_index(
            "ix_vehicles_vin",
            "vehicles",
            ["vin"],
            unique=False,
            postgresql_where=sa.text("vin IS NOT NULL"),
        )

    if not inspector.has_table("user_vehicle_links"):
        op.create_table(
            "user_vehicle_links",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("user_id", sa.UUID(), nullable=False),
            sa.Column("vehicle_id", sa.UUID(), nullable=False),
            sa.Column(
                "is_primary",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
            sa.Column(
                "role",
                sa.String(length=16),
                nullable=False,
                server_default="owner",
            ),
            sa.Column(
                "ownership_from",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column("ownership_to", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.CheckConstraint(
                "role IN ('owner','driver','family')",
                name="ck_user_vehicle_links_role",
            ),
            sa.CheckConstraint(
                "ownership_to IS NULL OR ownership_to > ownership_from",
                name="ck_user_vehicle_links_period",
            ),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(
                ["vehicle_id"], ["vehicles.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "uq_active_owner_per_vehicle",
            "user_vehicle_links",
            ["vehicle_id"],
            unique=True,
            postgresql_where=sa.text(
                "ownership_to IS NULL AND role = 'owner'"
            ),
        )
        op.create_index(
            "ix_user_vehicle_active",
            "user_vehicle_links",
            ["user_id", "ownership_to"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("user_vehicle_links"):
        op.drop_index(
            "ix_user_vehicle_active", table_name="user_vehicle_links"
        )
        op.drop_index(
            "uq_active_owner_per_vehicle", table_name="user_vehicle_links"
        )
        op.drop_table("user_vehicle_links")

    if inspector.has_table("vehicles"):
        op.drop_index("ix_vehicles_vin", table_name="vehicles")
        op.drop_index("ix_vehicles_plate_trgm", table_name="vehicles")
        op.drop_index("uq_vehicles_plate_normalized", table_name="vehicles")
        op.drop_table("vehicles")

    vehicle_fuel_type.drop(bind, checkfirst=True)
