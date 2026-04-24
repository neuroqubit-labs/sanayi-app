from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status

from app.api.v1.deps import CurrentUserDep, DbDep, RedisDep, TowTechnicianDep
from app.models.case import ServiceCase, ServiceRequestKind
from app.models.case_subtypes import TowCase
from app.schemas.tow import TowDispatchStageSchema, TowLocationInput, TowTrackingSnapshot
from app.services import tow_location as location_svc

from ._guards import _ensure_participant

router = APIRouter()


@router.get(
    "/cases/{case_id}/tracking",
    response_model=TowTrackingSnapshot,
    summary="Tracking — WS fallback polling",
)
async def get_tracking(
    case_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
    redis: RedisDep,
) -> TowTrackingSnapshot:
    case = await db.get(ServiceCase, case_id)
    if case is None or case.kind != ServiceRequestKind.TOWING:
        raise HTTPException(status_code=404, detail="tow case not found")
    _ensure_participant(case, user)
    tow_case = await db.get(TowCase, case.id)
    if tow_case is None:
        raise HTTPException(status_code=404, detail="tow subtype not found")

    last_location = None
    last_location_at = None
    if case.assigned_technician_id:
        cached = await redis.get(f"tow:loc:last:{case.assigned_technician_id}")
        if cached:
            import json

            data = json.loads(cached if isinstance(cached, str) else cached.decode())
            from app.schemas.tow import LatLng

            last_location = LatLng(lat=data["lat"], lng=data["lng"])
            last_location_at = datetime.fromisoformat(data["captured_at"])

    return TowTrackingSnapshot(
        case_id=case.id,
        stage=TowDispatchStageSchema(tow_case.tow_stage.value),
        technician_id=case.assigned_technician_id,
        last_location=last_location,
        last_location_at=last_location_at,
        eta_minutes=None,
        updated_at=case.updated_at,
    )

@router.post(
    "/cases/{case_id}/location",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="GPS ping — 5s moving / 15s stationary",
)
async def post_location(
    case_id: UUID,
    payload: TowLocationInput,
    tech: TowTechnicianDep,
    db: DbDep,
    redis: RedisDep,
) -> Response:
    case = await db.get(ServiceCase, case_id)
    if case is None or case.assigned_technician_id != tech.id:
        raise HTTPException(status_code=404, detail="case not assigned to this technician")
    await location_svc.record_location(
        db,
        redis=redis,
        case_id=case.id,
        technician_id=tech.id,
        lat=payload.lat,
        lng=payload.lng,
        heading_deg=payload.heading_deg,
        speed_kmh=payload.speed_kmh,
        accuracy_m=payload.accuracy_m,
        captured_at=payload.captured_at,
    )
    await db.commit()
