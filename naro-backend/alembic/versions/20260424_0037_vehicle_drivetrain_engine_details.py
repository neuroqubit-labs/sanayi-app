"""vehicle drivetrain + engine_displacement + engine_power_hp

Revision ID: 20260424_0037
Revises: 20260424_0036
Create Date: 2026-04-24 15:30:00.000000

Plan: arac-ekleme-akisi-rewrite (Tur 2 yoğunlaştırma).

Gelişmiş (advanced) adımında kullanıcı araç için motor hacmi, motor gücü
(hp) ve çekiş (drivetrain) girebilsin. Hepsi opsiyonel; sahibinden-vari
veri toplama genişletmesi.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op


revision: str = "20260424_0037"
down_revision: str | None = "20260424_0036"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


VEHICLE_DRIVETRAIN_VALUES = ("fwd", "rwd", "awd", "fourwd")


vehicle_drivetrain_enum = postgresql.ENUM(
    *VEHICLE_DRIVETRAIN_VALUES,
    name="vehicle_drivetrain",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    vehicle_drivetrain_enum.create(bind, checkfirst=True)

    existing_cols = {col["name"] for col in inspector.get_columns("vehicles")}

    if "drivetrain" not in existing_cols:
        op.add_column(
            "vehicles",
            sa.Column("drivetrain", vehicle_drivetrain_enum, nullable=True),
        )
    if "engine_displacement" not in existing_cols:
        op.add_column(
            "vehicles",
            sa.Column(
                "engine_displacement", sa.String(length=16), nullable=True
            ),
        )
    if "engine_power_hp" not in existing_cols:
        op.add_column(
            "vehicles",
            sa.Column("engine_power_hp", sa.SmallInteger(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {col["name"] for col in inspector.get_columns("vehicles")}

    if "engine_power_hp" in existing_cols:
        op.drop_column("vehicles", "engine_power_hp")
    if "engine_displacement" in existing_cols:
        op.drop_column("vehicles", "engine_displacement")
    if "drivetrain" in existing_cols:
        op.drop_column("vehicles", "drivetrain")

    vehicle_drivetrain_enum.drop(bind, checkfirst=True)
