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

from app.api.v1.deps import (
    CurrentCustomerDep,
    CurrentTechnicianDep,
    CurrentUserDep,
    DbDep,
)
from app.models.case import ServiceCase
from app.models.case_process import (
    CaseApproval,
    CaseApprovalKind,
    CaseApprovalLineItem,
    CaseApprovalStatus,
)
from app.models.user import UserRole
from app.services import approval_flow

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


class ApprovalDecidePayload(BaseModel):
    """Customer approve / reject kararı."""

    model_config = ConfigDict(extra="forbid")

    decision: Literal["approve", "reject"]
    note: str | None = Field(default=None, max_length=1000)


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
    line_items: list[ApprovalLineItemOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


# ─── Helpers ───────────────────────────────────────────────────────────────


async def _load_case_or_404(db: DbDep, case_id: UUID) -> ServiceCase:
    case = await db.get(ServiceCase, case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(
            status_code=404, detail={"type": "case_not_found"}
        )
    return case


async def _load_line_items(
    db: DbDep, approval_id: UUID
) -> list[CaseApprovalLineItem]:
    stmt = (
        select(CaseApprovalLineItem)
        .where(CaseApprovalLineItem.approval_id == approval_id)
        .order_by(CaseApprovalLineItem.sequence)
    )
    return list((await db.execute(stmt)).scalars().all())


async def _build_response(
    db: DbDep, approval: CaseApproval
) -> ApprovalResponse:
    items = await _load_line_items(db, approval.id)
    return ApprovalResponse.model_validate(
        {
            **{c.name: getattr(approval, c.name) for c in approval.__table__.columns},
            "line_items": [
                ApprovalLineItemOut.model_validate(it) for it in items
            ],
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
        raise HTTPException(
            status_code=403, detail={"type": "not_assigned_technician"}
        )

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
            raise HTTPException(
                status_code=403, detail={"type": "not_case_participant"}
            )
    stmt = (
        select(CaseApproval)
        .where(CaseApproval.case_id == case_id)
        .order_by(CaseApproval.requested_at.asc())
    )
    approvals = list((await db.execute(stmt)).scalars().all())
    return [await _build_response(db, a) for a in approvals]


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
        raise HTTPException(
            status_code=403, detail={"type": "not_case_owner"}
        )
    approval = await db.get(CaseApproval, approval_id)
    if approval is None or approval.case_id != case_id:
        raise HTTPException(
            status_code=404, detail={"type": "approval_not_found"}
        )

    try:
        if payload.decision == "approve":
            decided = await approval_flow.approve(
                db, approval_id, actor_user_id=user.id
            )
        else:
            decided = await approval_flow.reject(
                db, approval_id, actor_user_id=user.id
            )
    except approval_flow.ApprovalNotPendingError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "type": "approval_not_pending",
                "current_status": approval.status.value,
            },
        ) from exc
    except approval_flow.ApprovalNotFoundError as exc:
        raise HTTPException(
            status_code=404, detail={"type": "approval_not_found"}
        ) from exc
    except approval_flow.CompletionGateError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "type": "completion_gate_unmet",
                "missing": exc.missing,
            },
        ) from exc

    await db.commit()
    return await _build_response(db, decided)
