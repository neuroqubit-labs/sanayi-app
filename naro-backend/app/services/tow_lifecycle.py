"""Tow lifecycle — stage transition (outbox) + evidence gate + cancel.

Outbox pattern (Plan agent §7):
1. `tow_stage_requested` event INSERT (evidence snapshot + actor).
2. Atomic UPDATE WHERE tow_stage = from_stage (optimistic lock).
3. Success → `tow_stage_committed` INSERT + case_audit.
4. Failure → no second event; caller retries with fresh state read.

case.status senkronu: stage bir üst-seviye status'a map edilir.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case import (
    ServiceCase,
    ServiceCaseStatus,
    TowDispatchStage,
)
from app.models.case_audit import CaseEventType, CaseTone
from app.models.case_subtypes import TowCase
from app.models.tow import TowCancellationActor
from app.repositories import tow as tow_repo
from app.services.case_events import append_event
from app.services.tow_dispatch import compute_cancellation_fee

# ─── Stage graph (allowed transitions) ──────────────────────────────────────

_ALLOWED: dict[TowDispatchStage, frozenset[TowDispatchStage]] = {
    TowDispatchStage.PAYMENT_REQUIRED: frozenset({
        TowDispatchStage.SEARCHING,
        TowDispatchStage.SCHEDULED_WAITING,
        TowDispatchStage.PREAUTH_FAILED,
        TowDispatchStage.CANCELLED,
    }),
    TowDispatchStage.SEARCHING: frozenset({
        TowDispatchStage.ACCEPTED,
        TowDispatchStage.NO_CANDIDATE_FOUND,
        TowDispatchStage.TIMEOUT_CONVERTED_TO_POOL,
        TowDispatchStage.CANCELLED,
        TowDispatchStage.PREAUTH_FAILED,
    }),
    TowDispatchStage.ACCEPTED: frozenset({
        TowDispatchStage.EN_ROUTE,
        TowDispatchStage.CANCELLED,
    }),
    TowDispatchStage.EN_ROUTE: frozenset({
        TowDispatchStage.NEARBY,
        TowDispatchStage.ARRIVED,
        TowDispatchStage.CANCELLED,
    }),
    TowDispatchStage.NEARBY: frozenset({
        TowDispatchStage.ARRIVED,
        TowDispatchStage.CANCELLED,
    }),
    TowDispatchStage.ARRIVED: frozenset({
        TowDispatchStage.LOADING,
        TowDispatchStage.CANCELLED,
    }),
    TowDispatchStage.LOADING: frozenset({
        TowDispatchStage.IN_TRANSIT,
        TowDispatchStage.CANCELLED,
    }),
    TowDispatchStage.IN_TRANSIT: frozenset({
        TowDispatchStage.DELIVERED,
    }),
    TowDispatchStage.SCHEDULED_WAITING: frozenset({
        TowDispatchStage.PAYMENT_REQUIRED,
        TowDispatchStage.BIDDING_OPEN,
        TowDispatchStage.CANCELLED,
    }),
    TowDispatchStage.BIDDING_OPEN: frozenset({
        TowDispatchStage.OFFER_ACCEPTED,
        TowDispatchStage.CANCELLED,
    }),
    TowDispatchStage.OFFER_ACCEPTED: frozenset({
        TowDispatchStage.ACCEPTED,
        TowDispatchStage.CANCELLED,
    }),
    TowDispatchStage.TIMEOUT_CONVERTED_TO_POOL: frozenset({
        TowDispatchStage.SCHEDULED_WAITING,
        TowDispatchStage.CANCELLED,
    }),
    TowDispatchStage.NO_CANDIDATE_FOUND: frozenset({
        TowDispatchStage.SEARCHING,
        TowDispatchStage.CANCELLED,
    }),
    TowDispatchStage.PREAUTH_STALE: frozenset({
        TowDispatchStage.ACCEPTED,
        TowDispatchStage.CANCELLED,
    }),
}

_EVIDENCE_GATES: dict[TowDispatchStage, dict[str, int]] = {
    # arrived → OTP ile geçilir, lifecycle burada yalnızca counts check eder
    TowDispatchStage.LOADING: {"tech_arrival": 1},
    TowDispatchStage.IN_TRANSIT: {"tech_loading": 1},
    TowDispatchStage.DELIVERED: {"tech_delivery": 1},
}


class InvalidStageTransitionError(Exception):
    pass


class EvidenceGateUnmetError(Exception):
    def __init__(self, missing: dict[str, int]):
        self.missing = missing
        super().__init__(f"evidence gate unmet: {missing}")


@dataclass(slots=True)
class CommittedTransition:
    case_id: UUID
    from_stage: TowDispatchStage
    to_stage: TowDispatchStage
    committed_at: datetime


async def transition_stage(
    session: AsyncSession,
    *,
    case: ServiceCase,
    tow_case: TowCase,
    to_stage: TowDispatchStage,
    actor_user_id: UUID,
    skip_evidence_gate: bool = False,
) -> CommittedTransition:
    """Outbox pattern — request event + atomic update + commit event.

    Faz 1 canonical case architecture — tow_stage TowCase subtype'ta.
    """
    from_stage = tow_case.tow_stage

    allowed = _ALLOWED.get(from_stage, frozenset())
    if to_stage not in allowed:
        raise InvalidStageTransitionError(
            f"{from_stage.value} -> {to_stage.value} not allowed"
        )

    if not skip_evidence_gate:
        await _check_evidence_gate(session, case.id, to_stage)

    # 1. Request event (outbox)
    request_event = await append_event(
        session,
        case_id=case.id,
        event_type=CaseEventType.TOW_STAGE_REQUESTED,
        title=f"Aşama geçişi talep edildi: {to_stage.value}",
        actor_user_id=actor_user_id,
        context={
            "from_stage": from_stage.value,
            "target_stage": to_stage.value,
        },
    )

    # 2. Atomic UPDATE with optimistic lock
    moved = await tow_repo.update_tow_stage_with_lock(
        session,
        case_id=case.id,
        from_stage=from_stage,
        to_stage=to_stage,
    )
    if not moved:
        raise InvalidStageTransitionError(
            "concurrent update — tow_case.tow_stage changed"
        )

    tow_case.tow_stage = to_stage
    _sync_case_status(case, to_stage)

    # P0-2 fix: DELIVERED terminal → occupancy lock release (usta bir sonraki
    # işe açık). Diğer stage'lerde lock korunur (accepted/en_route/.../in_transit).
    if to_stage == TowDispatchStage.DELIVERED and case.assigned_technician_id:
        await tow_repo.release_technician_offer(
            session, case.assigned_technician_id
        )

    # 3. Commit event
    now = datetime.now(UTC)
    await append_event(
        session,
        case_id=case.id,
        event_type=CaseEventType.TOW_STAGE_COMMITTED,
        title=f"Aşama güncellendi: {to_stage.value}",
        tone=CaseTone.ACCENT,
        actor_user_id=actor_user_id,
        context={
            "from_stage": from_stage.value,
            "to_stage": to_stage.value,
            "request_event_id": str(request_event.id),
        },
    )

    return CommittedTransition(
        case_id=case.id,
        from_stage=from_stage,
        to_stage=to_stage,
        committed_at=now,
    )


async def cancel_case(
    session: AsyncSession,
    *,
    case: ServiceCase,
    tow_case: TowCase,
    actor: TowCancellationActor,
    actor_user_id: UUID | None,
    reason_code: str,
    reason_note: str | None = None,
    locked_price: Decimal | None = None,
) -> Decimal:
    """Return: effective_fee (authoritative — route katmanı yeniden hesap
    yapmaz). `tow_cancellations.cancellation_fee` ile aynı değer.

    Faz 1 canonical case architecture — tow state TowCase subtype'tan okunur.
    """
    stage_at_cancel = tow_case.tow_stage
    fee = compute_cancellation_fee(
        tow_case.tow_mode, stage_at_cancel, locked_price=locked_price
    )
    # -1 → full fare (locked_price or estimate)
    effective_fee = (
        locked_price or case.estimate_amount or Decimal("0")
    ) if fee == Decimal("-1") else fee

    moved = await tow_repo.update_tow_stage_with_lock(
        session,
        case_id=case.id,
        from_stage=stage_at_cancel,
        to_stage=TowDispatchStage.CANCELLED,
    )
    if not moved:
        raise InvalidStageTransitionError("concurrent update")

    tow_case.tow_stage = TowDispatchStage.CANCELLED
    case.status = ServiceCaseStatus.CANCELLED
    case.closed_at = datetime.now(UTC)

    # P0-2 fix: CANCELLED terminal → occupancy lock release
    if case.assigned_technician_id:
        await tow_repo.release_technician_offer(
            session, case.assigned_technician_id
        )

    await tow_repo.create_cancellation(
        session,
        case_id=case.id,
        actor=actor,
        actor_user_id=actor_user_id,
        reason_code=reason_code,
        stage_at_cancel=stage_at_cancel,
        cancellation_fee=effective_fee,
        refund_amount=Decimal("0"),
        reason_note=reason_note,
    )
    await append_event(
        session,
        case_id=case.id,
        event_type=CaseEventType.CANCELLED,
        title="Çekici talebi iptal edildi",
        tone=CaseTone.WARNING,
        actor_user_id=actor_user_id,
        context={
            "stage_at_cancel": stage_at_cancel.value,
            "fee": str(effective_fee),
            "reason_code": reason_code,
        },
    )
    return effective_fee


async def _check_evidence_gate(
    session: AsyncSession,
    case_id: UUID,
    target_stage: TowDispatchStage,
) -> None:
    requirements = _EVIDENCE_GATES.get(target_stage)
    if not requirements:
        return
    counts = await tow_repo.evidence_gate_counts(session, case_id)
    missing: dict[str, int] = {}
    for kind, needed in requirements.items():
        have = int(counts.get(kind, 0))
        if have < needed:
            missing[kind] = needed - have
    if missing:
        raise EvidenceGateUnmetError(missing)


def sync_case_status(case: ServiceCase, stage: TowDispatchStage) -> None:
    """B-P1-5: public authority — tow stage → shell case.status map.

    Önceden tow_dispatch._transition_to_accepted shell'e direkt yazıyordu;
    şimdi dispatch da bu fonksiyondan geçer — shell yazma yetkisi
    tow_lifecycle'ın tekelinde."""
    _sync_case_status(case, stage)


def _sync_case_status(case: ServiceCase, stage: TowDispatchStage) -> None:
    if stage in {
        TowDispatchStage.SEARCHING,
        TowDispatchStage.PAYMENT_REQUIRED,
        TowDispatchStage.NO_CANDIDATE_FOUND,
        TowDispatchStage.BIDDING_OPEN,
        TowDispatchStage.SCHEDULED_WAITING,
    }:
        case.status = ServiceCaseStatus.MATCHING
    elif stage in {
        TowDispatchStage.ACCEPTED,
        TowDispatchStage.EN_ROUTE,
        TowDispatchStage.NEARBY,
        TowDispatchStage.ARRIVED,
        TowDispatchStage.LOADING,
        TowDispatchStage.IN_TRANSIT,
    }:
        case.status = ServiceCaseStatus.SERVICE_IN_PROGRESS
    elif stage == TowDispatchStage.DELIVERED:
        case.status = ServiceCaseStatus.COMPLETED
        case.closed_at = datetime.now(UTC)
    elif stage == TowDispatchStage.CANCELLED:
        case.status = ServiceCaseStatus.CANCELLED
        case.closed_at = datetime.now(UTC)
