"""Vehicle repository — CRUD + ownership transactions + dossier aggregation.

Plaka normalize application-level (`normalize_plate`). Ownership transfer iki
satırlı transaction: eski link close + yeni link create. Dossier (Faz 4'teki
service_cases ile join) Faz 4 sonrası tamamlanır; Faz 3'te stub döner.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vehicle import UserVehicleLink, UserVehicleRole, Vehicle

_WHITESPACE_RE = re.compile(r"\s+")


def normalize_plate(plate: str) -> str:
    return _WHITESPACE_RE.sub("", plate).upper()


async def find_vehicle_by_plate(
    session: AsyncSession, plate: str
) -> Vehicle | None:
    norm = normalize_plate(plate)
    stmt = select(Vehicle).where(
        and_(Vehicle.plate_normalized == norm, Vehicle.deleted_at.is_(None))
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def create_vehicle(
    session: AsyncSession,
    *,
    plate: str,
    owner_user_id: UUID,
    make: str | None = None,
    model: str | None = None,
    year: int | None = None,
    color: str | None = None,
    fuel_type: str | None = None,
    vin: str | None = None,
    current_km: int | None = None,
    note: str | None = None,
    is_primary: bool = True,
) -> Vehicle:
    """Vehicle + ilk owner link'i tek transaction'da yaratır."""
    vehicle = Vehicle(
        plate=plate,
        plate_normalized=normalize_plate(plate),
        make=make,
        model=model,
        year=year,
        color=color,
        fuel_type=fuel_type,
        vin=vin,
        current_km=current_km,
        note=note,
    )
    session.add(vehicle)
    await session.flush()

    link = UserVehicleLink(
        user_id=owner_user_id,
        vehicle_id=vehicle.id,
        is_primary=is_primary,
        role=UserVehicleRole.OWNER.value,
    )
    session.add(link)
    await session.flush()
    return vehicle


async def update_vehicle(
    session: AsyncSession,
    vehicle_id: UUID,
    **fields: object,
) -> None:
    allowed = {
        "plate",
        "make",
        "model",
        "year",
        "color",
        "fuel_type",
        "vin",
        "current_km",
        "note",
        "inspection_valid_until",
        "inspection_kind",
        "kasko_valid_until",
        "kasko_insurer",
        "trafik_valid_until",
        "trafik_insurer",
        "exhaust_valid_until",
    }
    values = {k: v for k, v in fields.items() if k in allowed and v is not None}
    if "plate" in values and isinstance(values["plate"], str):
        values["plate_normalized"] = normalize_plate(values["plate"])
    if not values:
        return
    await session.execute(
        update(Vehicle).where(Vehicle.id == vehicle_id).values(**values)
    )


async def soft_delete_vehicle(session: AsyncSession, vehicle_id: UUID) -> None:
    await session.execute(
        update(Vehicle)
        .where(Vehicle.id == vehicle_id)
        .values(deleted_at=datetime.now(UTC))
    )


async def list_vehicles_for_user(
    session: AsyncSession,
    user_id: UUID,
    *,
    active_only: bool = True,
) -> list[Vehicle]:
    conds = [
        UserVehicleLink.user_id == user_id,
        Vehicle.deleted_at.is_(None),
    ]
    if active_only:
        conds.append(UserVehicleLink.ownership_to.is_(None))
    stmt = (
        select(Vehicle)
        .join(UserVehicleLink, UserVehicleLink.vehicle_id == Vehicle.id)
        .where(and_(*conds))
        .order_by(UserVehicleLink.is_primary.desc(), Vehicle.updated_at.desc())
        .distinct()
    )
    return list((await session.execute(stmt)).scalars().all())


async def get_primary_vehicle(
    session: AsyncSession, user_id: UUID
) -> Vehicle | None:
    stmt = (
        select(Vehicle)
        .join(UserVehicleLink, UserVehicleLink.vehicle_id == Vehicle.id)
        .where(
            and_(
                UserVehicleLink.user_id == user_id,
                UserVehicleLink.ownership_to.is_(None),
                UserVehicleLink.is_primary.is_(True),
                Vehicle.deleted_at.is_(None),
            )
        )
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def set_primary(
    session: AsyncSession, user_id: UUID, vehicle_id: UUID
) -> None:
    """Kullanıcının diğer aktif link'leri is_primary=False; seçileni True."""
    await session.execute(
        update(UserVehicleLink)
        .where(
            and_(
                UserVehicleLink.user_id == user_id,
                UserVehicleLink.ownership_to.is_(None),
            )
        )
        .values(is_primary=False)
    )
    await session.execute(
        update(UserVehicleLink)
        .where(
            and_(
                UserVehicleLink.user_id == user_id,
                UserVehicleLink.vehicle_id == vehicle_id,
                UserVehicleLink.ownership_to.is_(None),
            )
        )
        .values(is_primary=True)
    )


async def transfer_ownership(
    session: AsyncSession,
    *,
    vehicle_id: UUID,
    from_user_id: UUID,
    to_user_id: UUID,
) -> UserVehicleLink:
    """Eski owner link'i kapat, yeni owner link aç."""
    now = datetime.now(UTC)
    await session.execute(
        update(UserVehicleLink)
        .where(
            and_(
                UserVehicleLink.vehicle_id == vehicle_id,
                UserVehicleLink.user_id == from_user_id,
                UserVehicleLink.ownership_to.is_(None),
                UserVehicleLink.role == UserVehicleRole.OWNER.value,
            )
        )
        .values(ownership_to=now, is_primary=False)
    )
    link = UserVehicleLink(
        user_id=to_user_id,
        vehicle_id=vehicle_id,
        role=UserVehicleRole.OWNER.value,
        is_primary=True,
        ownership_from=now,
    )
    session.add(link)
    await session.flush()
    return link


async def add_family_driver(
    session: AsyncSession,
    *,
    vehicle_id: UUID,
    user_id: UUID,
    role: UserVehicleRole = UserVehicleRole.DRIVER,
) -> UserVehicleLink:
    link = UserVehicleLink(
        user_id=user_id,
        vehicle_id=vehicle_id,
        role=role.value,
        is_primary=False,
    )
    session.add(link)
    await session.flush()
    return link


async def search_by_plate_prefix(
    session: AsyncSession, query: str, *, limit: int = 10
) -> list[Vehicle]:
    norm = normalize_plate(query)
    if not norm:
        return []
    stmt = (
        select(Vehicle)
        .where(
            and_(
                Vehicle.deleted_at.is_(None),
                Vehicle.plate_normalized.like(f"%{norm}%"),
            )
        )
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars().all())


async def get_active_owner_link(
    session: AsyncSession, vehicle_id: UUID
) -> UserVehicleLink | None:
    stmt = select(UserVehicleLink).where(
        and_(
            UserVehicleLink.vehicle_id == vehicle_id,
            UserVehicleLink.ownership_to.is_(None),
            UserVehicleLink.role == UserVehicleRole.OWNER.value,
        )
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_active_links_for_vehicle(
    session: AsyncSession, vehicle_id: UUID
) -> list[UserVehicleLink]:
    stmt = select(UserVehicleLink).where(
        and_(
            UserVehicleLink.vehicle_id == vehicle_id,
            UserVehicleLink.ownership_to.is_(None),
        )
    )
    return list((await session.execute(stmt)).scalars().all())


# Dossier aggregation (case count, last case) Faz 4'te `service_cases`
# tablosu oluşturulduktan sonra bu modüle eklenecek.
