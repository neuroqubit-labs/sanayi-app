"""Atomic appointment flow — approve/decline/cancel + counter-offer ile case status sync.

approve_appointment:
  1. appointment.status='approved'
  2. case.assigned_technician_id = technician_id
  3. case.status='scheduled'

decline_appointment:
  1. appointment.status='declined' + decline_reason
  2. case.status='offers_ready'  (revert to offer selection)

cancel_appointment (customer/admin):
  1. appointment.status='cancelled'
  2. case status geri `offers_ready` (varsayılan); caller override edebilir.

counter_propose_slot (Kural 5 — usta randevuyu düzenleyip onay bekler):
  1. appointment.status='counter_pending'
  2. counter_proposal + counter_proposal_by_user_id set
  3. case.status değişmez (APPOINTMENT_PENDING'de kalır)

confirm_counter (müşteri counter'ı onayladı):
  1. slot = counter_proposal, slot_kind yenilenir
  2. counter_proposal/by_user_id temizlenir
  3. appointment.status='approved' + case.status='scheduled' + assigned_technician_id set

decline_counter (müşteri counter'ı reddetti):
  1. appointment.status='declined' + decline_reason
  2. case.status='offers_ready'
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment, AppointmentSlotKind, AppointmentStatus
from app.models.case import ServiceCase, ServiceCaseStatus
from app.models.case_audit import CaseEventType, CaseTone
from app.repositories import appointment as appointment_repo
from app.services.case_events import append_event
from app.services.case_lifecycle import transition_case_status


class AppointmentNotFoundError(LookupError):
    pass


class AppointmentNotPendingError(ValueError):
    pass


class AppointmentNotCounterPendingError(ValueError):
    pass


class CounterSlotInvalidError(ValueError):
    pass


async def _get_appointment(
    session: AsyncSession, appointment_id: UUID
) -> Appointment:
    appt = await appointment_repo.get_appointment(session, appointment_id)
    if appt is None:
        raise AppointmentNotFoundError(str(appointment_id))
    return appt


async def _get_pending(
    session: AsyncSession, appointment_id: UUID
) -> Appointment:
    appt = await _get_appointment(session, appointment_id)
    if appt.status != AppointmentStatus.PENDING:
        raise AppointmentNotPendingError(
            f"appointment {appointment_id} is {appt.status.value}"
        )
    return appt


def _parse_slot_kind(slot: dict[str, object]) -> AppointmentSlotKind:
    kind = slot.get("kind")
    if not isinstance(kind, str):
        raise CounterSlotInvalidError("slot.kind zorunlu (string)")
    return AppointmentSlotKind(kind)


async def approve_appointment(
    session: AsyncSession,
    appointment_id: UUID,
    *,
    actor_user_id: UUID,
) -> Appointment:
    appt = await _get_pending(session, appointment_id)

    await appointment_repo.mark_approved(session, appointment_id)
    await session.execute(
        update(ServiceCase)
        .where(ServiceCase.id == appt.case_id)
        .values(assigned_technician_id=appt.technician_id)
    )
    await append_event(
        session,
        case_id=appt.case_id,
        event_type=CaseEventType.APPOINTMENT_APPROVED,
        title="Randevu onaylandı",
        tone=CaseTone.SUCCESS,
        actor_user_id=actor_user_id,
        context={"appointment_id": str(appointment_id)},
    )
    await transition_case_status(
        session,
        appt.case_id,
        ServiceCaseStatus.SCHEDULED,
        actor_user_id=actor_user_id,
    )
    await session.refresh(appt)
    return appt


async def decline_appointment(
    session: AsyncSession,
    appointment_id: UUID,
    *,
    reason: str,
    actor_user_id: UUID,
) -> Appointment:
    appt = await _get_pending(session, appointment_id)

    await appointment_repo.mark_declined(session, appointment_id, reason=reason)
    await append_event(
        session,
        case_id=appt.case_id,
        event_type=CaseEventType.APPOINTMENT_DECLINED,
        title="Randevu reddedildi",
        body=reason,
        tone=CaseTone.WARNING,
        actor_user_id=actor_user_id,
    )
    await transition_case_status(
        session,
        appt.case_id,
        ServiceCaseStatus.OFFERS_READY,
        actor_user_id=actor_user_id,
    )
    await session.refresh(appt)
    return appt


async def cancel_appointment(
    session: AsyncSession,
    appointment_id: UUID,
    *,
    actor_user_id: UUID,
    revert_case_to: ServiceCaseStatus = ServiceCaseStatus.OFFERS_READY,
) -> Appointment:
    appt = await _get_pending(session, appointment_id)

    await appointment_repo.mark_cancelled(session, appointment_id)
    await transition_case_status(
        session,
        appt.case_id,
        revert_case_to,
        actor_user_id=actor_user_id,
    )
    await session.refresh(appt)
    return appt


async def counter_propose_slot(
    session: AsyncSession,
    appointment_id: UUID,
    *,
    new_slot: dict[str, object],
    actor_user_id: UUID,
) -> Appointment:
    """Kural 5 — usta randevu talebini kabul edip slot'u düzenliyor."""
    appt = await _get_pending(session, appointment_id)
    _parse_slot_kind(new_slot)  # validate only

    await session.execute(
        update(Appointment)
        .where(Appointment.id == appointment_id)
        .values(
            status=AppointmentStatus.COUNTER_PENDING,
            counter_proposal=new_slot,
            counter_proposal_by_user_id=actor_user_id,
        )
    )
    await append_event(
        session,
        case_id=appt.case_id,
        event_type=CaseEventType.APPOINTMENT_COUNTER,
        title="Usta randevuyu düzenledi",
        tone=CaseTone.INFO,
        actor_user_id=actor_user_id,
        context={"new_slot": new_slot},
    )
    # case.status APPOINTMENT_PENDING'de kalır
    await session.refresh(appt)
    return appt


