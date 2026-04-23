"""Atomic offer acceptance — offer + kardeşler + case status + (opsiyonel) randevu tek transaction.

Müşteri bir teklifi seçtiğinde:
  1. Seçilen offer.status='accepted'
  2. Aynı case'teki diğer pending/shortlisted offer'lar → rejected
  3. Dallanma:
     (A) slot_is_firm=False  → case.status='appointment_pending' (müşteri sonra randevu talep eder)
     (B) slot_is_firm=True   → appointment auto-create (source='offer_accept', status='approved')
                               + case.status='scheduled' + assigned_technician_id set

Dış kullanıcı `accept_offer(session, offer_id)` çağırır; içeride repository +
lifecycle service çağrıları atomik sırayla çalışır.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import (
    Appointment,
    AppointmentSlotKind,
    AppointmentSource,
    AppointmentStatus,
)
from app.models.case import ServiceCase, ServiceCaseStatus
from app.models.case_audit import CaseEventType, CaseTone
from app.models.offer import CaseOffer
from app.repositories import offer as offer_repo
from app.services.case_events import append_event
from app.services.case_lifecycle import transition_case_status


class OfferNotFoundError(LookupError):
    pass


class OfferNotAcceptableError(ValueError):
    pass


class OfferSlotInvalidError(ValueError):
    pass


# Firm slot randevusu oluştururken expires_at için güvenli pencere.
# Müşteri + usta için 48 saat sonrası default; caller override edebilir.
_FIRM_APPOINTMENT_TTL = timedelta(hours=48)


async def accept_offer(
    session: AsyncSession,
    offer_id: UUID,
    *,
    actor_user_id: UUID | None = None,
) -> CaseOffer:
    # P1-5 fix: check-then-update yerine atomic UPDATE...WHERE...RETURNING.
    # Double accept / concurrent retry / çift tıklamada tek başarılı yarış.
    offer = await offer_repo.mark_accepted_atomic(session, offer_id)
    if offer is None:
        # Ya offer_id yok, ya da status PENDING/SHORTLISTED dışı — ayırt et
        existing = await offer_repo.get_offer(session, offer_id)
        if existing is None:
            raise OfferNotFoundError(str(offer_id))
        raise OfferNotAcceptableError(
            f"offer {offer_id} is in status {existing.status.value}"
        )

    siblings = await offer_repo.list_siblings_for_case(
        session, offer.case_id, exclude_id=offer_id
    )
    for sib in siblings:
        await offer_repo.reject_offer(session, sib.id)

    # P1-E fix (QA tur 1): offer.amount → service_cases.estimate_amount
    # Billing summary + payment_initiate invariant bağımlılığı. Atomic
    # accept ile aynı TX içinde yazılır.
    await session.execute(
        update(ServiceCase)
        .where(ServiceCase.id == offer.case_id)
        .values(estimate_amount=offer.amount)
    )

    await append_event(
        session,
        case_id=offer.case_id,
        event_type=CaseEventType.OFFER_ACCEPTED,
        title="Teklif kabul edildi",
        tone=CaseTone.SUCCESS,
        actor_user_id=actor_user_id,
        context={"offer_id": str(offer_id), "amount": str(offer.amount)},
    )

    if offer.slot_is_firm:
        await _schedule_firm_appointment(
            session, offer, actor_user_id=actor_user_id
        )
    else:
        await transition_case_status(
            session,
            offer.case_id,
            ServiceCaseStatus.APPOINTMENT_PENDING,
            actor_user_id=actor_user_id,
        )

    await session.refresh(offer)
    return offer


async def _schedule_firm_appointment(
    session: AsyncSession,
    offer: CaseOffer,
    *,
    actor_user_id: UUID | None,
) -> Appointment:
    """slot_is_firm=True ise: appointment auto-create + case → scheduled."""
    slot = offer.slot_proposal
    if not slot or not isinstance(slot, dict):
        raise OfferSlotInvalidError(
            f"offer {offer.id} slot_is_firm=True ama slot_proposal eksik"
        )

    slot_kind_raw = slot.get("kind")
    if not isinstance(slot_kind_raw, str):
        raise OfferSlotInvalidError("slot_proposal.kind zorunlu (string)")
    slot_kind = AppointmentSlotKind(slot_kind_raw)

    now = datetime.now(UTC)
    expires_at = now + _FIRM_APPOINTMENT_TTL

    # Case ara state: APPOINTMENT_PENDING (ardından SCHEDULED'a geçiş)
    await transition_case_status(
        session,
        offer.case_id,
        ServiceCaseStatus.APPOINTMENT_PENDING,
        actor_user_id=actor_user_id,
    )

    appointment = Appointment(
        case_id=offer.case_id,
        technician_id=offer.technician_id,
        offer_id=offer.id,
        slot=slot,
        slot_kind=slot_kind,
        note="",
        expires_at=expires_at,
        source=AppointmentSource.OFFER_ACCEPT.value,
        status=AppointmentStatus.APPROVED,
        responded_at=now,
    )
    session.add(appointment)
    await session.flush()

    # ServiceCase → scheduled + assigned_technician_id
    await session.execute(
        update(ServiceCase)
        .where(ServiceCase.id == offer.case_id)
        .values(assigned_technician_id=offer.technician_id)
    )
    # B-P1-10: TECHNICIAN_SELECTED emit — assignment event.
    await append_event(
        session,
        case_id=offer.case_id,
        event_type=CaseEventType.TECHNICIAN_SELECTED,
        title="Usta atandı",
        tone=CaseTone.SUCCESS,
        actor_user_id=actor_user_id,
        context={
            "technician_id": str(offer.technician_id),
            "offer_id": str(offer.id),
        },
    )
    await transition_case_status(
        session,
        offer.case_id,
        ServiceCaseStatus.SCHEDULED,
        actor_user_id=actor_user_id,
    )
    return appointment
