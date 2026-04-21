"""Case approval flow — parça/fatura/teslim onay akışları.

3 kind:
- parts_request: usta ek parça talep eder, müşteri onay verir
- invoice: usta fatura paylaşır, müşteri onay verir
- completion: usta teslim hazır der, müşteri onay verir

Her onay + red case.status'unu etkiler:
- parts_request approve → case: service_in_progress (iş devam eder)
- parts_request reject → case: service_in_progress (iş devam eder, parça değişikliği yok)
- invoice approve → case: completed (total_amount set)
- invoice reject → case: service_in_progress (fatura revize)
- completion approve → case: completed (zaten invoice approve sonrası gelir)
- completion reject → case: service_in_progress

Atomic; rollback-safe; idempotent (status check + raise).
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case import ServiceCase, ServiceCaseStatus
from app.models.case_audit import CaseEventType, CaseTone
from app.models.case_process import (
    CaseApproval,
    CaseApprovalKind,
    CaseApprovalLineItem,
    CaseApprovalStatus,
)
from app.services.case_events import append_event
from app.services.case_lifecycle import transition_case_status


class ApprovalNotFoundError(LookupError):
    pass


class ApprovalNotPendingError(ValueError):
    pass


async def request_approval(
    session: AsyncSession,
    *,
    case_id: UUID,
    kind: CaseApprovalKind,
    title: str,
    description: str | None,
    requested_by_user_id: UUID,
    requested_by_snapshot_name: str | None = None,
    amount: Decimal | None = None,
    currency: str = "TRY",
    service_comment: str | None = None,
    line_items: list[dict[str, object]] | None = None,
) -> CaseApproval:
    """Usta onay talebi oluşturur + opsiyonel line_items + case status update."""
    approval = CaseApproval(
        case_id=case_id,
        kind=kind,
        title=title,
        description=description,
        requested_by_user_id=requested_by_user_id,
        requested_by_snapshot_name=requested_by_snapshot_name,
        amount=amount,
        currency=currency,
        service_comment=service_comment,
    )
    session.add(approval)
    await session.flush()

    for idx, li in enumerate(line_items or []):
        label = li.get("label")
        value = li.get("value")
        if not isinstance(label, str) or not isinstance(value, str):
            raise ValueError("line_item.label ve value string olmalı")
        note = li.get("note")
        item = CaseApprovalLineItem(
            approval_id=approval.id,
            label=label,
            value=value,
            note=note if isinstance(note, str) else None,
            sequence=idx,
        )
        session.add(item)
    await session.flush()

    # Case status'u — kind'e göre. SCHEDULED ise önce SERVICE_IN_PROGRESS'e
    # otomatik geçiş yap (iş başladı hook'u).
    current_status_stmt = select(ServiceCase.status).where(
        ServiceCase.id == case_id
    )
    current_status = (
        await session.execute(current_status_stmt)
    ).scalar_one()
    if current_status == ServiceCaseStatus.SCHEDULED:
        await transition_case_status(
            session, case_id, ServiceCaseStatus.SERVICE_IN_PROGRESS,
            actor_user_id=requested_by_user_id,
        )

    if kind == CaseApprovalKind.PARTS_REQUEST:
        await transition_case_status(
            session, case_id, ServiceCaseStatus.PARTS_APPROVAL,
            actor_user_id=requested_by_user_id,
        )
        await append_event(
            session, case_id=case_id, event_type=CaseEventType.PARTS_REQUESTED,
            title=f"Parça onayı istendi: {title}",
            tone=CaseTone.WARNING, actor_user_id=requested_by_user_id,
            context={"approval_id": str(approval.id), "amount": str(amount) if amount else None},
        )
    elif kind == CaseApprovalKind.INVOICE:
        await transition_case_status(
            session, case_id, ServiceCaseStatus.INVOICE_APPROVAL,
            actor_user_id=requested_by_user_id,
        )
        await append_event(
            session, case_id=case_id, event_type=CaseEventType.INVOICE_SHARED,
            title=f"Fatura paylaşıldı: {title}",
            tone=CaseTone.INFO, actor_user_id=requested_by_user_id,
            context={"approval_id": str(approval.id), "amount": str(amount) if amount else None},
        )
    # completion: service_in_progress'te kalır; onaylanınca completed
    return approval


async def _get_pending(
    session: AsyncSession, approval_id: UUID
) -> CaseApproval:
    stmt = select(CaseApproval).where(CaseApproval.id == approval_id)
    approval = (await session.execute(stmt)).scalar_one_or_none()
    if approval is None:
        raise ApprovalNotFoundError(str(approval_id))
    if approval.status != CaseApprovalStatus.PENDING:
        raise ApprovalNotPendingError(
            f"approval {approval_id} is {approval.status.value}"
        )
    return approval


async def approve(
    session: AsyncSession,
    approval_id: UUID,
    *,
    actor_user_id: UUID,
) -> CaseApproval:
    """Müşteri onayı — approval.status='approved' + case status sync."""
    approval = await _get_pending(session, approval_id)

    await session.execute(
        update(CaseApproval)
        .where(CaseApproval.id == approval_id)
        .values(status=CaseApprovalStatus.APPROVED, responded_at=datetime.now(UTC))
    )

    if approval.kind == CaseApprovalKind.PARTS_REQUEST:
        # İş devam eder
        await append_event(
            session, case_id=approval.case_id, event_type=CaseEventType.PARTS_APPROVED,
            title="Parça onayı verildi", tone=CaseTone.SUCCESS,
            actor_user_id=actor_user_id, context={"approval_id": str(approval_id)},
        )
        await transition_case_status(
            session, approval.case_id, ServiceCaseStatus.SERVICE_IN_PROGRESS,
            actor_user_id=actor_user_id,
        )
    elif approval.kind == CaseApprovalKind.INVOICE:
        # Fatura onaylandı — total_amount güncellenir + completed
        if approval.amount is not None:
            await session.execute(
                update(ServiceCase)
                .where(ServiceCase.id == approval.case_id)
                .values(total_amount=approval.amount)
            )
        await append_event(
            session, case_id=approval.case_id, event_type=CaseEventType.INVOICE_APPROVED,
            title="Fatura onayı verildi", tone=CaseTone.SUCCESS,
            actor_user_id=actor_user_id,
            context={"approval_id": str(approval_id), "amount": str(approval.amount) if approval.amount else None},
        )
        await transition_case_status(
            session, approval.case_id, ServiceCaseStatus.COMPLETED,
            actor_user_id=actor_user_id,
        )
    elif approval.kind == CaseApprovalKind.COMPLETION:
        await transition_case_status(
            session, approval.case_id, ServiceCaseStatus.COMPLETED,
            actor_user_id=actor_user_id,
        )

    await session.refresh(approval)
    return approval


async def reject(
    session: AsyncSession,
    approval_id: UUID,
    *,
    actor_user_id: UUID,
) -> CaseApproval:
    """Müşteri reddeder — approval.status='rejected' + case status revert."""
    approval = await _get_pending(session, approval_id)

    await session.execute(
        update(CaseApproval)
        .where(CaseApproval.id == approval_id)
        .values(status=CaseApprovalStatus.REJECTED, responded_at=datetime.now(UTC))
    )

    # parts_request / invoice / completion reddi — hepsi service_in_progress'e döner
    reject_event = (
        CaseEventType.PARTS_REJECTED
        if approval.kind == CaseApprovalKind.PARTS_REQUEST
        else CaseEventType.STATUS_UPDATE  # invoice/completion reject için spesifik yok
    )
    await append_event(
        session, case_id=approval.case_id, event_type=reject_event,
        title=f"{approval.kind.value} reddedildi",
        tone=CaseTone.WARNING, actor_user_id=actor_user_id,
        context={"approval_id": str(approval_id), "kind": approval.kind.value},
    )
    await transition_case_status(
        session, approval.case_id, ServiceCaseStatus.SERVICE_IN_PROGRESS,
        actor_user_id=actor_user_id,
    )
    await session.refresh(approval)
    return approval
