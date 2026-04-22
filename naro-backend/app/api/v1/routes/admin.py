"""/admin/* router (Faz A PR 9) — 11 endpoint.

Tüm mutation'lar `app/services/admin_actions.py` üzerinden (AuthEvent +
Prometheus counter otomatik). Router katmanı HTTP shape + AdminDep gate.

Section'lar:
- Technician approval (4)
- Certificate review (3)
- Case override (1)
- User suspension (2)
- Audit log (1)

Brief: docs/backend-rest-api-faz-a-brief.md §11. Insurance claims admin
endpoint'leri ayrı dosyada (insurance_claims.py admin_router).
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import and_, select

from app.api.pagination import (
    CursorQuery,
    LimitQuery,
    PaginatedResponse,
    build_paginated,
    decode_cursor,
    encode_cursor,
)
from app.api.v1.deps import AdminDep, DbDep
from app.api.v1.routes.cases import CaseSummaryResponse
from app.models.auth_event import AuthEvent, AuthEventType
from app.models.technician import (
    TechnicianCertificate,
    TechnicianCertificateStatus,
    TechnicianProfile,
)
from app.models.user import User, UserApprovalStatus, UserRole
from app.schemas.admin import (
    AdminAuditItem,
    CaseOverrideRequest,
    CertificatePendingItem,
    CertificateRejectRequest,
    TechnicianApproveRequest,
    TechnicianPendingItem,
    TechnicianRejectRequest,
    TechnicianSuspendRequest,
    UserAdminView,
    UserSuspendRequest,
)
from app.services import admin_actions

router = APIRouter(prefix="/admin", tags=["admin"])


# ─── Technician approval ──────────────────────────────────────────────────


@router.get(
    "/technicians",
    response_model=PaginatedResponse[TechnicianPendingItem],
    summary="Admin teknisyen kuyruğu (status filter + cursor)",
)
async def list_admin_technicians(
    admin: AdminDep,
    db: DbDep,
    status_filter: Annotated[
        UserApprovalStatus, Query(alias="status")
    ] = UserApprovalStatus.PENDING,
    cursor: CursorQuery = None,
    limit: LimitQuery = 20,
) -> PaginatedResponse[TechnicianPendingItem]:
    _ = admin
    cursor_data = decode_cursor(cursor)
    conds = [
        User.role == UserRole.TECHNICIAN,
        User.approval_status == status_filter,
        User.deleted_at.is_(None),
    ]
    if cursor_data is not None:
        last_sort = cursor_data.get("sort")
        last_id = cursor_data.get("id")
        if isinstance(last_sort, str) and isinstance(last_id, str):
            last_dt = datetime.fromisoformat(last_sort)
            conds.append(
                (User.created_at < last_dt)
                | ((User.created_at == last_dt) & (User.id > UUID(last_id)))
            )
    stmt = (
        select(User, TechnicianProfile)
        .outerjoin(TechnicianProfile, TechnicianProfile.user_id == User.id)
        .where(and_(*conds))
        .order_by(User.created_at.desc(), User.id.asc())
        .limit(limit + 1)
    )
    rows = list((await db.execute(stmt)).all())
    items = [
        TechnicianPendingItem(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            phone=user.phone,
            approval_status=user.approval_status,
            provider_type=profile.provider_type if profile is not None else None,
            verified_level=profile.verified_level if profile is not None else None,
            created_at=user.created_at,
        )
        for (user, profile) in rows
    ]
    return build_paginated(
        items,
        limit=limit,
        cursor_fn=lambda item: encode_cursor(
            id_=item.id, sort_value=item.created_at
        ),
    )


@router.post(
    "/technicians/{technician_id}/approve",
    response_model=UserAdminView,
    summary="Teknisyen onayla (approval_status=ACTIVE)",
)
async def approve_technician_endpoint(
    technician_id: UUID,
    payload: TechnicianApproveRequest,
    admin: AdminDep,
    db: DbDep,
) -> UserAdminView:
    try:
        user = await admin_actions.approve_technician(
            db,
            target_user_id=technician_id,
            admin_user_id=admin.id,
            note=payload.note,
        )
    except admin_actions.TargetNotFoundError as exc:
        raise HTTPException(
            status_code=404, detail={"type": "technician_not_found"}
        ) from exc
    await db.commit()
    await db.refresh(user)
    return UserAdminView.model_validate(user)


@router.post(
    "/technicians/{technician_id}/reject",
    response_model=UserAdminView,
    summary="Teknisyen reddet (approval_status=REJECTED)",
)
async def reject_technician_endpoint(
    technician_id: UUID,
    payload: TechnicianRejectRequest,
    admin: AdminDep,
    db: DbDep,
) -> UserAdminView:
    try:
        user = await admin_actions.reject_technician(
            db,
            target_user_id=technician_id,
            admin_user_id=admin.id,
            reason=payload.reason,
        )
    except admin_actions.TargetNotFoundError as exc:
        raise HTTPException(
            status_code=404, detail={"type": "technician_not_found"}
        ) from exc
    await db.commit()
    await db.refresh(user)
    return UserAdminView.model_validate(user)


@router.post(
    "/technicians/{technician_id}/suspend",
    response_model=UserAdminView,
    summary="Teknisyen KYC askıya al (approval_status=SUSPENDED)",
)
async def suspend_technician_endpoint(
    technician_id: UUID,
    payload: TechnicianSuspendRequest,
    admin: AdminDep,
    db: DbDep,
) -> UserAdminView:
    try:
        user = await admin_actions.suspend_technician(
            db,
            target_user_id=technician_id,
            admin_user_id=admin.id,
            reason=payload.reason,
            until=payload.until,
        )
    except admin_actions.TargetNotFoundError as exc:
        raise HTTPException(
            status_code=404, detail={"type": "technician_not_found"}
        ) from exc
    await db.commit()
    await db.refresh(user)
    return UserAdminView.model_validate(user)


# ─── Certificate review ──────────────────────────────────────────────────


@router.get(
    "/certificates",
    response_model=PaginatedResponse[CertificatePendingItem],
    summary="Admin sertifika kuyruğu (status filter + cursor)",
)
async def list_admin_certificates(
    admin: AdminDep,
    db: DbDep,
    status_filter: Annotated[
        TechnicianCertificateStatus, Query(alias="status")
    ] = TechnicianCertificateStatus.PENDING,
    cursor: CursorQuery = None,
    limit: LimitQuery = 20,
) -> PaginatedResponse[CertificatePendingItem]:
    _ = admin
    cursor_data = decode_cursor(cursor)
    conds = [TechnicianCertificate.status == status_filter]
    if cursor_data is not None:
        last_sort = cursor_data.get("sort")
        last_id = cursor_data.get("id")
        if isinstance(last_sort, str) and isinstance(last_id, str):
            last_dt = datetime.fromisoformat(last_sort)
            conds.append(
                (TechnicianCertificate.uploaded_at < last_dt)
                | (
                    (TechnicianCertificate.uploaded_at == last_dt)
                    & (TechnicianCertificate.id > UUID(last_id))
                )
            )
    stmt = (
        select(TechnicianCertificate)
        .where(and_(*conds))
        .order_by(
            TechnicianCertificate.uploaded_at.desc(),
            TechnicianCertificate.id.asc(),
        )
        .limit(limit + 1)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    items = [CertificatePendingItem.model_validate(c) for c in rows]
    return build_paginated(
        items,
        limit=limit,
        cursor_fn=lambda item: encode_cursor(
            id_=item.id, sort_value=item.uploaded_at
        ),
    )


@router.patch(
    "/certificates/{certificate_id}/approve",
    response_model=CertificatePendingItem,
    summary="Sertifika onayla (+ recompute verified_level)",
)
async def approve_certificate_endpoint(
    certificate_id: UUID,
    admin: AdminDep,
    db: DbDep,
) -> CertificatePendingItem:
    try:
        cert = await admin_actions.approve_certificate(
            db, certificate_id=certificate_id, admin_user_id=admin.id
        )
    except admin_actions.TargetNotFoundError as exc:
        raise HTTPException(
            status_code=404, detail={"type": "certificate_not_found"}
        ) from exc
    await db.commit()
    await db.refresh(cert)
    return CertificatePendingItem.model_validate(cert)


@router.patch(
    "/certificates/{certificate_id}/reject",
    response_model=CertificatePendingItem,
    summary="Sertifika reddet",
)
async def reject_certificate_endpoint(
    certificate_id: UUID,
    payload: CertificateRejectRequest,
    admin: AdminDep,
    db: DbDep,
) -> CertificatePendingItem:
    try:
        cert = await admin_actions.reject_certificate(
            db,
            certificate_id=certificate_id,
            admin_user_id=admin.id,
            reviewer_note=payload.reviewer_note,
        )
    except admin_actions.TargetNotFoundError as exc:
        raise HTTPException(
            status_code=404, detail={"type": "certificate_not_found"}
        ) from exc
    await db.commit()
    await db.refresh(cert)
    return CertificatePendingItem.model_validate(cert)


# ─── Case override (son çare) ────────────────────────────────────────────


@router.post(
    "/cases/{case_id}/override",
    response_model=CaseSummaryResponse,
    summary="Case status override — ALLOWED_TRANSITIONS bypass (son çare)",
)
async def override_case_endpoint(
    case_id: UUID,
    payload: CaseOverrideRequest,
    admin: AdminDep,
    db: DbDep,
) -> CaseSummaryResponse:
    try:
        case = await admin_actions.override_case_status(
            db,
            case_id=case_id,
            new_status=payload.new_status,
            reason=payload.reason,
            admin_user_id=admin.id,
        )
    except admin_actions.TargetNotFoundError as exc:
        raise HTTPException(
            status_code=404, detail={"type": "case_not_found"}
        ) from exc
    await db.commit()
    await db.refresh(case)
    return CaseSummaryResponse.model_validate(case)


# ─── User suspension ─────────────────────────────────────────────────────


@router.post(
    "/users/{user_id}/suspend",
    response_model=UserAdminView,
    summary="User suspend (user.status=SUSPENDED — full lockout)",
)
async def suspend_user_endpoint(
    user_id: UUID,
    payload: UserSuspendRequest,
    admin: AdminDep,
    db: DbDep,
) -> UserAdminView:
    try:
        user = await admin_actions.suspend_user(
            db,
            target_user_id=user_id,
            admin_user_id=admin.id,
            reason=payload.reason,
            until=payload.until,
        )
    except admin_actions.TargetNotFoundError as exc:
        raise HTTPException(
            status_code=404, detail={"type": "user_not_found"}
        ) from exc
    await db.commit()
    await db.refresh(user)
    return UserAdminView.model_validate(user)


@router.post(
    "/users/{user_id}/unsuspend",
    response_model=UserAdminView,
    summary="User unsuspend (status=ACTIVE)",
)
async def unsuspend_user_endpoint(
    user_id: UUID,
    admin: AdminDep,
    db: DbDep,
) -> UserAdminView:
    try:
        user = await admin_actions.unsuspend_user(
            db, target_user_id=user_id, admin_user_id=admin.id
        )
    except admin_actions.TargetNotFoundError as exc:
        raise HTTPException(
            status_code=404, detail={"type": "user_not_found"}
        ) from exc
    await db.commit()
    await db.refresh(user)
    return UserAdminView.model_validate(user)


# ─── Audit log ───────────────────────────────────────────────────────────


@router.get(
    "/audit-log",
    response_model=PaginatedResponse[AdminAuditItem],
    summary="Admin aksiyon audit log (AuthEvent reuse)",
    status_code=status.HTTP_200_OK,
)
async def list_admin_audit_log(
    admin: AdminDep,
    db: DbDep,
    action: AuthEventType | None = None,
    from_: Annotated[datetime | None, Query(alias="from")] = None,
    to: datetime | None = None,
    cursor: CursorQuery = None,
    limit: LimitQuery = 20,
) -> PaginatedResponse[AdminAuditItem]:
    _ = admin
    cursor_data = decode_cursor(cursor)
    conds = [
        AuthEvent.actor == "admin",
        AuthEvent.event_type.in_(admin_actions.ADMIN_EVENT_TYPES),
    ]
    if action is not None:
        conds.append(AuthEvent.event_type == action)
    if from_ is not None:
        conds.append(AuthEvent.created_at >= from_)
    if to is not None:
        conds.append(AuthEvent.created_at <= to)
    if cursor_data is not None:
        last_sort = cursor_data.get("sort")
        last_id = cursor_data.get("id")
        if isinstance(last_sort, str) and isinstance(last_id, str):
            last_dt = datetime.fromisoformat(last_sort)
            conds.append(
                (AuthEvent.created_at < last_dt)
                | (
                    (AuthEvent.created_at == last_dt)
                    & (AuthEvent.id > UUID(last_id))
                )
            )
    stmt = (
        select(AuthEvent)
        .where(and_(*conds))
        .order_by(AuthEvent.created_at.desc(), AuthEvent.id.asc())
        .limit(limit + 1)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    items = [
        AdminAuditItem(
            id=e.id,
            admin_user_id=e.user_id,
            event_type=e.event_type,
            target=e.target,
            context=dict(e.context or {}),
            created_at=e.created_at,
        )
        for e in rows
    ]
    return build_paginated(
        items,
        limit=limit,
        cursor_fn=lambda item: encode_cursor(
            id_=item.id, sort_value=item.created_at
        ),
    )
