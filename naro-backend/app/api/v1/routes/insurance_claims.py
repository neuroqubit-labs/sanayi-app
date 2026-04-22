"""/insurance-claims + /admin/insurance-claims routers — 6 endpoint.

Customer:
- POST   /insurance-claims                    (case owner: submit)
- GET    /insurance-claims/case/{case_id}     (participant or admin: list)
- GET    /insurance-claims/{id}               (claim owner or admin: detail)

Admin:
- PATCH  /admin/insurance-claims/{id}/accept     (admin: submit→accept)
- PATCH  /admin/insurance-claims/{id}/reject     (admin: submitted/accepted→reject)
- PATCH  /admin/insurance-claims/{id}/mark-paid  (admin: accepted→paid)

Business logic + audit event emit service'te (insurance_claim_flow.py).
Router katmanı: load + IDOR guard + service delegation + exception mapping.
Brief: docs/backend-rest-api-faz-a-brief.md §8 + §11.3.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.api.v1.deps import AdminDep, CurrentUserDep, CustomerDep, DbDep
from app.models.case import ServiceCase, ServiceRequestKind
from app.models.user import UserRole
from app.repositories import case as case_repo
from app.repositories import insurance_claim as claim_repo
from app.schemas.insurance_claim import (
    InsuranceClaimAcceptRequest,
    InsuranceClaimPayOutRequest,
    InsuranceClaimRejectRequest,
    InsuranceClaimResponse,
    InsuranceClaimSubmit,
)
from app.services import insurance_claim_flow as claim_flow

customer_router = APIRouter(
    prefix="/insurance-claims", tags=["insurance-claims"]
)
admin_router = APIRouter(
    prefix="/admin/insurance-claims", tags=["insurance-claims-admin"]
)


# ─── IDOR helpers ──────────────────────────────────────────────────────────


async def _load_case_or_404(db: DbDep, case_id: UUID) -> ServiceCase:
    case = await case_repo.get_case(db, case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(
            status_code=404, detail={"type": "case_not_found"}
        )
    return case


def _assert_case_owner(case: ServiceCase, user_id: UUID) -> None:
    if case.customer_user_id != user_id:
        raise HTTPException(
            status_code=403, detail={"type": "not_case_owner"}
        )


def _assert_case_participant(
    case: ServiceCase, *, user_id: UUID, role: UserRole
) -> None:
    if role == UserRole.ADMIN:
        return
    participant_ids = {case.customer_user_id, case.assigned_technician_id}
    if user_id not in participant_ids:
        raise HTTPException(
            status_code=403, detail={"type": "not_case_participant"}
        )


# ─── Customer endpoints ───────────────────────────────────────────────────


@customer_router.post(
    "",
    response_model=InsuranceClaimResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Sigorta dosyası aç (case owner, case.kind='accident')",
)
async def submit_claim_endpoint(
    payload: InsuranceClaimSubmit,
    user: CustomerDep,
    db: DbDep,
) -> InsuranceClaimResponse:
    case = await _load_case_or_404(db, payload.case_id)
    _assert_case_owner(case, user.id)
    if case.kind != ServiceRequestKind.ACCIDENT:
        raise HTTPException(
            status_code=422, detail={"type": "case_kind_not_accident"}
        )
    try:
        claim = await claim_flow.submit_claim(
            db,
            case_id=payload.case_id,
            policy_number=payload.policy_number,
            insurer=payload.insurer,
            coverage_kind=payload.coverage_kind,
            estimate_amount=payload.estimate_amount,
            policy_holder_name=payload.policy_holder_name,
            policy_holder_phone=payload.policy_holder_phone,
            currency=payload.currency,
            notes=payload.notes,
            insurer_claim_reference=payload.insurer_claim_reference,
            created_by_user_id=user.id,
        )
    except claim_flow.ClaimAlreadyActiveError as exc:
        raise HTTPException(
            status_code=409, detail={"type": "claim_already_active"}
        ) from exc
    await db.commit()
    await db.refresh(claim)
    return InsuranceClaimResponse.model_validate(claim)


@customer_router.get(
    "/case/{case_id}",
    response_model=list[InsuranceClaimResponse],
    summary="Case'deki tüm claim'ler (participant or admin)",
)
async def list_claims_for_case_endpoint(
    case_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
) -> list[InsuranceClaimResponse]:
    case = await _load_case_or_404(db, case_id)
    _assert_case_participant(case, user_id=user.id, role=user.role)
    claims = await claim_repo.list_claims_for_case(db, case_id)
    return [InsuranceClaimResponse.model_validate(c) for c in claims]


@customer_router.get(
    "/{claim_id}",
    response_model=InsuranceClaimResponse,
    summary="Tek claim detay (claim owner or admin)",
)
async def get_claim_endpoint(
    claim_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
) -> InsuranceClaimResponse:
    claim = await claim_repo.get_claim(db, claim_id)
    if claim is None:
        raise HTTPException(
            status_code=404, detail={"type": "claim_not_found"}
        )
    case = await _load_case_or_404(db, claim.case_id)
    if user.role != UserRole.ADMIN and case.customer_user_id != user.id:
        raise HTTPException(
            status_code=403, detail={"type": "not_claim_owner"}
        )
    return InsuranceClaimResponse.model_validate(claim)


# ─── Admin moderation endpoints ───────────────────────────────────────────


def _map_transition_error(exc: Exception) -> HTTPException:
    if isinstance(exc, claim_flow.ClaimNotFoundError):
        return HTTPException(
            status_code=404, detail={"type": "claim_not_found"}
        )
    if isinstance(exc, claim_flow.InvalidClaimTransitionError):
        return HTTPException(
            status_code=422,
            detail={"type": "invalid_claim_transition", "message": str(exc)},
        )
    raise exc


@admin_router.patch(
    "/{claim_id}/accept",
    response_model=InsuranceClaimResponse,
    summary="Sigortacı onayı kaydet (admin, submitted→accepted)",
)
async def admin_accept_claim(
    claim_id: UUID,
    payload: InsuranceClaimAcceptRequest,
    admin: AdminDep,
    db: DbDep,
) -> InsuranceClaimResponse:
    try:
        claim = await claim_flow.accept_claim(
            db,
            claim_id,
            accepted_amount=payload.accepted_amount,
            insurer_claim_reference=payload.insurer_claim_reference,
            actor_user_id=admin.id,
        )
    except (
        claim_flow.ClaimNotFoundError,
        claim_flow.InvalidClaimTransitionError,
    ) as exc:
        raise _map_transition_error(exc) from exc
    await db.commit()
    await db.refresh(claim)
    return InsuranceClaimResponse.model_validate(claim)


@admin_router.patch(
    "/{claim_id}/reject",
    response_model=InsuranceClaimResponse,
    summary="Sigorta dosyası reddet (admin, submitted|accepted→rejected)",
)
async def admin_reject_claim(
    claim_id: UUID,
    payload: InsuranceClaimRejectRequest,
    admin: AdminDep,
    db: DbDep,
) -> InsuranceClaimResponse:
    try:
        claim = await claim_flow.reject_claim(
            db,
            claim_id,
            reason=payload.reason,
            actor_user_id=admin.id,
        )
    except (
        claim_flow.ClaimNotFoundError,
        claim_flow.InvalidClaimTransitionError,
    ) as exc:
        raise _map_transition_error(exc) from exc
    await db.commit()
    await db.refresh(claim)
    return InsuranceClaimResponse.model_validate(claim)


@admin_router.patch(
    "/{claim_id}/mark-paid",
    response_model=InsuranceClaimResponse,
    summary="Ödeme kaydet (admin, accepted→paid)",
)
async def admin_mark_paid(
    claim_id: UUID,
    payload: InsuranceClaimPayOutRequest,
    admin: AdminDep,
    db: DbDep,
) -> InsuranceClaimResponse:
    try:
        claim = await claim_flow.mark_paid(
            db,
            claim_id,
            paid_amount=payload.paid_amount,
            actor_user_id=admin.id,
        )
    except (
        claim_flow.ClaimNotFoundError,
        claim_flow.InvalidClaimTransitionError,
    ) as exc:
        raise _map_transition_error(exc) from exc
    except ValueError as exc:
        # mark_paid: paid_amount None + accepted_amount None
        raise HTTPException(
            status_code=422,
            detail={"type": "paid_amount_required", "message": str(exc)},
        ) from exc
    await db.commit()
    await db.refresh(claim)
    return InsuranceClaimResponse.model_validate(claim)
