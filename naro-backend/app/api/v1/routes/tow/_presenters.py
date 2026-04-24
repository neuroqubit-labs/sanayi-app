from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.case import ServiceCase, TowEquipment
from app.models.case_subtypes import TowCase
from app.models.technician import TechnicianAvailability, TechnicianProfile
from app.models.tow import TowDispatchAttempt
from app.models.user import User
from app.repositories import tow as tow_repo
from app.schemas.tow import (
    LatLng,
    TowAvailabilityOutput,
    TowCaseSnapshot,
    TowDispatchStageSchema,
    TowEquipmentSchema,
    TowFareQuote,
    TowModeSchema,
    TowPendingDispatch,
    TowSettlementStatusSchema,
    tow_phase,
    tow_stage_label,
)


def _profile_location(profile: TechnicianProfile) -> LatLng | None:
    if (
        profile.last_known_location_lat is None
        or profile.last_known_location_lng is None
    ):
        return None
    return LatLng(
        lat=profile.last_known_location_lat,
        lng=profile.last_known_location_lng,
    )


def _build_availability_output(
    profile: TechnicianProfile, equipment: list[TowEquipment]
) -> TowAvailabilityOutput:
    return TowAvailabilityOutput(
        available=profile.availability == TechnicianAvailability.AVAILABLE,
        availability=profile.availability.value,  # type: ignore[arg-type]
        equipment=[TowEquipmentSchema(e.value) for e in equipment],
        last_location=_profile_location(profile),
        last_location_at=profile.last_location_at,
    )


def _build_pending_dispatch(
    attempt: TowDispatchAttempt,
    case: ServiceCase,
    tow_case: TowCase,
    customer: User,
    profile: TechnicianProfile,
) -> TowPendingDispatch:
    settings = get_settings()
    quote = tow_case.tow_fare_quote or {}
    cap_amount = quote.get("cap_amount") or quote.get("locked_price") or "0"
    equipment = tow_case.tow_required_equipment or []
    equipment_label = ", ".join(e.value for e in equipment) or "Standart çekici"
    if tow_case.pickup_lat is None or tow_case.pickup_lng is None:
        raise HTTPException(
            status_code=409,
            detail={"type": "tow_pickup_location_missing"},
        )
    return TowPendingDispatch(
        id=attempt.id,
        case_id=case.id,
        attempt_id=attempt.id,
        customer_name=customer.full_name or "Müşteri",
        pickup_label=tow_case.pickup_address or "Alınacak konum",
        pickup_lat_lng=LatLng(lat=tow_case.pickup_lat, lng=tow_case.pickup_lng),
        dropoff_label=tow_case.dropoff_address,
        dropoff_lat_lng=(
            LatLng(lat=tow_case.dropoff_lat, lng=tow_case.dropoff_lng)
            if tow_case.dropoff_lat is not None and tow_case.dropoff_lng is not None
            else None
        ),
        technician_lat_lng=_profile_location(profile),
        distance_km=attempt.distance_km or Decimal("0"),
        eta_minutes=attempt.eta_minutes or 0,
        price_amount=Decimal(str(cap_amount)),
        equipment_label=equipment_label,
        received_at=attempt.sent_at,
        expires_at=attempt.sent_at
        + timedelta(seconds=settings.tow_accept_window_seconds),
    )


async def _build_snapshot(db: AsyncSession, case: ServiceCase) -> TowCaseSnapshot:
    tow_case = await db.get(TowCase, case.id)
    if tow_case is None:
        raise HTTPException(status_code=404, detail="tow subtype not found")
    settlement = await tow_repo.get_settlement_by_case(db, case.id)
    stage_schema = TowDispatchStageSchema(tow_case.tow_stage.value)
    return TowCaseSnapshot(
        id=case.id,
        created_at=case.created_at,
        updated_at=case.updated_at,
        mode=TowModeSchema(tow_case.tow_mode.value),
        stage=stage_schema,
        stage_label=tow_stage_label(stage_schema),
        tow_phase=tow_phase(stage_schema),
        status=case.status.value,
        parent_case_id=tow_case.parent_case_id,
        pickup_lat_lng=(
            LatLng(lat=tow_case.pickup_lat, lng=tow_case.pickup_lng)
            if tow_case.pickup_lat is not None and tow_case.pickup_lng is not None
            else None
        ),
        pickup_label=tow_case.pickup_address,
        dropoff_lat_lng=(
            LatLng(lat=tow_case.dropoff_lat, lng=tow_case.dropoff_lng)
            if tow_case.dropoff_lat is not None and tow_case.dropoff_lng is not None
            else None
        ),
        dropoff_label=tow_case.dropoff_address,
        incident_reason=tow_case.incident_reason,
        required_equipment=tow_case.tow_required_equipment or [],
        scheduled_at=tow_case.scheduled_at,
        fare_quote=(
            TowFareQuote(**tow_case.tow_fare_quote)
            if tow_case.tow_fare_quote
            else None
        ),
        assigned_technician_id=case.assigned_technician_id,
        settlement_status=(
            TowSettlementStatusSchema(settlement.state.value)
            if settlement
            else TowSettlementStatusSchema.NONE
        ),
        final_amount=settlement.final_amount if settlement else None,
        cancellation_fee=None,
    )

