"""/reviews router — 3 endpoint.

- POST /reviews                       (customer: case.status=completed sonrası)
- GET  /reviews/technician/{id}       (any auth: public list, reviewer masked)
- GET  /reviews/me                    (any auth: role'e göre reviewer/reviewee)

Kurallar:
- Reviewer = case.customer_user_id (V1 tek yön); reviewee = case.assigned_
  technician_id server-side derive — client enjekte edemez.
- UNIQUE (case_id, reviewer_user_id) DB-enforce; IntegrityError → 409.
- case.status != COMPLETED → 422 case_not_completed.
- PII mask (I-9): public listing reviewer_user_id yok, sadece initials.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.api.pagination import (
    CursorQuery,
    LimitQuery,
    PaginatedResponse,
    build_paginated,
    decode_cursor,
    encode_cursor,
)
from app.api.v1.deps import CurrentUserDep, CustomerDep, DbDep
from app.models.case import ServiceCaseStatus
from app.models.user import User, UserRole
from app.repositories import case as case_repo
from app.repositories import review as review_repo
from app.schemas.review import (
    ReviewCreate,
    ReviewResponse,
    TechnicianReviewItem,
    mask_reviewer_name,
)

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post(
    "",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Vaka sonrası usta puanla (customer)",
)
async def create_review_endpoint(
    payload: ReviewCreate,
    user: CustomerDep,
    db: DbDep,
) -> ReviewResponse:
    case = await case_repo.get_case(db, payload.case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(
            status_code=404, detail={"type": "case_not_found"}
        )
    if case.customer_user_id != user.id:
        raise HTTPException(
            status_code=403, detail={"type": "not_case_customer"}
        )
    if case.status != ServiceCaseStatus.COMPLETED:
        raise HTTPException(
            status_code=422, detail={"type": "case_not_completed"}
        )
    if case.assigned_technician_id is None:
        raise HTTPException(
            status_code=422, detail={"type": "case_has_no_technician"}
        )
    try:
        review = await review_repo.create_review(
            db,
            case_id=payload.case_id,
            reviewer_user_id=user.id,
            reviewee_user_id=case.assigned_technician_id,
            rating=payload.rating,
            body=payload.body,
        )
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=409, detail={"type": "review_already_exists"}
        ) from exc
    await db.refresh(review)
    return ReviewResponse.model_validate(review)


@router.get(
    "/technician/{technician_id}",
    response_model=PaginatedResponse[TechnicianReviewItem],
    summary="Teknisyen public review listesi (reviewer masked)",
)
async def list_reviews_for_technician(
    technician_id: UUID,
    _user: CurrentUserDep,
    db: DbDep,
    cursor: CursorQuery = None,
    limit: LimitQuery = 20,
) -> PaginatedResponse[TechnicianReviewItem]:
    cursor_data = decode_cursor(cursor)
    before_created_at: str | None = None
    before_id: UUID | None = None
    if cursor_data is not None:
        sort_val = cursor_data.get("sort")
        id_val = cursor_data.get("id")
        if isinstance(sort_val, str) and isinstance(id_val, str):
            before_created_at = sort_val
            before_id = UUID(id_val)
    reviews = await review_repo.list_for_technician(
        db,
        technician_id,
        limit=limit + 1,
        before_created_at=before_created_at,
        before_id=before_id,
    )
    # Reviewer name lookup (batch) — PII mask
    reviewer_ids = {r.reviewer_user_id for r in reviews}
    name_map: dict[UUID, str | None] = {}
    for rid in reviewer_ids:
        reviewer = await db.get(User, rid)
        name_map[rid] = reviewer.full_name if reviewer else None
    items = [
        TechnicianReviewItem(
            id=r.id,
            rating=r.rating,
            body=r.body,
            reviewer_masked_name=mask_reviewer_name(name_map.get(r.reviewer_user_id)),
            response_body=r.response_body,
            responded_at=r.responded_at,
            created_at=r.created_at,
        )
        for r in reviews
    ]
    return build_paginated(
        items,
        limit=limit,
        cursor_fn=lambda item: encode_cursor(
            id_=item.id, sort_value=item.created_at
        ),
    )


@router.get(
    "/me",
    response_model=list[ReviewResponse],
    summary="Kendi review'lerim (customer: yazdıklarım / tech: aldıklarım)",
)
async def list_my_reviews(
    user: CurrentUserDep,
    db: DbDep,
) -> list[ReviewResponse]:
    if user.role == UserRole.TECHNICIAN:
        reviews = await review_repo.list_reviews_for_reviewee(db, user.id)
    else:
        reviews = await review_repo.list_reviews_by_reviewer(db, user.id)
    return [ReviewResponse.model_validate(r) for r in reviews]
