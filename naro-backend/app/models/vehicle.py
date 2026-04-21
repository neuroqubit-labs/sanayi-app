"""Vehicle domain models — araç kaydı + user-vehicle sahiplik linki.

Plaka uniqueness `plate_normalized` üzerinden partial index ile (silinmiş plaka
yeniden kullanılabilir). Sahiplik zamansal (ownership_from/to); transfer eski
link'i kapatıp yeni link açar. Dossier (case geçmişi, owner adı) computed —
repository join ile döner, kolon olarak tutulmaz.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, SmallInteger, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin


class VehicleFuelType(StrEnum):
    PETROL = "petrol"
    DIESEL = "diesel"
    LPG = "lpg"
    ELECTRIC = "electric"
    HYBRID = "hybrid"
    OTHER = "other"


class UserVehicleRole(StrEnum):
    """App-level; DB'de CHECK constraint ile enforce."""

    OWNER = "owner"
    DRIVER = "driver"
    FAMILY = "family"


class Vehicle(UUIDPkMixin, TimestampMixin, Base):
    """Araç kaydı. Plaka normalize edilmiş kolon üzerinden eşsiz."""

    __tablename__ = "vehicles"

    plate: Mapped[str] = mapped_column(String(32), nullable=False)
    plate_normalized: Mapped[str] = mapped_column(String(32), nullable=False)
    make: Mapped[str | None] = mapped_column(String(64))
    model: Mapped[str | None] = mapped_column(String(128))
    year: Mapped[int | None] = mapped_column(SmallInteger)
    color: Mapped[str | None] = mapped_column(String(64))
    fuel_type: Mapped[VehicleFuelType | None] = mapped_column(
        SAEnum(VehicleFuelType, name="vehicle_fuel_type"),
        nullable=True,
    )
    vin: Mapped[str | None] = mapped_column(String(32))
    current_km: Mapped[int | None] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(String(500))

    # Faz 9 vehicle lifecycle — muayene + sigorta takibi (reminders için)
    inspection_valid_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    inspection_kind: Mapped[str | None] = mapped_column(String(32))  # periodic|exhaust|ntvt
    kasko_valid_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    kasko_insurer: Mapped[str | None] = mapped_column(String(255))
    trafik_valid_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    trafik_insurer: Mapped[str | None] = mapped_column(String(255))
    exhaust_valid_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class UserVehicleLink(UUIDPkMixin, Base):
    """Kullanıcı-araç sahiplik kaydı. Zamansal: ownership_from/to."""

    __tablename__ = "user_vehicle_links"
    __table_args__ = (
        CheckConstraint(
            "role IN ('owner','driver','family')",
            name="ck_user_vehicle_links_role",
        ),
        CheckConstraint(
            "ownership_to IS NULL OR ownership_to > ownership_from",
            name="ck_user_vehicle_links_period",
        ),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    vehicle_id: Mapped[UUID] = mapped_column(
        ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False
    )
    is_primary: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    role: Mapped[str] = mapped_column(
        String(16), nullable=False, default="owner", server_default="owner"
    )
    ownership_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
    ownership_to: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )
