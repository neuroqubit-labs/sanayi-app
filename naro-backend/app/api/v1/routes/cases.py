"""Müşteri vaka oluşturma + listeleme + cancel endpoint'leri (brief §2.2).

- POST   /cases                (müşteri: create)
- GET    /cases/{id}           (participant: detay)
- GET    /cases/me             (müşteri: açık vakalar)
- POST   /cases/{id}/cancel    (müşteri/admin: iptal)

Draft endpoint'leri (POST/GET/DELETE /cases/drafts/*) ayrı brief kapsamında.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict

from app.api.v1.deps import CurrentUserDep, CustomerDep, DbDep
from app.models.case import (
    ServiceCase,
    ServiceCaseStatus,
    ServiceRequestKind,
)
from app.models.case_audit import CaseEventType, CaseTone
from app.models.user import UserRole
from app.repositories import case as case_repo
from app.schemas.service_request import ServiceRequestDraftCreate
from app.services import case_create
from app.services.case_events import append_event

router = APIRouter(prefix="/cases", tags=["cases"])


# ─── Response models ────────────────────────────────────────────────────────


class CaseCreateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: ServiceCaseStatus
    kind: ServiceRequestKind
    workflow_blueprint: str
    created_at: datetime
    title: str


class CaseSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: ServiceRequestKind
    status: ServiceCaseStatus
    urgency: str
    title: str
    summary: str | None = None
    location_label: str | None = None
    created_at: datetime
    updated_at: datetime


# ─── Endpoints ──────────────────────────────────────────────────────────────


@router.post(
    "",
    response_model=CaseCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yeni vaka oluştur (müşteri)",
)
async def create_case_endpoint(
    draft: ServiceRequestDraftCreate,
    user: CustomerDep,
    db: DbDep,
) -> CaseCreateResponse:
    try:
        result = await case_create.create_case(db, user_id=user.id, draft=draft)
    except case_create.CaseCreateError as exc:
        detail: dict[str, object] = {
            "type": exc.error_type,
            "message": str(exc),
        }
        if isinstance(exc, case_create.MissingRequiredAttachmentsError):
            detail["missing"] = sorted(exc.missing)
        if isinstance(exc, case_create.DuplicateOpenCaseError):
            detail["existing_case_id"] = str(exc.existing_case_id)
            detail["kind"] = exc.kind
        raise HTTPException(status_code=exc.http_status, detail=detail) from exc

    await db.commit()
    case = result.case
    return CaseCreateResponse(
        id=case.id,
        status=case.status,
        kind=case.kind,
        workflow_blueprint=case.workflow_blueprint,
        created_at=case.created_at,
        title=case.title,
    )


@router.get(
    "/me",
    response_model=list[CaseSummaryResponse],
    summary="Müşterinin vakaları",
)
async def list_my_cases(
    user: CustomerDep,
    db: DbDep,
) -> list[CaseSummaryResponse]:
    cases = await case_repo.list_cases_for_customer(db, user.id)
    return [CaseSummaryResponse.model_validate(c) for c in cases]


@router.get(
    "/{case_id}",
    response_model=CaseSummaryResponse,
    summary="Vaka detay (participant-only)",
)
async def get_case_endpoint(
    case_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
) -> CaseSummaryResponse:
    case = await case_repo.get_case(db, case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(status_code=404, detail={"type": "case_not_found"})
    _assert_participant(case, user_id=user.id, role=user.role)
    return CaseSummaryResponse.model_validate(case)


@router.post(
    "/{case_id}/cancel",
    response_model=CaseSummaryResponse,
    summary="Vaka iptal (müşteri/admin)",
)
async def cancel_case_endpoint(
    case_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
) -> CaseSummaryResponse:
    case = await case_repo.get_case(db, case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(status_code=404, detail={"type": "case_not_found"})
    # Sadece müşteri kendi vakasını veya admin iptal edebilir
    if case.customer_user_id != user.id and user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail={"type": "not_case_owner"}
        )
    if case.status in (
        ServiceCaseStatus.COMPLETED,
        ServiceCaseStatus.CANCELLED,
        ServiceCaseStatus.ARCHIVED,
    ):
        raise HTTPException(
            status_code=409,
            detail={
                "type": "case_closed",
                "message": f"case already {case.status.value}",
            },
        )
    case.status = ServiceCaseStatus.CANCELLED
    case.closed_at = datetime.now(UTC)
    await append_event(
        db,
        case_id=case.id,
        event_type=CaseEventType.CANCELLED,
        title="Vaka iptal edildi",
        tone=CaseTone.WARNING,
        actor_user_id=user.id,
    )
    await db.commit()
    return CaseSummaryResponse.model_validate(case)


# ─── Helpers ────────────────────────────────────────────────────────────────


def _assert_participant(case: ServiceCase, *, user_id: UUID, role: UserRole) -> None:
    if role == UserRole.ADMIN:
        return
    participant_ids = {case.customer_user_id, case.assigned_technician_id}
    if user_id not in participant_ids:
        raise HTTPException(
            status_code=403, detail={"type": "not_case_participant"}
        )
