"""Admin action service (Faz A PR 9) — 8 fn + AuthEvent emit + Prometheus.

Tüm admin mutation'ları bu modülden geçer. Her fn:
1. Business logic (User/Case/Certificate update)
2. `AuthEvent` append (actor='admin', user_id=admin_user_id,
   target=target UUID stringi, context=aksiyon detayı)
3. Prometheus `admin_action_total` counter increment

State transitions:
- approve_technician:  PENDING/REJECTED/SUSPENDED → ACTIVE
- reject_technician:   PENDING → REJECTED
- suspend_technician:  * → SUSPENDED (technician approval_status)
- approve_certificate: PENDING → APPROVED (+ recompute_verified_level)
- reject_certificate:  PENDING → REJECTED
- override_case_status: ANY → :new_status (ALLOWED_TRANSITIONS bypass, son çare)
- suspend_user:        * → SUSPENDED (user.status — full lockout)
- unsuspend_user:      SUSPENDED → ACTIVE
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth_event import AuthEvent, AuthEventType
from app.models.case import ServiceCase, ServiceCaseStatus
from app.models.case_audit import CaseEventType, CaseTone
from app.models.technician import (
    TechnicianCertificate,
    TechnicianCertificateStatus,
)
from app.models.user import User, UserApprovalStatus, UserStatus
from app.observability.metrics import admin_action_total
from app.repositories import technician as technician_repo
from app.services.case_events import append_event
from app.services.technician_kyc import recompute_verified_level


class AdminActionError(ValueError):
    """Hedef kayıt yok ya da beklenmedik state."""


class TargetNotFoundError(AdminActionError):
    pass


def _emit(
    db: AsyncSession,
    *,
    admin_user_id: UUID,
    event_type: AuthEventType,
    target: str,
    context: dict[str, object],
) -> None:
    db.add(
        AuthEvent(
            user_id=admin_user_id,
            event_type=event_type,
            actor="admin",
            target=target,
            context=context,
        )
    )


def _metric(action: str) -> None:
    admin_action_total.labels(action=action).inc()


# ─── Technician approval ──────────────────────────────────────────────────


async def approve_technician(
    db: AsyncSession,
    *,
    target_user_id: UUID,
    admin_user_id: UUID,
    note: str | None = None,
) -> User:
    user = await db.get(User, target_user_id)
    if user is None:
        raise TargetNotFoundError(f"user {target_user_id} not found")
    user.approval_status = UserApprovalStatus.ACTIVE
    await db.flush()
    _emit(
        db,
        admin_user_id=admin_user_id,
        event_type=AuthEventType.ADMIN_TECHNICIAN_APPROVED,
        target=str(target_user_id),
        context={"note": note},
    )
    _metric("technician_approved")
    return user


async def reject_technician(
    db: AsyncSession,
    *,
    target_user_id: UUID,
    admin_user_id: UUID,
    reason: str,
) -> User:
    user = await db.get(User, target_user_id)
    if user is None:
        raise TargetNotFoundError(f"user {target_user_id} not found")
    user.approval_status = UserApprovalStatus.REJECTED
    await db.flush()
    _emit(
        db,
        admin_user_id=admin_user_id,
        event_type=AuthEventType.ADMIN_TECHNICIAN_REJECTED,
        target=str(target_user_id),
        context={"reason": reason},
    )
    _metric("technician_rejected")
    return user


async def suspend_technician(
    db: AsyncSession,
    *,
    target_user_id: UUID,
    admin_user_id: UUID,
    reason: str,
    until: datetime | None = None,
) -> User:
    user = await db.get(User, target_user_id)
    if user is None:
        raise TargetNotFoundError(f"user {target_user_id} not found")
    user.approval_status = UserApprovalStatus.SUSPENDED
    await db.flush()
    _emit(
        db,
        admin_user_id=admin_user_id,
        event_type=AuthEventType.ADMIN_TECHNICIAN_SUSPENDED,
        target=str(target_user_id),
        context={"reason": reason, "until": until.isoformat() if until else None},
    )
    _metric("technician_suspended")
    return user


# ─── Certificate review ──────────────────────────────────────────────────


async def approve_certificate(
    db: AsyncSession,
    *,
    certificate_id: UUID,
    admin_user_id: UUID,
) -> TechnicianCertificate:
    cert = await db.get(TechnicianCertificate, certificate_id)
    if cert is None:
        raise TargetNotFoundError(f"certificate {certificate_id} not found")
    await technician_repo.update_certificate_status(
        db, certificate_id, TechnicianCertificateStatus.APPROVED
    )
    await recompute_verified_level(db, cert.profile_id)
    # Refresh cert post-update
    await db.refresh(cert)
    _emit(
        db,
        admin_user_id=admin_user_id,
        event_type=AuthEventType.ADMIN_CERT_APPROVED,
        target=str(certificate_id),
        context={"profile_id": str(cert.profile_id), "kind": cert.kind.value},
    )
    _metric("cert_approved")
    return cert


async def reject_certificate(
    db: AsyncSession,
    *,
    certificate_id: UUID,
    admin_user_id: UUID,
    reviewer_note: str,
) -> TechnicianCertificate:
    cert = await db.get(TechnicianCertificate, certificate_id)
    if cert is None:
        raise TargetNotFoundError(f"certificate {certificate_id} not found")
    await technician_repo.update_certificate_status(
        db,
        certificate_id,
        TechnicianCertificateStatus.REJECTED,
        reviewer_note=reviewer_note,
    )
    await db.refresh(cert)
    _emit(
        db,
        admin_user_id=admin_user_id,
        event_type=AuthEventType.ADMIN_CERT_REJECTED,
        target=str(certificate_id),
        context={
            "profile_id": str(cert.profile_id),
            "kind": cert.kind.value,
            "reviewer_note": reviewer_note,
        },
    )
    _metric("cert_rejected")
    return cert


# ─── Case override ────────────────────────────────────────────────────────


async def override_case_status(
    db: AsyncSession,
    *,
    case_id: UUID,
    new_status: ServiceCaseStatus,
    reason: str,
    admin_user_id: UUID,
) -> ServiceCase:
    """Son çare — ALLOWED_TRANSITIONS bypass. Reason zorunlu, audit trail
    AuthEvent + CaseEvent."""
    case = await db.get(ServiceCase, case_id)
    if case is None or case.deleted_at is not None:
        raise TargetNotFoundError(f"case {case_id} not found")
    prev_status = case.status
    case.status = new_status
    await db.flush()
    await append_event(
        db,
        case_id=case_id,
        event_type=CaseEventType.STATUS_UPDATE,
        title=f"Admin override: {prev_status.value} → {new_status.value}",
        body=reason,
        tone=CaseTone.CRITICAL,
        actor_user_id=admin_user_id,
        context={"admin_override": True, "prev_status": prev_status.value, "reason": reason},
    )
    _emit(
        db,
        admin_user_id=admin_user_id,
        event_type=AuthEventType.ADMIN_CASE_OVERRIDE,
        target=str(case_id),
        context={
            "prev_status": prev_status.value,
            "new_status": new_status.value,
            "reason": reason,
        },
    )
    _metric("case_override")
    return case


# ─── User suspension (generic) ────────────────────────────────────────────


async def suspend_user(
    db: AsyncSession,
    *,
    target_user_id: UUID,
    admin_user_id: UUID,
    reason: str,
    until: datetime | None = None,
) -> User:
    user = await db.get(User, target_user_id)
    if user is None:
        raise TargetNotFoundError(f"user {target_user_id} not found")
    user.status = UserStatus.SUSPENDED
    await db.flush()
    _emit(
        db,
        admin_user_id=admin_user_id,
        event_type=AuthEventType.ADMIN_USER_SUSPENDED,
        target=str(target_user_id),
        context={"reason": reason, "until": until.isoformat() if until else None},
    )
    _metric("user_suspended")
    return user


async def unsuspend_user(
    db: AsyncSession,
    *,
    target_user_id: UUID,
    admin_user_id: UUID,
) -> User:
    user = await db.get(User, target_user_id)
    if user is None:
        raise TargetNotFoundError(f"user {target_user_id} not found")
    user.status = UserStatus.ACTIVE
    await db.flush()
    _emit(
        db,
        admin_user_id=admin_user_id,
        event_type=AuthEventType.ADMIN_USER_UNSUSPENDED,
        target=str(target_user_id),
        context={},
    )
    _metric("user_unsuspended")
    return user


# ─── Admin audit event type set (for audit-log filter) ────────────────────

ADMIN_EVENT_TYPES: frozenset[AuthEventType] = frozenset(
    {
        AuthEventType.ADMIN_TECHNICIAN_APPROVED,
        AuthEventType.ADMIN_TECHNICIAN_REJECTED,
        AuthEventType.ADMIN_TECHNICIAN_SUSPENDED,
        AuthEventType.ADMIN_CERT_APPROVED,
        AuthEventType.ADMIN_CERT_REJECTED,
        AuthEventType.ADMIN_INSURANCE_CLAIM_ACCEPTED,
        AuthEventType.ADMIN_INSURANCE_CLAIM_REJECTED,
        AuthEventType.ADMIN_INSURANCE_CLAIM_PAID,
        AuthEventType.ADMIN_CASE_OVERRIDE,
        AuthEventType.ADMIN_USER_SUSPENDED,
        AuthEventType.ADMIN_USER_UNSUSPENDED,
    }
)
