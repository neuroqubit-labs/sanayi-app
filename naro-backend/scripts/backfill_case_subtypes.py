"""Backfill script — mevcut service_cases → subtype tablolarına (Faz 1b).

Kullanım:
    cd naro-backend
    set -a && source .env.local && set +a
    uv run python scripts/backfill_case_subtypes.py

**Idempotent** — subtype row zaten varsa atlanır. 2x çalıştırma güvenli.

Her service_cases satırı için:
1. Kind'a göre subtype tablosuna row insert
2. Tow → mevcut ServiceCase kolonlarından (tow_mode, tow_stage, pickup/
   dropoff_*, tow_fare_quote, incident_reason, scheduled_at) kopya
3. Accident/breakdown/maintenance → request_draft JSONB'den parse
4. Vehicle snapshot → Vehicles tablosundan 7 alan kopya

Subtype-specific default: backfill öncesi NULL kolonlar placeholder
(FE V1.1'de canonical düzeltir). Pilot scope: 2 case → 2 satır insert.

Migration 0032 (DROP service_cases.tow_* kolonları) BU SCRIPT SONRASI
çalıştırılır.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, cast
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.case import ServiceCase, ServiceRequestKind, TowDispatchStage, TowMode
from app.models.case_subtypes import (
    AccidentCase,
    BreakdownCase,
    MaintenanceCase,
    TowCase,
)
from app.models.vehicle import Vehicle

logger = logging.getLogger("backfill_case_subtypes")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")


# ─── Helpers ──────────────────────────────────────────────────────────────


async def _vehicle_snapshot(
    db: AsyncSession, vehicle_id: UUID
) -> dict[str, Any]:
    vehicle = await db.get(Vehicle, vehicle_id)
    if vehicle is None:
        # Vehicle silinmiş — plaka placeholder (snapshot_plate NOT NULL)
        return {
            "snapshot_plate": "UNKNOWN",
            "snapshot_make": None,
            "snapshot_model": None,
            "snapshot_year": None,
            "snapshot_fuel_type": None,
            "snapshot_vin": None,
            "snapshot_current_km": None,
        }
    return {
        "snapshot_plate": vehicle.plate,
        "snapshot_make": vehicle.make,
        "snapshot_model": vehicle.model,
        "snapshot_year": vehicle.year,
        "snapshot_fuel_type": (
            vehicle.fuel_type.value if vehicle.fuel_type else None
        ),
        "snapshot_vin": vehicle.vin,
        "snapshot_current_km": vehicle.current_km,
    }


def _draft_field(
    draft: dict[str, Any] | None, key: str, default: Any = None
) -> Any:
    if not isinstance(draft, dict):
        return default
    return draft.get(key, default)


# ─── Subtype backfill ─────────────────────────────────────────────────────


async def _backfill_tow(
    db: AsyncSession, case: ServiceCase
) -> TowCase | None:
    existing = await db.get(TowCase, case.id)
    if existing is not None:
        return existing
    snapshot = await _vehicle_snapshot(db, case.vehicle_id)
    # Tow alanları service_cases'te var (migration 0032 öncesi)
    tow_mode_val = getattr(case, "tow_mode", None) or TowMode.IMMEDIATE
    tow_stage_val = (
        getattr(case, "tow_stage", None) or TowDispatchStage.SEARCHING
    )
    row = TowCase(
        case_id=case.id,
        tow_mode=tow_mode_val,
        tow_stage=tow_stage_val,
        tow_required_equipment=getattr(case, "tow_required_equipment", None),
        incident_reason=getattr(case, "incident_reason", None),
        scheduled_at=getattr(case, "scheduled_at", None),
        pickup_lat=getattr(case, "pickup_lat", None),
        pickup_lng=getattr(case, "pickup_lng", None),
        pickup_address=getattr(case, "pickup_address", None),
        dropoff_lat=getattr(case, "dropoff_lat", None),
        dropoff_lng=getattr(case, "dropoff_lng", None),
        dropoff_address=getattr(case, "dropoff_address", None),
        tow_fare_quote=getattr(case, "tow_fare_quote", None),
        **snapshot,
    )
    db.add(row)
    await db.flush()
    return row


async def _backfill_accident(
    db: AsyncSession, case: ServiceCase
) -> AccidentCase | None:
    existing = await db.get(AccidentCase, case.id)
    if existing is not None:
        return existing
    snapshot = await _vehicle_snapshot(db, case.vehicle_id)
    draft = cast(dict[str, Any], case.request_draft or {})
    row = AccidentCase(
        case_id=case.id,
        damage_area=_draft_field(draft, "damage_area"),
        damage_severity=_draft_field(draft, "damage_severity"),
        counterparty_count=int(
            _draft_field(draft, "counterparty_vehicle_count") or 0
        ),
        counterparty_note=_draft_field(draft, "counterparty_note"),
        kasko_selected=bool(_draft_field(draft, "kasko_selected", False)),
        sigorta_selected=bool(_draft_field(draft, "sigorta_selected", False)),
        kasko_brand=_draft_field(draft, "kasko_brand"),
        sigorta_brand=_draft_field(draft, "sigorta_brand"),
        ambulance_contacted=bool(
            _draft_field(draft, "ambulance_contacted", False)
        ),
        report_method=_draft_field(draft, "report_method"),
        emergency_acknowledged=bool(
            _draft_field(draft, "emergency_acknowledged", False)
        ),
        **snapshot,
    )
    db.add(row)
    await db.flush()
    return row


async def _backfill_breakdown(
    db: AsyncSession, case: ServiceCase
) -> BreakdownCase | None:
    existing = await db.get(BreakdownCase, case.id)
    if existing is not None:
        return existing
    snapshot = await _vehicle_snapshot(db, case.vehicle_id)
    draft = cast(dict[str, Any], case.request_draft or {})
    symptoms_raw = _draft_field(draft, "symptoms")
    symptoms_str: str | None
    if isinstance(symptoms_raw, list):
        symptoms_str = ", ".join(str(s) for s in symptoms_raw)
    else:
        symptoms_str = str(symptoms_raw) if symptoms_raw else None
    row = BreakdownCase(
        case_id=case.id,
        breakdown_category=(
            _draft_field(draft, "breakdown_category") or "other"
        ),
        symptoms=symptoms_str,
        vehicle_drivable=_draft_field(draft, "vehicle_drivable"),
        on_site_repair_requested=bool(
            _draft_field(draft, "on_site_repair", False)
        ),
        valet_requested=bool(_draft_field(draft, "valet_requested", False)),
        pickup_preference=_draft_field(draft, "pickup_preference"),
        price_preference=_draft_field(draft, "price_preference"),
        **snapshot,
    )
    db.add(row)
    await db.flush()
    return row


async def _backfill_maintenance(
    db: AsyncSession, case: ServiceCase
) -> MaintenanceCase | None:
    existing = await db.get(MaintenanceCase, case.id)
    if existing is not None:
        return existing
    snapshot = await _vehicle_snapshot(db, case.vehicle_id)
    draft = cast(dict[str, Any], case.request_draft or {})
    row = MaintenanceCase(
        case_id=case.id,
        maintenance_category=(
            _draft_field(draft, "maintenance_category")
            or _draft_field(draft, "domain")
            or "general"
        ),
        maintenance_detail=_draft_field(draft, "maintenance_detail"),
        maintenance_tier=_draft_field(draft, "maintenance_tier"),
        service_style_preference=_draft_field(draft, "service_style_preference"),
        mileage_km=_draft_field(draft, "mileage_km"),
        valet_requested=bool(_draft_field(draft, "valet_requested", False)),
        pickup_preference=_draft_field(draft, "pickup_preference"),
        price_preference=_draft_field(draft, "price_preference"),
        **snapshot,
    )
    db.add(row)
    await db.flush()
    return row


async def main() -> None:
    counts: dict[str, int] = {
        "tow": 0,
        "accident": 0,
        "breakdown": 0,
        "maintenance": 0,
        "skipped_existing": 0,
    }
    async with AsyncSessionLocal() as db:
        stmt = select(ServiceCase).where(ServiceCase.deleted_at.is_(None))
        cases = list((await db.execute(stmt)).scalars().all())
        for case in cases:
            if case.kind == ServiceRequestKind.TOWING:
                row: Any = await _backfill_tow(db, case)
                counts["tow"] += 1
            elif case.kind == ServiceRequestKind.ACCIDENT:
                row = await _backfill_accident(db, case)
                counts["accident"] += 1
            elif case.kind == ServiceRequestKind.BREAKDOWN:
                row = await _backfill_breakdown(db, case)
                counts["breakdown"] += 1
            elif case.kind == ServiceRequestKind.MAINTENANCE:
                row = await _backfill_maintenance(db, case)
                counts["maintenance"] += 1
            else:
                continue
            if row is None:
                counts["skipped_existing"] += 1
        await db.commit()

    logger.info("backfill done: %s", counts)


if __name__ == "__main__":
    asyncio.run(main())
