"""Faz 10 — Tow dispatch REST endpoint'leri.

14 endpoint: quote, create case, snapshot, tracking, dispatch response,
location ingest, evidence, OTP issue/verify, cancel, kasko, rating, scheduled bids.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

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
    TowMode,
)
from app.models.case_artifact import CaseAttachmentKind
from app.models.case_subtypes import TowCase
from app.models.media import MediaAsset, MediaStatus
from app.models.technician import TechnicianAvailability, TechnicianProfile
from app.models.tow import (
    TowCancellationActor,
    TowDispatchAttempt,
    TowDispatchResponse,
    TowOtpDelivery,
    TowOtpEvent,
    TowOtpPurpose,
    TowOtpRecipient,
    TowOtpVerifyResult,
)
from app.models.user import User
from app.models.vehicle import Vehicle
from app.repositories import technician as technician_repo
from app.repositories import tow as tow_repo
from app.schemas.tow import (
    LatLng,
    TowAvailabilityInput,
    TowAvailabilityOutput,
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
    TowPendingDispatch,
    TowRatingInput,
    TowSettlementStatusSchema,
    TowStageTransitionInput,
    TowTrackingSnapshot,
    tow_phase,
    tow_stage_label,
)
from app.services import tow_dispatch as dispatch_svc
from app.services import tow_evidence as evidence_svc
from app.services import evidence as case_evidence_svc
from app.services import tow_lifecycle as lifecycle_svc
from app.services import tow_location as location_svc
from app.services import tow_payment as payment_svc
from app.services.case_create import build_vehicle_snapshot

router = APIRouter(prefix="/tow", tags=["tow"])


# ─── 0. Technician live tow shell ──────────────────────────────────────────


@router.post(
    "/technicians/me/availability",
    response_model=TowAvailabilityOutput,
    summary="Çekici canlı uygunluk + son konum heartbeat",
)
async def set_tow_availability(
    payload: TowAvailabilityInput,
    tech: TowTechnicianDep,
    db: DbDep,
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

    # Faz 2: parent case validation — accident/breakdown kind olmalı + aynı
    # müşteriye ait + soft delete değil.
    if payload.parent_case_id is not None:
        parent = await db.get(ServiceCase, payload.parent_case_id)
        if (
            parent is None
            or parent.deleted_at is not None
            or parent.customer_user_id != user.id
            or parent.kind
            not in (ServiceRequestKind.ACCIDENT, ServiceRequestKind.BREAKDOWN)
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
            decision = await dispatch_svc.initiate_dispatch(db, case, tow_case)
            result["first_attempt"] = {
                "attempt_id": str(decision.attempt_id),
                "technician_id": str(decision.technician_id),
                "distance_km": str(decision.distance_km),
                "eta_minutes": decision.eta_minutes,
                "radius_km": decision.radius_km,
            }
        except dispatch_svc.NoCandidateFoundError:
            await dispatch_svc._transition_to_pool_offered(
                db, case, tow_case, user.id
            )
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
    return await _build_snapshot(db, case)


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
    tow_case = await db.get(TowCase, case.id)
    if tow_case is None:
        raise HTTPException(status_code=404, detail="tow subtype not found")
    attempt = await db.get(
        __import__("app.models.tow", fromlist=["TowDispatchAttempt"]).TowDispatchAttempt,
        payload.attempt_id,
    )
    if attempt is None or attempt.case_id != case_id or attempt.technician_id != tech.id:
        raise HTTPException(status_code=404, detail="attempt not found for this technician")
    if attempt.response != TowDispatchResponse.PENDING:
        raise HTTPException(
            status_code=409,
            detail={
                "type": "dispatch_attempt_already_answered",
                "response": attempt.response.value,
            },
        )
    expires_at = attempt.sent_at + timedelta(
        seconds=get_settings().tow_accept_window_seconds
    )
    if datetime.now(UTC) > expires_at:
        raise HTTPException(
            status_code=409,
            detail={
                "type": "dispatch_attempt_expired",
                "expires_at": expires_at.isoformat(),
            },
        )

    response = (
        TowDispatchResponse.ACCEPTED
        if payload.response == "accepted"
        else TowDispatchResponse.DECLINED
    )
    await dispatch_svc.record_dispatch_response(
        db,
        case=case,
        tow_case=tow_case,
        attempt_id=payload.attempt_id,
        response=response,
        actor_user_id=tech.id,
        rejection_reason=payload.rejection_reason,
    )
    await db.commit()
    next_stage = TowDispatchStageSchema(tow_case.tow_stage.value)
    from app.schemas.tow import TowDispatchResponseSchema

    return TowDispatchResponseOutput(
        attempt_id=payload.attempt_id,
        response=TowDispatchResponseSchema(response.value),
        next_stage=next_stage,
    )


@router.post(
    "/cases/{case_id}/stage",
    response_model=TowCaseSnapshot,
    summary="Teknisyen çekici stage geçişi",
)
async def transition_tow_stage(
    case_id: UUID,
    payload: TowStageTransitionInput,
    tech: TowTechnicianDep,
    db: DbDep,
    psp: PspDep,
) -> TowCaseSnapshot:
    case = await db.get(ServiceCase, case_id)
    if (
        case is None
        or case.kind != ServiceRequestKind.TOWING
        or case.assigned_technician_id != tech.id
    ):
        raise HTTPException(status_code=404, detail="tow case not assigned")
    tow_case = await db.get(TowCase, case.id)
    if tow_case is None:
        raise HTTPException(status_code=404, detail="tow subtype not found")

    target = TowDispatchStage(payload.stage)
    await _ensure_stage_prerequisites(db, case.id, target)

    try:
        await lifecycle_svc.transition_stage(
            db,
            case=case,
            tow_case=tow_case,
            to_stage=target,
            actor_user_id=tech.id,
        )
    except lifecycle_svc.InvalidStageTransitionError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "type": "invalid_tow_stage_transition",
                "message": str(exc),
                "current_stage": tow_case.tow_stage.value,
                "target_stage": target.value,
            },
        ) from exc
    except lifecycle_svc.EvidenceGateUnmetError as exc:
        raise HTTPException(
            status_code=422,
            detail={"type": "tow_evidence_required", "missing": exc.missing},
        ) from exc

    if target == TowDispatchStage.DELIVERED:
        settlement = await tow_repo.get_settlement_by_case(db, case.id)
        if settlement is not None and settlement.preauth_id is not None:
            amount = (
                settlement.quoted_amount
                or settlement.cap_amount
                or Decimal("0")
            )
            await payment_svc.capture_final(
                db,
                case=case,
                actual_amount=amount,
                psp=psp,
                actor_user_id=tech.id,
            )

    await db.commit()
    return await _build_snapshot(db, case)


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
    user: CurrentUserDep,
    db: DbDep,
    redis: RedisDep,
) -> dict[str, object]:
    case = await db.get(ServiceCase, case_id)
    if case is None or case.kind != ServiceRequestKind.TOWING:
        raise HTTPException(status_code=404, detail="tow case not found")
    _ensure_participant(case, user)

    try:
        ok = await evidence_svc.verify_otp(
            db,
            redis=redis,
            case_id=case_id,
            purpose=TowOtpPurpose(payload.purpose),
            submitted_code=payload.code,
        )
    except (
        evidence_svc.OtpExpiredError,
        evidence_svc.OtpInvalidError,
        evidence_svc.OtpMaxAttemptsError,
        evidence_svc.OtpAlreadyVerifiedError,
    ) as exc:
        raise HTTPException(
            status_code=422,
            detail={"type": "tow_otp_invalid", "message": str(exc)},
        ) from exc
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
    tow_case = await db.get(TowCase, case.id)
    if tow_case is None:
        raise HTTPException(status_code=404, detail="tow subtype not found")
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
        tow_case=tow_case,
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
    if kind not in {
        "customer_pre_state",
        "tech_arrival",
        "tech_loading",
        "tech_delivery",
    }:
        raise HTTPException(
            status_code=422,
            detail={"type": "invalid_tow_evidence_kind", "kind": kind},
        )
    if kind.startswith("tech_") and case.assigned_technician_id != user.id:
        raise HTTPException(status_code=403, detail="technician evidence requires assignment")
    if media_asset_id is None:
        raise HTTPException(
            status_code=422,
            detail={"type": "tow_evidence_media_required", "kind": kind},
        )

    asset = await db.get(MediaAsset, media_asset_id)
    if asset is None or asset.deleted_at is not None:
        raise HTTPException(status_code=404, detail={"type": "media_asset_not_found"})
    if asset.uploaded_by_user_id != user.id:
        raise HTTPException(status_code=403, detail={"type": "media_asset_not_owned"})
    if asset.status not in {
        MediaStatus.PROCESSING,
        MediaStatus.READY,
        MediaStatus.UPLOADED,
    }:
        raise HTTPException(
            status_code=422,
            detail={
                "type": "media_asset_not_ready",
                "status": asset.status.value,
            },
        )
    if asset.linked_case_id is not None and asset.linked_case_id != case.id:
        raise HTTPException(
            status_code=409,
            detail={"type": "media_asset_already_linked"},
        )
    asset.linked_case_id = case.id

    labels = {
        "customer_pre_state": "Araç ilk durum fotoğrafı",
        "tech_arrival": "Çekici varış fotoğrafı",
        "tech_loading": "Yükleme fotoğrafı",
        "tech_delivery": "Teslim fotoğrafı",
    }
    evidence = await case_evidence_svc.add_evidence_to_case(
        db,
        case_id=case.id,
        title=labels[kind],
        kind=CaseAttachmentKind.PHOTO,
        actor="technician" if kind.startswith("tech_") else "customer",
        source_label=f"tow:{kind}",
        status_label="Yüklendi",
        media_asset_id=media_asset_id,
    )
    await db.commit()
    return {
        "id": str(evidence.id),
        "case_id": str(case.id),
        "kind": kind,
        "media_asset_id": str(media_asset_id) if media_asset_id else None,
        "created_at": evidence.created_at.isoformat() if evidence.created_at else None,
    }


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


async def _get_tow_profile_for_user(
    db: AsyncSession, user_id: UUID
) -> TechnicianProfile:
    profile = (
        await db.execute(
            select(TechnicianProfile).where(TechnicianProfile.user_id == user_id)
        )
    ).scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=404, detail="technician profile not found")
    return profile


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


async def _ensure_stage_prerequisites(
    db: AsyncSession, case_id: UUID, target: TowDispatchStage
) -> None:
    if target == TowDispatchStage.LOADING:
        await _ensure_otp_verified(db, case_id, TowOtpPurpose.ARRIVAL)
    if target == TowDispatchStage.DELIVERED:
        await _ensure_otp_verified(db, case_id, TowOtpPurpose.DELIVERY)


async def _ensure_otp_verified(
    db: AsyncSession, case_id: UUID, purpose: TowOtpPurpose
) -> None:
    stmt = (
        select(TowOtpEvent.id)
        .where(
            and_(
                TowOtpEvent.case_id == case_id,
                TowOtpEvent.purpose == purpose,
                TowOtpEvent.verify_result == TowOtpVerifyResult.SUCCESS,
            )
        )
        .limit(1)
    )
    found = (await db.execute(stmt)).scalar_one_or_none()
    if found is None:
        raise HTTPException(
            status_code=422,
            detail={
                "type": "tow_otp_required",
                "purpose": purpose.value,
            },
        )


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
    from app.models.case import TowIncidentReason

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
