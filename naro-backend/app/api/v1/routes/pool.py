"""/pool router — havuz feed + detay (teknisyen, admission-gated).

- GET /pool/feed — havuz case listesi, kind filter (KIND_PROVIDER_MAP) +
  cursor pagination; customer PII mask.
- GET /pool/case/{id} — tek case detay önizleme; customer PII mask.

Admission gate V1 quick-check (PR 5 /technicians/public/feed ile mirror):
users.status='active' + approval_status='active' + technician_profile
aktif + TechnicianServiceDomain + TechnicianServiceArea EXISTS. Fail → 403.

Teklif verirken /cases/{id}'ye düşer (participant detail, tam PII).
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import exists, select

from app.api.pagination import (
    CursorQuery,
    LimitQuery,
    PaginatedResponse,
    build_paginated,
    decode_cursor,
    encode_cursor,
)
from app.api.v1.deps import DbDep, TechnicianDep
from app.models.technician import TechnicianAvailability, TechnicianProfile
from app.models.technician_signal import (
    TechnicianServiceArea,
    TechnicianServiceDomain,
)
from app.models.user import User, UserApprovalStatus, UserStatus
from app.repositories import case as case_repo
from app.schemas.pool import PoolCaseDetail, PoolCaseItem
from app.schemas.review import mask_reviewer_name

router = APIRouter(prefix="/pool", tags=["pool"])


async def _assert_admission(db: DbDep, user: User) -> TechnicianProfile:
    """V1 quick-check — pool feed için teknisyen hazırlığı doğrular.

    Cached flag yok (Faz 13 sonrası); query-time 5 koşul.
    TechnicianDep zaten role=technician garantisi verdi.
    """
    if (
        user.status != UserStatus.ACTIVE
        or user.approval_status != UserApprovalStatus.ACTIVE
    ):
        raise HTTPException(
            status_code=403, detail={"type": "admission_not_passed"}
        )
    profile_stmt = select(TechnicianProfile).where(
        TechnicianProfile.user_id == user.id,
        TechnicianProfile.deleted_at.is_(None),
    )
    profile = (await db.execute(profile_stmt)).scalar_one_or_none()
    if profile is None or profile.availability == TechnicianAvailability.OFFLINE:
        raise HTTPException(
            status_code=403, detail={"type": "admission_not_passed"}
        )
    has_domain_stmt = select(
        exists().where(TechnicianServiceDomain.profile_id == profile.id)
    )
    has_area_stmt = select(
        exists().where(TechnicianServiceArea.profile_id == profile.id)
    )
    if not (await db.execute(has_domain_stmt)).scalar():
        raise HTTPException(
            status_code=403, detail={"type": "admission_not_passed"}
        )
    if not (await db.execute(has_area_stmt)).scalar():
        raise HTTPException(
            status_code=403, detail={"type": "admission_not_passed"}
        )
    return profile


@router.get(
    "/feed",
    response_model=PaginatedResponse[PoolCaseItem],
    summary="Havuz case feed (teknisyen, kind filter + cursor)",
)
async def get_pool_feed(
    user: TechnicianDep,
    db: DbDep,
    cursor: CursorQuery = None,
    limit: LimitQuery = 20,
) -> PaginatedResponse[PoolCaseItem]:
    profile = await _assert_admission(db, user)
    cursor_data = decode_cursor(cursor)
    before_created_at: datetime | None = None
    before_id: UUID | None = None
    if cursor_data is not None:
        sort_val = cursor_data.get("sort")
        id_val = cursor_data.get("id")
        if isinstance(sort_val, str) and isinstance(id_val, str):
            before_created_at = datetime.fromisoformat(sort_val)
            before_id = UUID(id_val)
    rows = await case_repo.list_pool_cases(
        db,
        profile.provider_type,
        limit=limit + 1,
        before_created_at=before_created_at,
        before_id=before_id,
    )
    return build_paginated(
        [PoolCaseItem.model_validate(c) for c in rows],
        limit=limit,
        cursor_fn=lambda item: encode_cursor(
            id_=item.id, sort_value=item.created_at
        ),
    )


@router.get(
    "/case/{case_id}",
    response_model=PoolCaseDetail,
    summary="Havuz case detay önizleme (customer PII-masked)",
)
async def get_pool_case(
    case_id: UUID,
    user: TechnicianDep,
    db: DbDep,
) -> PoolCaseDetail:
    await _assert_admission(db, user)
    case = await case_repo.get_case(db, case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(
            status_code=404, detail={"type": "case_not_found"}
        )
    if case.status not in case_repo.POOL_VISIBLE_STATUSES:
        raise HTTPException(
            status_code=404, detail={"type": "case_not_in_pool"}
        )
    # Customer full_name → initials mask
    customer = await db.get(User, case.customer_user_id)
    masked = mask_reviewer_name(customer.full_name if customer else None)
    return PoolCaseDetail(
        id=case.id,
        kind=case.kind,
        urgency=case.urgency,
        status=case.status,
        title=case.title,
        subtitle=case.subtitle,
        summary=case.summary,
        location_label=case.location_label,
        customer_masked_name=masked,
        vehicle_id=case.vehicle_id,
        created_at=case.created_at,
        updated_at=case.updated_at,
        estimate_amount=case.estimate_amount,
    )
