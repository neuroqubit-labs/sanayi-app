"""ServiceCase lifecycle — status makinesi + wait_state transitions.

DB sadece enum validate eder; iş mantığı burada. `transition_case_status`
ALLOWED_TRANSITIONS kontrolü yapar, terminal state'lerde `closed_at` set eder.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case import (
    CaseWaitActor,
    ServiceCase,
    ServiceCaseStatus,
)
from app.models.case_audit import CaseEventType, CaseTone
from app.services.case_events import append_event

S = ServiceCaseStatus

ALLOWED_TRANSITIONS: dict[ServiceCaseStatus, set[ServiceCaseStatus]] = {
    S.MATCHING: {S.OFFERS_READY, S.APPOINTMENT_PENDING, S.CANCELLED},
    S.OFFERS_READY: {S.APPOINTMENT_PENDING, S.MATCHING, S.CANCELLED},
    S.APPOINTMENT_PENDING: {S.SCHEDULED, S.OFFERS_READY, S.CANCELLED},
    S.SCHEDULED: {S.SERVICE_IN_PROGRESS, S.CANCELLED},
    S.SERVICE_IN_PROGRESS: {S.PARTS_APPROVAL, S.INVOICE_APPROVAL, S.CANCELLED},
    S.PARTS_APPROVAL: {S.SERVICE_IN_PROGRESS, S.CANCELLED},
    S.INVOICE_APPROVAL: {S.COMPLETED, S.SERVICE_IN_PROGRESS, S.CANCELLED},
    S.COMPLETED: {S.ARCHIVED},
    S.CANCELLED: {S.ARCHIVED},
    S.ARCHIVED: set(),
}

TERMINAL_STATES: frozenset[ServiceCaseStatus] = frozenset(
    {S.COMPLETED, S.CANCELLED}
)


class InvalidTransitionError(ValueError):
    def __init__(self, current: ServiceCaseStatus, new: ServiceCaseStatus) -> None:
        super().__init__(
            f"Invalid status transition: {current.value} -> {new.value}"
        )
        self.current = current
        self.new = new


class CaseNotFoundError(LookupError):
    pass


async def transition_case_status(
    session: AsyncSession,
    case_id: UUID,
    new_status: ServiceCaseStatus,
    *,
    actor_user_id: UUID | None = None,
) -> ServiceCase:
    stmt = select(ServiceCase).where(ServiceCase.id == case_id)
    case = (await session.execute(stmt)).scalar_one_or_none()
    if case is None:
        raise CaseNotFoundError(str(case_id))
    # P0-C fix (QA tur 1): idempotency — aynı status'a tekrar transition
    # no-op (race: offer accept atomic + FE POST /appointments paralel).
    # Audit event spam'ı da önler.
    if case.status == new_status:
        return case
    if new_status not in ALLOWED_TRANSITIONS[case.status]:
        raise InvalidTransitionError(case.status, new_status)

    old_status = case.status
    values: dict[str, object] = {"status": new_status}
    if new_status in TERMINAL_STATES:
        values["closed_at"] = datetime.now(UTC)
    await session.execute(
        update(ServiceCase).where(ServiceCase.id == case_id).values(**values)
    )

    # Eksen 5 [5a]: her transition audit event'i yazar
    tone = CaseTone.SUCCESS if new_status == ServiceCaseStatus.COMPLETED else (
        CaseTone.WARNING if new_status == ServiceCaseStatus.CANCELLED else CaseTone.INFO
    )
    event_type = _event_type_for_status(new_status)
    await append_event(
        session,
        case_id=case_id,
        event_type=event_type,
        title=f"Durum: {old_status.value} → {new_status.value}",
        tone=tone,
        actor_user_id=actor_user_id,
        context={"old": old_status.value, "new": new_status.value},
    )

    await session.refresh(case)
    return case


def _event_type_for_status(status: ServiceCaseStatus) -> CaseEventType:
    mapping = {
        ServiceCaseStatus.COMPLETED: CaseEventType.COMPLETED,
        ServiceCaseStatus.CANCELLED: CaseEventType.CANCELLED,
        ServiceCaseStatus.ARCHIVED: CaseEventType.ARCHIVED,
    }
    return mapping.get(status, CaseEventType.STATUS_UPDATE)


async def update_wait_state(
    session: AsyncSession,
    case_id: UUID,
    *,
    actor: CaseWaitActor,
    label: str | None = None,
    description: str | None = None,
) -> None:
    await session.execute(
        update(ServiceCase)
        .where(ServiceCase.id == case_id)
        .values(
            wait_state_actor=actor,
            wait_state_label=label,
            wait_state_description=description,
        )
    )
