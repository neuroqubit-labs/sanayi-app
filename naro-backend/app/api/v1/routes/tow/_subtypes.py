from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case import (
    ServiceCase,
    TowDispatchStage,
    TowEquipment,
    TowIncidentReason,
    TowMode,
)
from app.models.case_subtypes import TowCase
from app.schemas.tow import TowCreateCaseRequest
from app.services.case_create import build_vehicle_snapshot


async def _insert_tow_subtype_row(
    db: AsyncSession,
    case: ServiceCase,
    payload: TowCreateCaseRequest,
) -> TowCase:
    """Faz 1 canonical case architecture — TowCase subtype + snapshot.

    service_cases.tow_* migration 0032 ile DROP edildi; subtype tek kaynak.
    """
    snapshot = await build_vehicle_snapshot(db, case.vehicle_id)
    tow_mode = TowMode(payload.mode.value)
    initial_stage = (
        TowDispatchStage.SEARCHING
        if tow_mode == TowMode.IMMEDIATE
        else TowDispatchStage.SCHEDULED_WAITING
    )
    equipment = [
        TowEquipment(e.value) for e in payload.required_equipment
    ] or None

    tow_row = TowCase(
        case_id=case.id,
        parent_case_id=payload.parent_case_id,
        tow_mode=tow_mode,
        tow_stage=initial_stage,
        tow_required_equipment=equipment,
        incident_reason=TowIncidentReason(payload.incident_reason.value),
        scheduled_at=payload.scheduled_at,
        pickup_lat=payload.pickup_lat_lng.lat,
        pickup_lng=payload.pickup_lat_lng.lng,
        pickup_address=payload.pickup_label,
        dropoff_lat=(
            payload.dropoff_lat_lng.lat if payload.dropoff_lat_lng else None
        ),
        dropoff_lng=(
            payload.dropoff_lat_lng.lng if payload.dropoff_lat_lng else None
        ),
        dropoff_address=payload.dropoff_label,
        tow_fare_quote=payload.fare_quote.model_dump(mode="json"),
        **snapshot,
    )
    db.add(tow_row)
    await db.flush()
    return tow_row
