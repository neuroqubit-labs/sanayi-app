"""Appointment repository — request, list, low-level status updates.

Atomic transitions (approve/decline + case status sync) için bkz:
`app/services/appointment_flow.py`.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import CursorResult, and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import (
    Appointment,
    AppointmentSlotKind,
    AppointmentSource,
    AppointmentStatus,
)


async def get_appointment(
    session: AsyncSession, appointment_id: UUID
) -> Appointment | None:
    return await session.get(Appointment, appointment_id)


async def request_appointment(
    session: AsyncSession,
    *,
    case_id: UUID,
    technician_id: UUID,
    offer_id: UUID | None,
    slot: dict[str, object],
    expires_at: datetime,
    note: str = "",
    source: AppointmentSource = AppointmentSource.OFFER_ACCEPT,
) -> Appointment:
    slot_kind_value = slot.get("kind")
    if not isinstance(slot_kind_value, str):
        raise ValueError("slot.kind must be a string (appointment_slot_kind)")
    slot_kind = AppointmentSlotKind(slot_kind_value)
    appointment = Appointment(
        case_id=case_id,
        technician_id=technician_id,
        offer_id=offer_id,
        slot=slot,
        slot_kind=slot_kind,
        note=note,
        expires_at=expires_at,
        source=source.value,
    )
    session.add(appointment)
    await session.flush()
    return appointment


async def mark_approved(
    session: AsyncSession, appointment_id: UUID
) -> bool:
    """B-P1-1 fix: optimistic lock — UPDATE WHERE status=PENDING RETURNING id.
    False → race kaybedildi (başka transition geçti)."""
    stmt = (
        update(Appointment)
        .where(
            Appointment.id == appointment_id,
            Appointment.status == AppointmentStatus.PENDING,
        )
        .values(
            status=AppointmentStatus.APPROVED,
            responded_at=datetime.now(UTC),
        )
        .returning(Appointment.id)
    )
    row = (await session.execute(stmt)).first()
    return row is not None


async def mark_declined(
    session: AsyncSession,
    appointment_id: UUID,
    *,
    reason: str,
) -> bool:
    """B-P1-1 fix: optimistic lock PENDING → DECLINED."""
    stmt = (
        update(Appointment)
        .where(
            Appointment.id == appointment_id,
            Appointment.status == AppointmentStatus.PENDING,
        )
        .values(
            status=AppointmentStatus.DECLINED,
            responded_at=datetime.now(UTC),
            decline_reason=reason,
        )
        .returning(Appointment.id)
    )
    row = (await session.execute(stmt)).first()
    return row is not None


async def mark_cancelled(
    session: AsyncSession, appointment_id: UUID
) -> bool:
    """B-P1-1 fix: optimistic lock PENDING/APPROVED → CANCELLED.

    Customer iptali iki statüden de kabul edilir (APPROVED'da randevu
    günü öncesi customer iptal).
    """
    stmt = (
        update(Appointment)
        .where(
            Appointment.id == appointment_id,
            Appointment.status.in_(
                (AppointmentStatus.PENDING, AppointmentStatus.APPROVED)
            ),
        )
        .values(
            status=AppointmentStatus.CANCELLED,
            responded_at=datetime.now(UTC),
        )
        .returning(Appointment.id)
    )
    row = (await session.execute(stmt)).first()
    return row is not None


async def get_active_for_case(
    session: AsyncSession, case_id: UUID
) -> Appointment | None:
    stmt = select(Appointment).where(
        and_(
            Appointment.case_id == case_id,
            Appointment.status == AppointmentStatus.PENDING,
        )
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_pending_for_technician(
    session: AsyncSession, technician_id: UUID
) -> list[Appointment]:
    stmt = (
        select(Appointment)
        .where(
            and_(
                Appointment.technician_id == technician_id,
                Appointment.status == AppointmentStatus.PENDING,
            )
        )
        .order_by(Appointment.requested_at.desc())
    )
    return list((await session.execute(stmt)).scalars().all())


async def cancel_all_for_case(
    session: AsyncSession, case_id: UUID
) -> list[UUID]:
    """B-P0-4 fix: case cancel cascade — PENDING/APPROVED → CANCELLED.

    Returns: etkilenen appointment_id listesi.
    """
    stmt = (
        update(Appointment)
        .where(
            and_(
                Appointment.case_id == case_id,
                Appointment.status.in_(
                    (AppointmentStatus.PENDING, AppointmentStatus.APPROVED)
                ),
            )
        )
        .values(
            status=AppointmentStatus.CANCELLED,
            responded_at=datetime.now(UTC),
        )
        .returning(Appointment.id)
    )
    rows = (await session.execute(stmt)).scalars().all()
    return list(rows)


async def expire_pending_appointments(
    session: AsyncSession, *, before: datetime | None = None
) -> int:
    """Cron: pending + expires_at <= NOW → expired."""
    threshold = before or datetime.now(UTC)
    result: CursorResult[object] = await session.execute(  # type: ignore[assignment]
        update(Appointment)
        .where(
            and_(
                Appointment.status == AppointmentStatus.PENDING,
                Appointment.expires_at <= threshold,
            )
        )
        .values(
            status=AppointmentStatus.EXPIRED,
            responded_at=datetime.now(UTC),
        )
    )
    return int(result.rowcount or 0)
