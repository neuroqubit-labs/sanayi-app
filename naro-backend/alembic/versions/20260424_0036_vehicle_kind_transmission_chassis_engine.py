"""vehicle kind + transmission + chassis + engine + photo_url

Revision ID: 20260424_0036
Revises: 20260423_0035
Create Date: 2026-04-24 14:00:00.000000

Plan: arac-ekleme-akisi-rewrite.

Araç ekleme akışı rewrite — matching motoru için `vehicle_kind` zorunlu
(UI'da Adım 1), `transmission` + `chassis_no` + `engine_no` + `photo_url`
ise tam opsiyonel (Gelişmiş/Görsel adımında — kullanıcı isteğe bağlı
doldurur).

Kolonlar nullable oluşturuluyor: eski araç kayıtlarını kırma; backfill
gerekmiyor. UI taraf yeni eklemelerde `vehicle_kind` zorla (Pydantic
VehicleCreate Required). `photo_url` pilot basitlik için plain string —
TB-4'te V1.1 için media_asset FK + lifecycle tracking planlandı.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260424_0036"
down_revision: str | None = "20260423_0035"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


VEHICLE_KIND_VALUES = (
    "otomobil",
    "suv",
    "motosiklet",
    "kamyonet",
    "hafif_ticari",
    "karavan",
    "klasik",
    "ticari",
)
VEHICLE_TRANSMISSION_VALUES = ("manuel", "otomatik", "yari_otomatik")


vehicle_kind_enum = postgresql.ENUM(
    *VEHICLE_KIND_VALUES,
    name="vehicle_kind",
    create_type=False,
)
vehicle_transmission_enum = postgresql.ENUM(
    *VEHICLE_TRANSMISSION_VALUES,
    name="vehicle_transmission",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    vehicle_kind_enum.create(bind, checkfirst=True)
    vehicle_transmission_enum.create(bind, checkfirst=True)

    existing_cols = {col["name"] for col in inspector.get_columns("vehicles")}

    if "vehicle_kind" not in existing_cols:
        op.add_column(
            "vehicles",
            sa.Column("vehicle_kind", vehicle_kind_enum, nullable=True),
        )
    if "transmission" not in existing_cols:
        op.add_column(
            "vehicles",
            sa.Column("transmission", vehicle_transmission_enum, nullable=True),
        )
    if "chassis_no" not in existing_cols:
        op.add_column(
            "vehicles",
            sa.Column("chassis_no", sa.String(length=32), nullable=True),
        )
    if "engine_no" not in existing_cols:
        op.add_column(
            "vehicles",
            sa.Column("engine_no", sa.String(length=32), nullable=True),
        )
    if "photo_url" not in existing_cols:
        op.add_column(
            "vehicles",
            sa.Column("photo_url", sa.String(length=500), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {col["name"] for col in inspector.get_columns("vehicles")}

    if "photo_url" in existing_cols:
        op.drop_column("vehicles", "photo_url")
    if "engine_no" in existing_cols:
        op.drop_column("vehicles", "engine_no")
    if "chassis_no" in existing_cols:
        op.drop_column("vehicles", "chassis_no")
    if "transmission" in existing_cols:
        op.drop_column("vehicles", "transmission")
    if "vehicle_kind" in existing_cols:
        op.drop_column("vehicles", "vehicle_kind")

    vehicle_transmission_enum.drop(bind, checkfirst=True)
    vehicle_kind_enum.drop(bind, checkfirst=True)
