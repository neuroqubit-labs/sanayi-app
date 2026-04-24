from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status

from app.api.v1.deps import CurrentUserDep, CustomerDep, DbDep, RedisDep
from app.core.config import get_settings
from app.integrations.maps import get_maps
from app.integrations.psp.mock import build_mock_psp
from app.models.case import (
    CaseOrigin,
    ServiceCase,
    ServiceCaseStatus,
    ServiceRequestKind,
    ServiceRequestUrgency,
    TowDispatchStage,
    TowMode,
)
from app.models.vehicle import Vehicle
from app.schemas.tow import (
    LatLng,
    TowCaseSnapshot,
    TowCreateCaseRequest,
    TowFareQuote,
    TowFareQuoteRequest,
    TowFareQuoteResponse,
)
from app.services import tow_dispatch as dispatch_svc
from app.services import tow_payment as payment_svc

from ._subtypes import _insert_tow_subtype_row

router = APIRouter()


@router.post(
    "/fare/quote",
    response_model=TowFareQuoteResponse,
    summary="Fare quote — cap/locked price hesap",
)
async def quote_fare(
    payload: TowFareQuoteRequest,
    _user: CurrentUserDep,
) -> TowFareQuoteResponse:
    settings = get_settings()
    maps = get_maps()
    pickup = (payload.pickup_lat_lng.lat, payload.pickup_lat_lng.lng)
    dropoff = (
        (payload.dropoff_lat_lng.lat, payload.dropoff_lat_lng.lng)
        if payload.dropoff_lat_lng
        else pickup
    )
    route_distance = await maps.route_distance(pickup, dropoff)
    distance_km = Decimal(str(route_distance.distance_km)).quantize(Decimal("0.01"))
    base = Decimal(settings.tow_quote_base_amount)
    per_km = Decimal(settings.tow_quote_per_km_rate)
    urgency = (
        Decimal(settings.tow_quote_urgency_surcharge) if payload.urgency_bump else Decimal("0")
    )
    buffer = Decimal(str(settings.tow_quote_buffer_pct))
    cap = dispatch_svc.compute_cap_amount(
        distance_km=distance_km,
        base_amount=base,
        per_km=per_km,
        urgency_surcharge=urgency,
        buffer_pct=buffer,
    )
    quote = TowFareQuote(
        mode=payload.mode,
        base_amount=base,
        distance_km=distance_km,
        per_km_rate=per_km,
        urgency_surcharge=urgency,
        buffer_pct=buffer,
        cap_amount=cap,
        locked_price=None,
        currency="TRY",
    )
    return TowFareQuoteResponse(
        quote=quote,
        pickup_address=None,
        dropoff_address=None,
        distance_km=distance_km,
        duration_minutes=route_distance.duration_minutes,
        distance_source=route_distance.source,
        route_coords=(
            [LatLng(lat=lat, lng=lng) for lat, lng in route_distance.route_coords]
            if route_distance.route_coords
            else None
        ),
        expires_at=datetime.now(UTC).replace(microsecond=0),
    )


# ─── 2. Create tow case ─────────────────────────────────────────────────────


@router.post(
    "/cases",
    status_code=status.HTTP_201_CREATED,
    summary="Çekici talebi oluştur + (immediate) ilk aday atama",
)
async def create_case(
    payload: TowCreateCaseRequest,
    user: CustomerDep,
    db: DbDep,
    redis: RedisDep,
    response: Response,
) -> dict[str, object]:
    vehicle = await db.get(Vehicle, payload.vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="vehicle not found")

    # Faz 2: parent case validation — accident/breakdown kind olmalı + aynı
    # müşteriye ait + soft delete değil.
    if payload.parent_case_id is not None:
        parent = await db.get(ServiceCase, payload.parent_case_id)
        if (
            parent is None
            or parent.deleted_at is not None
            or parent.customer_user_id != user.id
            or parent.kind not in (ServiceRequestKind.ACCIDENT, ServiceRequestKind.BREAKDOWN)
        ):
            raise HTTPException(
                status_code=400,
                detail={
                    "type": "invalid_parent_case",
                    "message": "parent_case must be owned accident/breakdown case",
                },
            )

    tow_mode = TowMode(payload.mode.value)
    initial_stage = (
        TowDispatchStage.SEARCHING
        if tow_mode == TowMode.IMMEDIATE
        else TowDispatchStage.SCHEDULED_WAITING
    )
    urgency = (
        ServiceRequestUrgency.URGENT
        if tow_mode == TowMode.IMMEDIATE
        else ServiceRequestUrgency.PLANNED
    )
    case = ServiceCase(
        vehicle_id=payload.vehicle_id,
        customer_user_id=user.id,
        kind=ServiceRequestKind.TOWING,
        urgency=urgency,
        status=ServiceCaseStatus.MATCHING,
        origin=CaseOrigin.CUSTOMER,
        title=f"{tow_mode.value.capitalize()} çekici talebi",
        workflow_blueprint="towing_immediate"
        if tow_mode == TowMode.IMMEDIATE
        else "towing_scheduled",
        request_draft=payload.model_dump(mode="json"),
    )
    db.add(case)
    await db.flush()

    # Faz 1 canonical case architecture: TowCase subtype tek kaynak
    # (service_cases.tow_* migration 0032 ile DROP edildi).
    tow_case = await _insert_tow_subtype_row(db, case, payload)

    result: dict[str, object] = {"case_id": str(case.id), "stage": initial_stage.value}

    if tow_mode == TowMode.IMMEDIATE:
        # P0-3 fix: immediate tow create → preauth gate ZORUNLU.
        # Settlement oluşturulmadan dispatch başlamaz.
        # V1 MockPsp (stored card yok, Iyzico 3DS async — Faz C'de subaccount
        # tokenization ile gerçek Iyzico preauth).
        try:
            await payment_svc.authorize_preauth(
                db,
                case=case,
                cap_amount=payload.fare_quote.cap_amount,
                quoted_amount=(payload.fare_quote.locked_price or payload.fare_quote.cap_amount),
                customer_token="",  # V1 mock default — B-4 stored card yok
                psp=build_mock_psp(),
            )
        except payment_svc.PaymentDeclinedError as exc:
            # 402 Payment Required — settlement yok, dispatch başlamaz
            await db.rollback()
            raise HTTPException(
                status_code=402,
                detail={
                    "type": "preauth_declined",
                    "error_code": exc.error_code,
                    "message": str(exc),
                },
            ) from exc

        try:
            decision = await dispatch_svc.initiate_dispatch(db, case, tow_case, redis=redis)
            result["first_attempt"] = {
                "attempt_id": str(decision.attempt_id),
                "technician_id": str(decision.technician_id),
                "distance_km": str(decision.distance_km),
                "eta_minutes": decision.eta_minutes,
                "radius_km": decision.radius_km,
            }
        except dispatch_svc.NoCandidateFoundError:
            await dispatch_svc._transition_to_pool_offered(db, case, tow_case, user.id)
            result["stage"] = TowDispatchStage.TIMEOUT_CONVERTED_TO_POOL.value

    await db.commit()
    response.headers["Location"] = f"/tow/cases/{case.id}"
    return result


# ─── 3. Snapshot ────────────────────────────────────────────────────────────


@router.get(
    "/cases/{case_id}",
    response_model=TowCaseSnapshot,
    summary="Vaka snapshot",
)
async def get_case(
    case_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
) -> TowCaseSnapshot:
    case = await db.get(ServiceCase, case_id)
    if case is None or case.kind != ServiceRequestKind.TOWING:
        raise HTTPException(status_code=404, detail="tow case not found")