async def confirm_counter(
    session: AsyncSession,
    appointment_id: UUID,
    *,
    actor_user_id: UUID,
) -> Appointment:
    """Müşteri counter-offer'ı kabul etti → slot güncellenir, case scheduled."""
    appt = await _get_appointment(session, appointment_id)
    if appt.status != AppointmentStatus.COUNTER_PENDING:
        raise AppointmentNotCounterPendingError(
            f"appointment {appointment_id} is {appt.status.value}"
        )

    counter = appt.counter_proposal
    if not isinstance(counter, dict):
        raise CounterSlotInvalidError("counter_proposal eksik")
    slot_kind = _parse_slot_kind(counter)

    now = datetime.now(UTC)
    await session.execute(
        update(Appointment)
        .where(Appointment.id == appointment_id)
        .values(
            slot=counter,
            slot_kind=slot_kind,
            status=AppointmentStatus.APPROVED,
            responded_at=now,
            counter_proposal=None,
            counter_proposal_by_user_id=None,
        )
    )
    await session.execute(
        update(ServiceCase)
        .where(ServiceCase.id == appt.case_id)
        .values(assigned_technician_id=appt.technician_id)
    )
    await transition_case_status(
        session,
        appt.case_id,
        ServiceCaseStatus.SCHEDULED,
        actor_user_id=actor_user_id,
    )
    await session.refresh(appt)
    return appt


async def decline_counter(
    session: AsyncSession,
    appointment_id: UUID,
    *,
    reason: str,
    actor_user_id: UUID,
) -> Appointment:
    """Müşteri counter-offer'ı reddetti → case offers_ready'ye döner."""
    appt = await _get_appointment(session, appointment_id)
    if appt.status != AppointmentStatus.COUNTER_PENDING:
        raise AppointmentNotCounterPendingError(
            f"appointment {appointment_id} is {appt.status.value}"
        )

    await session.execute(
        update(Appointment)
        .where(Appointment.id == appointment_id)
        .values(
            status=AppointmentStatus.DECLINED,
            responded_at=datetime.now(UTC),
            decline_reason=reason,
        )
    )
    await transition_case_status(
        session,
        appt.case_id,
        ServiceCaseStatus.OFFERS_READY,
        actor_user_id=actor_user_id,
    )
    await session.refresh(appt)
    return appt
