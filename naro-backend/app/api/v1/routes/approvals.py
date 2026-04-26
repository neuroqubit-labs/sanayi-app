"""/cases/{case_id}/approvals router — parts_request / invoice / completion
onay akışı. FE B2.2 PartsApprovalSheet + B2.3 InvoiceApprovalSheet
endpoint'leri. Launch blocker (UC-3 Süreç + UC-4 Ödeme).

Endpoint matrisi:
- POST   /cases/{case_id}/approvals                           (technician: request)
- GET    /cases/{case_id}/approvals                           (participant: list)
- POST   /cases/{case_id}/approvals/{approval_id}/decide      (customer: approve/reject)

Service layer (approval_flow.py) zaten ship edilmiş; bu router HTTP
katmanı + schema + auth gate + line_items wiring.

Billing bridge (PARTS_REQUEST approve → case_billing.handle_parts_approval /
INVOICE approve → handle_invoice_approval) approval service içinde
transition_case_status sonrası tetiklenmeli — şimdilik audit event
yeter; FE wire-up sonrası Faz C'de PSP capture/authorize tetiklenecek.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.v1.deps import (
    CurrentCustomerDep,
    CurrentTechnicianDep,
    CurrentUserDep,
    DbDep,
)
from app.api.v1.routes.billing import _get_psp
from app.core.config import get_settings
from app.models.case import ServiceCase
from app.models.case_process import (
    CaseApproval,
    CaseApprovalKind,
    CaseApprovalLineItem,
    CaseApprovalPaymentMethod,
    CaseApprovalPaymentState,
    CaseApprovalStatus,
)
from app.models.review import Review
from app.models.user import UserRole
from app.repositories import review as review_repo
from app.schemas.payment import PaymentInitiateResponse
from app.services import approval_flow, case_public_showcases, payment_core

router = APIRouter(prefix="/cases", tags=["approvals"])


# ─── Pydantic schemas ──────────────────────────────────────────────────────


class ApprovalLineItemInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str = Field(min_length=1, max_length=255)
    value: str = Field(min_length=1, max_length=255)
    note: str | None = Field(default=None, max_length=1000)


class ApprovalLineItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    label: str
    value: str
    note: str | None
    sequence: int


class ApprovalRequestPayload(BaseModel):
    """Usta parts_request / invoice / completion onay talebi açar."""

    model_config = ConfigDict(extra="forbid")

    kind: CaseApprovalKind
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    amount: Decimal | None = Field(default=None, ge=0)
    currency: str = Field(default="TRY", min_length=3, max_length=8)
    service_comment: str | None = Field(default=None, max_length=2000)
    line_items: list[ApprovalLineItemInput] = Field(default_factory=list)
    delivery_report: dict[str, object] | None = None
    public_showcase_consent: bool = False
    public_showcase_media_ids: list[UUID] = Field(default_factory=list)


class ApprovalDecidePayload(BaseModel):
    """Customer approve / reject kararı."""

    model_config = ConfigDict(extra="forbid")

    decision: Literal["approve", "reject"]
    note: str | None = Field(default=None, max_length=1000)
    rating: int | None = Field(default=None, ge=1, le=5)
    review_body: str | None = Field(default=None, max_length=2000)
    public_showcase_consent: bool = False
    payment_method: CaseApprovalPaymentMethod | None = None


class ApprovalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    case_id: UUID
    kind: CaseApprovalKind
    status: CaseApprovalStatus
    title: str
    description: str | None
    requested_by_user_id: UUID | None
    requested_by_snapshot_name: str | None
    requested_at: datetime
    responded_at: datetime | None
    amount: Decimal | None
    currency: str
    service_comment: str | None
    payment_method: CaseApprovalPaymentMethod | None = None
    payment_state: CaseApprovalPaymentState
    payment_order_id: UUID | None = None
    available_payment_methods: list[CaseApprovalPaymentMethod] = Field(default_factory=list)
    line_items: list[ApprovalLineItemOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


# ─── Helpers ───────────────────────────────────────────────────────────────


async def _load_case_or_404(db: DbDep, case_id: UUID) -> ServiceCase:
    case = await db.get(ServiceCase, case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(status_code=404, detail={"type": "case_not_found"})
    return case


async def _load_line_items(db: DbDep, approval_id: UUID) -> list[CaseApprovalLineItem]:
    stmt = (
        select(CaseApprovalLineItem)
        .where(CaseApprovalLineItem.approval_id == approval_id)
        .order_by(CaseApprovalLineItem.sequence)
    )
    return list((await db.execute(stmt)).scalars().all())


async def _build_response(db: DbDep, approval: CaseApproval) -> ApprovalResponse:
    items = await _load_line_items(db, approval.id)
    available_payment_methods: list[CaseApprovalPaymentMethod] = []
    if (
        approval.kind in (CaseApprovalKind.PARTS_REQUEST, CaseApprovalKind.INVOICE)
        and approval.amount is not None
        and approval.amount > 0
    ):
        available_payment_methods = [
            CaseApprovalPaymentMethod.ONLINE,
            CaseApprovalPaymentMethod.SERVICE_CARD,
            CaseApprovalPaymentMethod.CASH,
        ]
    return ApprovalResponse.model_validate(
        {
            **{c.name: getattr(approval, c.name) for c in approval.__table__.columns},
            "line_items": [ApprovalLineItemOut.model_validate(it) for it in items],
            "available_payment_methods": available_payment_methods,
        }
    )


# ─── Endpoints ─────────────────────────────────────────────────────────────


@router.post(
    "/{case_id}/approvals",
    response_model=ApprovalResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Usta onay talebi aç (parts_request / invoice / completion)",
)
async def request_approval_endpoint(
    case_id: UUID,
    payload: ApprovalRequestPayload,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> ApprovalResponse:
    case = await _load_case_or_404(db, case_id)
    if case.assigned_technician_id != user.id:
        raise HTTPException(status_code=403, detail={"type": "not_assigned_technician"})
    if (
        payload.kind in (CaseApprovalKind.PARTS_REQUEST, CaseApprovalKind.INVOICE)
        and not (payload.description or "").strip()
    ):
        raise HTTPException(
            status_code=422,
            detail={"type": "approval_description_required"},
        )

    try:
        approval = await approval_flow.request_approval(
            db,
            case_id=case_id,
            kind=payload.kind,
            title=payload.title,
            description=payload.description,
            requested_by_user_id=user.id,
            requested_by_snapshot_name=user.full_name,
            amount=payload.amount,
            currency=payload.currency,
            service_comment=payload.service_comment,
            line_items=[it.model_dump() for it in payload.line_items],
        )
        if (
            payload.kind in (CaseApprovalKind.PARTS_REQUEST, CaseApprovalKind.INVOICE)
            and payload.amount is not None
            and payload.amount > 0
        ):
            approval.payment_state = CaseApprovalPaymentState.REQUIRED
        if payload.kind == CaseApprovalKind.COMPLETION:
            line_items = await _load_line_items(db, approval.id)
            await case_public_showcases.upsert_from_completion_request(
                db,
                case=case,
                approval=approval,
                line_items=line_items,
                technician_consented=payload.public_showcase_consent,
                media_ids=payload.public_showcase_media_ids,
            )
    except approval_flow.ApprovalAlreadyActiveError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail={
                "type": "approval_already_active",
                "kind": exc.kind.value,
            },
        ) from exc
    await db.commit()
    return await _build_response(db, approval)


@router.get(
    "/{case_id}/approvals",
    response_model=list[ApprovalResponse],
    summary="Case approval listesi (participant: customer + assigned tech + admin)",
)
async def list_approvals_endpoint(
    case_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
) -> list[ApprovalResponse]:
    case = await _load_case_or_404(db, case_id)
    if user.role != UserRole.ADMIN:
        participant_ids = {case.customer_user_id, case.assigned_technician_id}
        if user.id not in participant_ids:
            raise HTTPException(status_code=403, detail={"type": "not_case_participant"})
    stmt = (
        select(CaseApproval)
        .where(CaseApproval.case_id == case_id)
        .order_by(CaseApproval.requested_at.asc())
    )
    approvals = list((await db.execute(stmt)).scalars().all())
    return [await _build_response(db, a) for a in approvals]


@router.post(
    "/{case_id}/approvals/{approval_id}/payment/initiate",
    response_model=PaymentInitiateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Approval online ödeme başlat — parts_request / invoice",
)
async def initiate_approval_payment_endpoint(
    case_id: UUID,
    approval_id: UUID,
    user: CurrentCustomerDep,
    db: DbDep,
) -> PaymentInitiateResponse:
    case = await _load_case_or_404(db, case_id)
    if case.customer_user_id != user.id:
        raise HTTPException(status_code=403, detail={"type": "not_case_owner"})
    approval = await db.get(CaseApproval, approval_id)
    if approval is None or approval.case_id != case_id:
        raise HTTPException(status_code=404, detail={"type": "approval_not_found"})

    psp, _provider = _get_psp()
    try:
        response = await payment_core.initiate_case_approval_capture(
            db,
            case=case,
            approval=approval,
            psp=psp,
            callback_url=get_settings().iyzico_callback_url,
        )
    except payment_core.PaymentCoreError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=exc.http_status,
            detail={"type": exc.error_type, "message": str(exc)},
        ) from exc
    await db.commit()
    return response


@router.post(
    "/{case_id}/approvals/{approval_id}/decide",
    response_model=ApprovalResponse,
    summary="Customer decide — approve/reject (parts_request / invoice / completion)",
)
async def decide_approval_endpoint(
    case_id: UUID,
    approval_id: UUID,
    payload: ApprovalDecidePayload,
    user: CurrentCustomerDep,
    db: DbDep,
) -> ApprovalResponse:
    """Pilot'ta note ignore (V1.1 store + analytics)."""
    _ = payload.note  # V1: ignore; V1.1 analytics için saklanır
    case = await _load_case_or_404(db, case_id)
    if case.customer_user_id != user.id:
        raise HTTPException(status_code=403, detail={"type": "not_case_owner"})
    approval = await db.get(CaseApproval, approval_id)
    if approval is None or approval.case_id != case_id:
        raise HTTPException(status_code=404, detail={"type": "approval_not_found"})
    if (
        payload.decision == "approve"
        and approval.kind == CaseApprovalKind.COMPLETION
        and payload.rating is None
    ):
        raise HTTPException(
            status_code=422,
            detail={"type": "completion_rating_required"},
        )
    if (
        payload.decision == "approve"
        and approval.kind == CaseApprovalKind.COMPLETION
        and case.assigned_technician_id is None
    ):
        raise HTTPException(
            status_code=422,
            detail={"type": "case_has_no_technician"},
        )
    payment_required = (
        approval.kind in (CaseApprovalKind.PARTS_REQUEST, CaseApprovalKind.INVOICE)
        and approval.amount is not None
        and approval.amount > 0
    )
    if payload.decision == "approve" and payment_required:
        if payload.payment_method is None:
            raise HTTPException(
                status_code=422,
                detail={"type": "approval_payment_method_required"},
            )
        if payload.payment_method == CaseApprovalPaymentMethod.ONLINE:
            raise HTTPException(
                status_code=409,
                detail={"type": "approval_online_payment_required"},
            )

    try:
        if payload.decision == "approve":
            if payment_required and payload.payment_method is not None:
                approval.payment_method = payload.payment_method
                approval.payment_state = CaseApprovalPaymentState.OFFLINE_RECORDED
            decided = await approval_flow.approve(db, approval_id, actor_user_id=user.id)
            if (
                decided.kind == CaseApprovalKind.INVOICE
                and decided.payment_state == CaseApprovalPaymentState.OFFLINE_RECORDED
            ):
                case.billing_state = "settled"
                case.total_amount = decided.amount
            if decided.kind == CaseApprovalKind.COMPLETION:
                existing_review = (
                    await db.execute(
                        select(Review).where(
                            Review.case_id == case_id,
                            Review.reviewer_user_id == user.id,
                        )
                    )
                ).scalar_one_or_none()
                review = existing_review
                if review is None:
                    review = await review_repo.create_review(
                        db,
                        case_id=case_id,
                        reviewer_user_id=user.id,
                        reviewee_user_id=case.assigned_technician_id,
                        rating=payload.rating or 1,
                        body=payload.review_body,
                    )
                line_items = await _load_line_items(db, decided.id)
                await case_public_showcases.apply_customer_completion_decision(
                    db,
                    case=case,
                    approval=decided,
                    line_items=line_items,
                    customer_consented=payload.public_showcase_consent,
                    rating=review.rating,
                    review_body=review.body,
                    review_id=review.id,
                )
        else:
            decided = await approval_flow.reject(db, approval_id, actor_user_id=user.id)
    except approval_flow.ApprovalNotPendingError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "type": "approval_not_pending",
                "current_status": approval.status.value,
            },
        ) from exc
    except approval_flow.ApprovalNotFoundError as exc:
        raise HTTPException(status_code=404, detail={"type": "approval_not_found"}) from exc
    except approval_flow.CompletionGateError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "type": "completion_gate_unmet",
                "missing": exc.missing,
            },
        ) from exc
    except IntegrityError as exc:
        await db.rollback()
        if "uq_reviews_case_reviewer" in str(exc.orig):
            raise HTTPException(
                status_code=409,
                detail={"type": "review_already_exists"},
            ) from exc
        raise

    await db.commit()
    return await _build_response(db, decided)
