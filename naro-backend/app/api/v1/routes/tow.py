"""Faz 10 — Tow dispatch REST endpoint'leri.

14 endpoint: quote, create case, snapshot, tracking, dispatch response,
location ingest, evidence, OTP issue/verify, cancel, kasko, rating, scheduled bids.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.api.v1.deps import (
    CurrentUserDep,
    CustomerDep,
    DbDep,
    PspDep,
    RedisDep,
    TowTechnicianDep,
)
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
    TowEquipment,
    TowIncidentReason,
    TowMode,
)
from app.models.tow import (
    TowCancellationActor,
    TowDispatchResponse,
    TowOtpDelivery,
    TowOtpPurpose,
    TowOtpRecipient,
)
from app.models.user import User
from app.models.vehicle import Vehicle
from app.repositories import tow as tow_repo
from app.schemas.tow import (
    TowCancelInput,
    TowCaseSnapshot,
    TowCreateCaseRequest,
    TowDispatchResponseInput,
    TowDispatchResponseOutput,
    TowDispatchStageSchema,
    TowFareQuote,
    TowFareQuoteRequest,
    TowFareQuoteResponse,
    TowKaskoDeclareInput,
    TowLocationInput,
    TowModeSchema,
    TowOtpIssueInput,
    TowOtpVerifyInput,
    TowRatingInput,
    TowSettlementStatusSchema,
    TowTrackingSnapshot,
)
from app.services import tow_dispatch as dispatch_svc
from app.services import tow_evidence as evidence_svc
from app.services import tow_lifecycle as lifecycle_svc
from app.services import tow_location as location_svc
from app.services import tow_payment as payment_svc

router = APIRouter(prefix="/tow", tags=["tow"])


# ─── 1. Fare quote (public-ish, requires auth) ──────────────────────────────


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
    distance_km = Decimal(str(await maps.distance_km(pickup, dropoff))).quantize(
        Decimal("0.01")
    )
    base = Decimal(settings.tow_quote_base_amount)
    per_km = Decimal(settings.tow_quote_per_km_rate)
    urgency = Decimal(settings.tow_quote_urgency_surcharge) if payload.urgency_bump else Decimal("0")
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
    response: Response,
) -> dict[str, object]:
    vehicle = await db.get(Vehicle, payload.vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="vehicle not found")

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
        tow_mode=tow_mode,
        tow_stage=initial_stage,
        tow_required_equipment=[
            TowEquipment(e.value) for e in payload.required_equipment
        ] or None,
        incident_reason=TowIncidentReason(payload.incident_reason.value),
        scheduled_at=payload.scheduled_at,
        pickup_lat=payload.pickup_lat_lng.lat,
        pickup_lng=payload.pickup_lat_lng.lng,
        pickup_address=payload.pickup_label,
        dropoff_lat=payload.dropoff_lat_lng.lat if payload.dropoff_lat_lng else None,
        dropoff_lng=payload.dropoff_lat_lng.lng if payload.dropoff_lat_lng else None,
        dropoff_address=payload.dropoff_label,
        tow_fare_quote=payload.fare_quote.model_dump(mode="json"),
    )
    db.add(case)
    await db.flush()

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
                quoted_amount=(
                    payload.fare_quote.locked_price
                    or payload.fare_quote.cap_amount
                ),
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
            decision = await dispatch_svc.initiate_dispatch(db, case)
            result["first_attempt"] = {
                "attempt_id": str(decision.attempt_id),
                "technician_id": str(decision.technician_id),
                "distance_km": str(decision.distance_km),
                "eta_minutes": decision.eta_minutes,
                "radius_km": decision.radius_km,
            }
        except dispatch_svc.NoCandidateFoundError:
            await dispatch_svc._transition_to_pool_offered(db, case, user.id)
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
    _ensure_participant(case, user)
    settlement = await tow_repo.get_settlement_by_case(db, case.id)
    from app.schemas.tow import LatLng

    return TowCaseSnapshot(
        id=case.id,
        created_at=case.created_at,
        updated_at=case.updated_at,
        mode=TowModeSchema(case.tow_mode.value) if case.tow_mode else TowModeSchema.IMMEDIATE,
        stage=TowDispatchStageSchema(case.tow_stage.value) if case.tow_stage else TowDispatchStageSchema.SEARCHING,
        status=case.status.value,
        pickup_lat_lng=LatLng(lat=case.pickup_lat, lng=case.pickup_lng) if case.pickup_lat is not None and case.pickup_lng is not None else None,
        pickup_label=case.pickup_address,
        dropoff_lat_lng=LatLng(lat=case.dropoff_lat, lng=case.dropoff_lng) if case.dropoff_lat is not None and case.dropoff_lng is not None else None,
        dropoff_label=case.dropoff_address,
        incident_reason=case.incident_reason,
        required_equipment=case.tow_required_equipment or [],
        scheduled_at=case.scheduled_at,
        fare_quote=TowFareQuote(**case.tow_fare_quote) if case.tow_fare_quote else None,
        assigned_technician_id=case.assigned_technician_id,
        settlement_status=TowSettlementStatusSchema(settlement.state.value) if settlement else TowSettlementStatusSchema.NONE,
        final_amount=settlement.final_amount if settlement else None,
        cancellation_fee=None,
    )


# ─── 4. Tracking (WS fallback polling) ──────────────────────────────────────


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
        stage=TowDispatchStageSchema(case.tow_stage.value) if case.tow_stage else TowDispatchStageSchema.SEARCHING,
        technician_id=case.assigned_technician_id,
        last_location=last_location,
        last_location_at=last_location_at,
        eta_minutes=None,
        updated_at=case.updated_at,
    )


# ─── 5. Dispatch response (technician) ──────────────────────────────────────


@router.post(
    "/cases/{case_id}/dispatch/response",
    response_model=TowDispatchResponseOutput,
    summary="Teknisyen accept/decline attempt",
)
async def respond_dispatch(
    case_id: UUID,
    payload: TowDispatchResponseInput,
    tech: TowTechnicianDep,
    db: DbDep,
) -> TowDispatchResponseOutput:
    case = await db.get(ServiceCase, case_id)
    if case is None or case.kind != ServiceRequestKind.TOWING:
        raise HTTPException(status_code=404, detail="tow case not found")
    attempt = await db.get(
        __import__("app.models.tow", fromlist=["TowDispatchAttempt"]).TowDispatchAttempt,
        payload.attempt_id,
    )
    if attempt is None or attempt.case_id != case_id or attempt.technician_id != tech.id:
        raise HTTPException(status_code=404, detail="attempt not found for this technician")

    response = (
        TowDispatchResponse.ACCEPTED
        if payload.response == "accepted"
        else TowDispatchResponse.DECLINED
    )
    await dispatch_svc.record_dispatch_response(
        db,
        case=case,
        attempt_id=payload.attempt_id,
        response=response,
        actor_user_id=tech.id,
        rejection_reason=payload.rejection_reason,
    )
    await db.commit()
    next_stage = (
        TowDispatchStageSchema(case.tow_stage.value)
        if case.tow_stage is not None
        else None
    )
    from app.schemas.tow import TowDispatchResponseSchema

    return TowDispatchResponseOutput(
        attempt_id=payload.attempt_id,
        response=TowDispatchResponseSchema(response.value),
        next_stage=next_stage,
    )


# ─── 6. Location ping ───────────────────────────────────────────────────────


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
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ─── 7. OTP issue ───────────────────────────────────────────────────────────


@router.post(
    "/cases/{case_id}/otp/issue",
    summary="Arrival/delivery OTP ver (teknisyen tarafı)",
)
async def issue_otp(
    case_id: UUID,
    payload: TowOtpIssueInput,
    tech: TowTechnicianDep,
    db: DbDep,
    redis: RedisDep,
) -> dict[str, object]:
    case = await db.get(ServiceCase, case_id)
    if case is None or case.assigned_technician_id != tech.id:
        raise HTTPException(status_code=404, detail="not assigned")
    issued = await evidence_svc.issue_otp(
        db,
        redis=redis,
        case_id=case.id,
        purpose=TowOtpPurpose(payload.purpose),
        recipient=TowOtpRecipient(payload.recipient),
        delivered_via=TowOtpDelivery.SMS,
        issued_by_user_id=tech.id,
    )
    await db.commit()
    return {
        "otp_id": str(issued.otp_id),
        "expires_at": issued.expires_at_iso,
        # Code returned only in-response for dev; V1.1 SMS delivery only
        "code": issued.code,
    }


# ─── 8. OTP verify ──────────────────────────────────────────────────────────


@router.post(
    "/cases/{case_id}/otp/verify",
    summary="OTP doğrula",
)
async def verify_otp(
    case_id: UUID,
    payload: TowOtpVerifyInput,
    _user: CurrentUserDep,
    db: DbDep,
    redis: RedisDep,
) -> dict[str, object]:
    ok = await evidence_svc.verify_otp(
        db,
        redis=redis,
        case_id=case_id,
        purpose=TowOtpPurpose(payload.purpose),
        submitted_code=payload.code,
    )
    await db.commit()
    return {"verified": ok}


# ─── 9. Cancel ──────────────────────────────────────────────────────────────


@router.post(
    "/cases/{case_id}/cancel",
    summary="Vaka iptal (aşamaya göre fee)",
)
async def cancel(
    case_id: UUID,
    payload: TowCancelInput,
    user: CurrentUserDep,
    db: DbDep,
    psp: PspDep,
) -> dict[str, object]:
    case = await db.get(ServiceCase, case_id)
    if case is None or case.kind != ServiceRequestKind.TOWING:
        raise HTTPException(status_code=404, detail="tow case not found")
    _ensure_participant(case, user)
    actor = (
        TowCancellationActor.CUSTOMER
        if case.customer_user_id == user.id
        else TowCancellationActor.TECHNICIAN
    )
    # P0-1 fix: authoritative fee = lifecycle service return value (stage_at_cancel
    # bazında, yeniden hesaplama YOK). Route sadece refund PSP çağrısını orchestre eder.
    effective_fee = await lifecycle_svc.cancel_case(
        db,
        case=case,
        actor=actor,
        actor_user_id=user.id,
        reason_code=payload.reason_code,
        reason_note=payload.reason_note,
    )
    settlement = await tow_repo.get_settlement_by_case(db, case.id)
    if settlement is not None and settlement.preauth_id is not None:
        await payment_svc.refund_cancellation(
            db,
            settlement=settlement,
            fee_amount=effective_fee if effective_fee > 0 else Decimal("0"),
            psp=psp,
        )
    await db.commit()
    return {
        "cancelled": True,
        "case_id": str(case.id),
        "cancellation_fee": str(effective_fee),
    }


# ─── 10. Kasko declaration ──────────────────────────────────────────────────


@router.post(
    "/cases/{case_id}/kasko",
    summary="Kasko beyan — müşteri tarafı",
)
async def declare_kasko(
    case_id: UUID,
    payload: TowKaskoDeclareInput,
    user: CustomerDep,
    db: DbDep,
) -> dict[str, object]:
    case = await db.get(ServiceCase, case_id)
    if case is None or case.customer_user_id != user.id:
        raise HTTPException(status_code=404, detail="case not found")
    draft = dict(case.request_draft)
    draft["kasko"] = payload.declaration.model_dump(mode="json")
    case.request_draft = draft
    await db.commit()
    return {"case_id": str(case.id), "kasko": draft["kasko"]}


# ─── 11. Rating ─────────────────────────────────────────────────────────────


@router.post(
    "/cases/{case_id}/rating",
    summary="Müşteri puanı + review",
)
async def submit_rating(
    case_id: UUID,
    payload: TowRatingInput,
    user: CustomerDep,
    db: DbDep,
) -> dict[str, object]:
    case = await db.get(ServiceCase, case_id)
    if case is None or case.customer_user_id != user.id:
        raise HTTPException(status_code=404, detail="case not found")
    draft = dict(case.request_draft)
    draft["rating"] = {
        "score": payload.rating,
        "note": payload.review_note,
        "created_at": datetime.now(UTC).isoformat(),
    }
    case.request_draft = draft
    await db.commit()
    return {"case_id": str(case.id), "rating": payload.rating}


# ─── 12. Evidence register (stub — media linkage 10f) ──────────────────────


@router.post(
    "/cases/{case_id}/evidence",
    summary="Kanıt kaydı (fotoğraf link)",
)
async def add_evidence(
    case_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
    kind: str = Query(..., description="customer_pre_state | tech_arrival | tech_loading | tech_delivery"),
    media_asset_id: Annotated[UUID | None, Query()] = None,
) -> dict[str, object]:
    case = await db.get(ServiceCase, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")
    _ensure_participant(case, user)
    # V1 delegates to existing case_evidence_items table via Faz 7 evidence service
    return {"case_id": str(case.id), "kind": kind, "media_asset_id": str(media_asset_id) if media_asset_id else None}


# ─── 13. Scheduled bid submit ───────────────────────────────────────────────


@router.post(
    "/bids",
    summary="Scheduled tow bidding — teknisyen teklifi",
)
async def submit_bid(
    _payload: dict[str, object],
    _tech: TowTechnicianDep,
    _db: DbDep,
) -> dict[str, object]:
    # V1 stub — scheduled mode bidding case_offers tablosuna bağlanır (Faz 10f detay)
    return {"status": "pending", "message": "scheduled bidding wiring lands in 10f"}


# ─── 14. Bid accept ─────────────────────────────────────────────────────────


@router.post(
    "/bids/{bid_id}/accept",
    summary="Müşteri — locked_price bid kabul",
)
async def accept_bid(
    bid_id: UUID,
    _user: CustomerDep,
    _db: DbDep,
) -> dict[str, object]:
    return {"bid_id": str(bid_id), "status": "accepted", "message": "10f integration pending"}


# ─── helpers ────────────────────────────────────────────────────────────────


def _ensure_participant(case: ServiceCase, user: User) -> None:
    is_participant = user.id in {case.customer_user_id, case.assigned_technician_id}
    is_admin = user.role.value == "admin"
    if not is_participant and not is_admin:
        raise HTTPException(status_code=403, detail="not a case participant")
