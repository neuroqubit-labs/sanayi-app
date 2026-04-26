from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.api.v1.deps import CurrentUserDep, CustomerDep, DbDep, PspDep
from app.models.case import ServiceCase, ServiceRequestKind
from app.models.case_subtypes import TowCase
from app.models.tow import TowCancellationActor
from app.repositories import tow as tow_repo
from app.schemas.tow import TowCancelInput, TowKaskoDeclareInput, TowRatingInput
from app.services import tow_lifecycle as lifecycle_svc
from app.services import tow_payment as payment_svc

from ._guards import _ensure_participant

router = APIRouter()


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
