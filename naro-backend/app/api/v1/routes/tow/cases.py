from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status

from app.api.v1.deps import CurrentUserDep, CustomerDep, DbDep, PspDep, RedisDep
from app.core.config import get_settings
from app.integrations.maps import get_maps
from app.models.case import (
    CaseOrigin,
    ServiceCase,
    ServiceCaseStatus,
    ServiceRequestKind,
    ServiceRequestUrgency,
    TowMode,
)
from app.models.case_subtypes import TowCase
from app.models.vehicle import Vehicle
from app.schemas.payment import PaymentInitiateResponse
from app.schemas.tow import (
    LatLng,
    TowCaseSnapshot,
    TowCreateCaseRequest,
    TowFareQuote,
    TowFareQuoteRequest,
    TowFareQuoteResponse,
)
from app.services import payment_core
from app.services import tow_dispatch as dispatch_svc

from ._guards import _ensure_participant
from ._presenters import _build_snapshot
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
        expires_at=datetime.now(UTC).replace(microsecond=0) + timedelta(minutes=5),
    )


# ─── 2. Create tow case ─────────────────────────────────────────────────────


@router.post(
    "/cases",
    status_code=status.HTTP_201_CREATED,
    summary="Çekici talebi oluştur + ödeme bekleyen gate",
)
async def create_case(
    payload: TowCreateCaseRequest,
    user: CustomerDep,
    db: DbDep,
    response: Response,
) -> TowCaseSnapshot:
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

    if tow_mode == TowMode.IMMEDIATE:
        try:
            await payment_core.ensure_tow_payment_required(
                db, case=case, tow_case=tow_case
            )
        except payment_core.PaymentCoreError as exc:
            await db.rollback()
            raise HTTPException(
                status_code=exc.http_status,
                detail={"type": exc.error_type, "message": str(exc)},
            ) from exc

    await db.commit()
    response.headers["Location"] = f"/tow/cases/{case.id}"
    snapshot = await _build_snapshot(db, case)
    return snapshot


@router.post(
    "/cases/{case_id}/payment/initiate",
    response_model=PaymentInitiateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Çekici ön provizyon checkout başlat",
)
async def initiate_tow_payment(
    case_id: UUID,
    user: CustomerDep,
    db: DbDep,
    psp: PspDep,
    redis: RedisDep,
) -> PaymentInitiateResponse:
    case = await db.get(ServiceCase, case_id)
    if case is None or case.kind != ServiceRequestKind.TOWING:
        raise HTTPException(status_code=404, detail={"type": "tow_case_not_found"})
    if case.customer_user_id != user.id:
        raise HTTPException(status_code=403, detail={"type": "not_case_owner"})
    tow_case = await db.get(TowCase, case_id)
    if tow_case is None:
        raise HTTPException(status_code=404, detail={"type": "tow_subtype_not_found"})
    try:
        result = await payment_core.initiate_tow_preauth(
            db,
            case=case,
            tow_case=tow_case,
            psp=psp,
            callback_url=get_settings().iyzico_callback_url,
            redis=redis,
        )
    except payment_core.PaymentCoreError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=exc.http_status,
            detail={"type": exc.error_type, "message": str(exc)},
        ) from exc
    await db.commit()
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
    _ensure_participant(case, user)
    return await _build_snapshot(db, case)
