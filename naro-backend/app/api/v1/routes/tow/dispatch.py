from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.api.v1.deps import DbDep, PspDep, RedisDep, TowTechnicianDep
from app.core.config import get_settings
from app.models.case import ServiceCase, ServiceRequestKind, TowDispatchStage
from app.models.case_subtypes import TowCase
from app.models.tow import TowDispatchResponse
from app.repositories import tow as tow_repo
from app.schemas.tow import (
    TowCaseSnapshot,
    TowDispatchResponseInput,
    TowDispatchResponseOutput,
    TowDispatchStageSchema,
    TowStageTransitionInput,
)
from app.services import tow_dispatch as dispatch_svc
from app.services import tow_lifecycle as lifecycle_svc
from app.services import tow_payment as payment_svc

from ._guards import _ensure_stage_prerequisites
from ._presenters import _build_snapshot

router = APIRouter()


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
    redis: RedisDep,
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
        redis=redis,
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
