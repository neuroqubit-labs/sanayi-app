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
- completion approve → case: completed (non-tow invoice/billing sonrası; tow
  vakada delivered gate'iyle)
- completion reject → case: service_in_progress

Atomic; rollback-safe; idempotent (status check + raise).
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case import (
    ServiceCase,
    ServiceCaseStatus,
    ServiceRequestKind,
    TowDispatchStage,
)
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


class CompletionGateError(ValueError):
    """Completion approve denendi ama invoice/billing gate'leri eksik.

    B-P0-1 fix: invoice approve tek başına COMPLETED yapmaz; completion
    approve da gerekli + billing_state=SETTLED. V1 minimal (Option B) —
    V1.1 orchestrator B-P1-2'de.
    """

    def __init__(self, reason: str, *, missing: dict[str, object]) -> None:
        super().__init__(reason)
        self.missing = missing


class ApprovalAlreadyActiveError(ValueError):
    """B-P2-2 fix: 1 pending approval per (case, kind) — partial unique
    index uq_active_approval_per_case_kind ihlali."""

    def __init__(self, case_id: UUID, kind: CaseApprovalKind) -> None:
        super().__init__(f"pending approval already exists for case={case_id} kind={kind.value}")
        self.case_id = case_id
        self.kind = kind


async def reject_all_pending_for_case(session: AsyncSession, case_id: UUID) -> list[UUID]:
    """B-P0-4 fix: case cancel cascade — PENDING approvals → REJECTED.

    Returns: etkilenen approval_id listesi (cascade event emit için).
    """
    stmt = (
        update(CaseApproval)
        .where(
            CaseApproval.case_id == case_id,
            CaseApproval.status == CaseApprovalStatus.PENDING,
        )
        .values(
            status=CaseApprovalStatus.REJECTED,
            responded_at=datetime.now(UTC),
        )
        .returning(CaseApproval.id)
    )
    rows = (await session.execute(stmt)).scalars().all()
    return list(rows)


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
    try:
        await session.flush()
    except IntegrityError as exc:
        # B-P2-2: partial unique index uq_active_approval_per_case_kind
        # ihlali — aynı case/kind'te pending approval mevcut.
        if "uq_active_approval_per_case_kind" in str(exc.orig):
            raise ApprovalAlreadyActiveError(case_id, kind) from exc
        raise

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
    current_status_stmt = select(ServiceCase.status).where(ServiceCase.id == case_id)
    current_status = (await session.execute(current_status_stmt)).scalar_one()
    if current_status == ServiceCaseStatus.SCHEDULED:
        await transition_case_status(
            session,
            case_id,
            ServiceCaseStatus.SERVICE_IN_PROGRESS,
            actor_user_id=requested_by_user_id,
        )

    if kind == CaseApprovalKind.PARTS_REQUEST:
        await transition_case_status(
            session,
            case_id,
            ServiceCaseStatus.PARTS_APPROVAL,
            actor_user_id=requested_by_user_id,
        )
        await append_event(
            session,
            case_id=case_id,
            event_type=CaseEventType.PARTS_REQUESTED,
            title=f"Parça onayı istendi: {title}",
            tone=CaseTone.WARNING,
            actor_user_id=requested_by_user_id,
            context={"approval_id": str(approval.id), "amount": str(amount) if amount else None},
        )
    elif kind == CaseApprovalKind.INVOICE:
        await transition_case_status(
            session,
            case_id,
            ServiceCaseStatus.INVOICE_APPROVAL,
            actor_user_id=requested_by_user_id,
        )
        await append_event(
            session,
            case_id=case_id,
            event_type=CaseEventType.INVOICE_SHARED,
            title=f"Fatura paylaşıldı: {title}",
            tone=CaseTone.INFO,
            actor_user_id=requested_by_user_id,
            context={"approval_id": str(approval.id), "amount": str(amount) if amount else None},
        )
    # completion: service_in_progress'te kalır; onaylanınca completed
    return approval


async def _get_pending(session: AsyncSession, approval_id: UUID) -> CaseApproval:
    stmt = select(CaseApproval).where(CaseApproval.id == approval_id).with_for_update()
    approval = (await session.execute(stmt)).scalar_one_or_none()
    if approval is None:
        raise ApprovalNotFoundError(str(approval_id))
    if approval.status != CaseApprovalStatus.PENDING:
        raise ApprovalNotPendingError(f"approval {approval_id} is {approval.status.value}")
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
            session,
            case_id=approval.case_id,
            event_type=CaseEventType.PARTS_APPROVED,
            title="Parça onayı verildi",
            tone=CaseTone.SUCCESS,
            actor_user_id=actor_user_id,
            context={"approval_id": str(approval_id)},
        )
        await transition_case_status(
            session,
            approval.case_id,
            ServiceCaseStatus.SERVICE_IN_PROGRESS,
            actor_user_id=actor_user_id,
        )
    elif approval.kind == CaseApprovalKind.INVOICE:
        # B-P0-1 fix: invoice approve != COMPLETED. Sadece total_amount yaz,
        # event emit, case INVOICE_APPROVAL statüsünde kalır. Completion
        # gate'i ayrı approval kind'ında enforce edilir (+ billing SETTLED).
        if approval.amount is not None:
            await session.execute(
                update(ServiceCase)
                .where(ServiceCase.id == approval.case_id)
                .values(total_amount=approval.amount)
            )
        await append_event(
            session,
            case_id=approval.case_id,
            event_type=CaseEventType.INVOICE_APPROVED,
            title="Fatura onayı verildi",
            tone=CaseTone.SUCCESS,
            actor_user_id=actor_user_id,
            context={
                "approval_id": str(approval_id),
                "amount": str(approval.amount) if approval.amount else None,
            },
        )
        # Shell halen INVOICE_APPROVAL; tamamlama completion approve + billing SETTLED ile olur.
    elif approval.kind == CaseApprovalKind.COMPLETION:
        # B-P0-1 fix: completion gate — billing_state SETTLED olmadan reject.
        # Pilot Option B minimal path (V1.1 orchestrator B-P1-2).
        case_row = await session.get(ServiceCase, approval.case_id)
        if case_row is None:
            raise ApprovalNotFoundError(str(approval_id))
        if case_row.kind == ServiceRequestKind.TOWING:
            from app.models.case_subtypes import TowCase

            tow_case = await session.get(TowCase, approval.case_id)
            if tow_case is None or tow_case.tow_stage != TowDispatchStage.DELIVERED:
                raise CompletionGateError(
                    "tow completion approve requires tow_stage=delivered",
                    missing={
                        "tow_stage": tow_case.tow_stage.value if tow_case else None,
                        "required": TowDispatchStage.DELIVERED.value,
                    },
                )
        elif case_row.billing_state != "settled":
            raise CompletionGateError(
                "completion approve requires billing_state=settled",
                missing={
                    "billing_state": case_row.billing_state,
                    "required": "settled",
                },
            )
        # B-P1-2 fix: orchestrator authority — direct transition yerine
        # try_complete, böylece 3 gate (operasyonel + billing + terminal)
        # tek yerden enforce.
        from app.services.case_completion import try_complete

        await try_complete(session, approval.case_id, actor_user_id=actor_user_id)

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
        session,
        case_id=approval.case_id,
        event_type=reject_event,
        title=f"{approval.kind.value} reddedildi",
        tone=CaseTone.WARNING,
        actor_user_id=actor_user_id,
        context={"approval_id": str(approval_id), "kind": approval.kind.value},
    )
    await transition_case_status(
        session,
        approval.case_id,
        ServiceCaseStatus.SERVICE_IN_PROGRESS,
        actor_user_id=actor_user_id,
    )
    await session.refresh(approval)
    return approval
