from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException
from sqlalchemy import and_, select

from app.api.v1.deps import DbDep, RedisDep, TowTechnicianDep
from app.core.config import get_settings
from app.models.case import ServiceCase, ServiceRequestKind, TowDispatchStage, TowEquipment
from app.models.case_subtypes import TowCase
from app.models.technician import TechnicianAvailability
from app.models.tow import TowDispatchAttempt, TowDispatchResponse
from app.models.user import User
from app.repositories import technician as technician_repo
from app.schemas.tow import (
    TowAvailabilityInput,
    TowAvailabilityOutput,
    TowCaseSnapshot,
    TowPendingDispatch,
)
from app.services import tow_presence

from ._guards import _get_tow_profile_for_user
from ._presenters import _build_availability_output, _build_pending_dispatch, _build_snapshot

router = APIRouter()


@router.post(
    "/technicians/me/availability",
    response_model=TowAvailabilityOutput,
    summary="Çekici canlı uygunluk + son konum heartbeat",
)
async def set_tow_availability(
    payload: TowAvailabilityInput,
    tech: TowTechnicianDep,
    db: DbDep,
    redis: RedisDep,
) -> TowAvailabilityOutput:
    profile = await _get_tow_profile_for_user(db, tech.id)
    now = datetime.now(UTC)

    if payload.available and (payload.lat is None or payload.lng is None):
        raise HTTPException(
            status_code=422,
            detail={
                "type": "location_required",
                "message": "available=true için lat/lng gerekir",
            },
        )

    profile.availability = (
        TechnicianAvailability.AVAILABLE
        if payload.available
        else TechnicianAvailability.OFFLINE
    )
    if payload.lat is not None and payload.lng is not None:
        profile.last_known_location_lat = payload.lat
        profile.last_known_location_lng = payload.lng
        profile.last_location_at = payload.captured_at or now

    equipment = [TowEquipment(e.value) for e in payload.equipment]
    if equipment:
        await technician_repo.replace_tow_equipment(
            db, profile_id=profile.id, equipment=list(dict.fromkeys(equipment))
        )

    if payload.available and payload.lat is not None and payload.lng is not None:
        await tow_presence.mark_available(
            db,
            redis,
            profile=profile,
            technician_id=tech.id,
            lat=payload.lat,
            lng=payload.lng,
            captured_at=payload.captured_at or now,
        )
    if not payload.available:
        await tow_presence.mark_offline(
            db,
            redis,
            profile=profile,
            technician_id=tech.id,
        )

    await db.commit()
    equipment_after = await technician_repo.list_tow_equipment(db, profile.id)
    return _build_availability_output(profile, equipment_after)


@router.get(
    "/technicians/me/availability",
    response_model=TowAvailabilityOutput,
    summary="Çekici canlı uygunluk durumu",
)
async def get_tow_availability(
    tech: TowTechnicianDep,
    db: DbDep,
) -> TowAvailabilityOutput:
    profile = await _get_tow_profile_for_user(db, tech.id)
    equipment = await technician_repo.list_tow_equipment(db, profile.id)
    return _build_availability_output(profile, equipment)


@router.get(
    "/technicians/me/dispatches/pending",
    response_model=TowPendingDispatch | None,
    summary="Teknisyen için canlı bekleyen dispatch attempt",
)
async def get_pending_dispatch(
    tech: TowTechnicianDep,
    db: DbDep,
) -> TowPendingDispatch | None:
    profile = await _get_tow_profile_for_user(db, tech.id)
    settings = get_settings()
    cutoff = datetime.now(UTC) - timedelta(seconds=settings.tow_accept_window_seconds)
    stmt = (
        select(TowDispatchAttempt, ServiceCase, TowCase, User)
        .join(ServiceCase, ServiceCase.id == TowDispatchAttempt.case_id)
        .join(TowCase, TowCase.case_id == ServiceCase.id)
        .join(User, User.id == ServiceCase.customer_user_id)
        .where(
            and_(
                TowDispatchAttempt.technician_id == tech.id,
                TowDispatchAttempt.response == TowDispatchResponse.PENDING,
                TowDispatchAttempt.sent_at >= cutoff,
                TowCase.tow_stage == TowDispatchStage.SEARCHING,
            )
        )
        .order_by(TowDispatchAttempt.sent_at.desc())
        .limit(1)
    )
    row = (await db.execute(stmt)).first()
    if row is None:
        return None
    attempt, case, tow_case, customer = row
    return _build_pending_dispatch(attempt, case, tow_case, customer, profile)


@router.get(
    "/technicians/me/active-case",
    response_model=TowCaseSnapshot | None,
    summary="Teknisyenin aktif çekici işi",
)
async def get_active_tow_case(
    tech: TowTechnicianDep,
    db: DbDep,
) -> TowCaseSnapshot | None:
    stmt = (
        select(ServiceCase)
        .join(TowCase, TowCase.case_id == ServiceCase.id)
        .where(
            and_(
                ServiceCase.assigned_technician_id == tech.id,
                ServiceCase.kind == ServiceRequestKind.TOWING,
                ~TowCase.tow_stage.in_(
                    [TowDispatchStage.DELIVERED, TowDispatchStage.CANCELLED]
                ),
            )
        )
        .order_by(ServiceCase.updated_at.desc())
        .limit(1)
    )
    case = (await db.execute(stmt)).scalar_one_or_none()
    if case is None:
        return None
    return await _build_snapshot(db, case)
