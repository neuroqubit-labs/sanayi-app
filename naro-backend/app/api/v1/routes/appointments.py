"""/appointments router — offer-based randevu akışı.

Faz A brief §4. 7-8 endpoint:
- POST /appointments                          — customer: offer accept path
- GET  /appointments/case/{id}                — case owner + assigned tech
- POST /appointments/{id}/approve             — technician
- POST /appointments/{id}/decline             — technician + reason
- POST /appointments/{id}/cancel              — customer | admin
- POST /appointments/{id}/counter-propose     — technician: new slot
- POST /appointments/{id}/confirm-counter     — customer: accept counter
- POST /appointments/{id}/decline-counter     — customer: reject counter

Race koruma: appointment_flow service zaten `_get_pending` + `_get_counter_pending`
guard'ları uygular. Atomic transition (appointment + case status).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from app.api.v1.deps import (
    CurrentCustomerDep,
    CurrentTechnicianDep,
    CurrentUserDep,
    DbDep,
)
from app.models.appointment import (
    Appointment,
    AppointmentSlotKind,
    AppointmentSource,
    AppointmentStatus,
)
from app.models.case import ServiceCase, ServiceCaseStatus, ServiceRequestKind
from app.models.case_audit import CaseEventType, CaseTone
from app.models.offer import CaseOffer, CaseOfferStatus
from app.models.user import UserRole
from app.repositories import appointment as appointment_repo
from app.schemas.appointment import AppointmentRequest
from app.services import (
    appointment_flow,
    offer_acceptance,
    technician_payment_accounts,
)
from app.services.case_events import append_event
from app.services.case_lifecycle import transition_case_status

router = APIRouter(prefix="/appointments", tags=["appointments"])

_APPOINTMENT_TTL = timedelta(hours=48)
_OFFER_REQUIRED_KINDS = {
    ServiceRequestKind.ACCIDENT,
    ServiceRequestKind.BREAKDOWN,
    ServiceRequestKind.MAINTENANCE,
}
_APPOINTABLE_OFFER_STATUSES = {
    CaseOfferStatus.PENDING,
    CaseOfferStatus.SHORTLISTED,
    CaseOfferStatus.ACCEPTED,
}


# ─── Pydantic schemas ───────────────────────────────────────────────────────
# P1-F fix (QA tur 1): AppointmentRequest canonical app/schemas/appointment.py
# (7 field: case_id, technician_id, offer_id, slot, note, expires_at, source).
# Route inline shadow kaldırıldı — FE canonical 7 field gönderebilir.


class AppointmentReasonPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(min_length=1, max_length=500)


class AppointmentCounterPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    new_slot: dict[str, object]


class AppointmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    case_id: UUID
    technician_id: UUID
    offer_id: UUID | None
    status: AppointmentStatus
    slot: dict[str, object]
    slot_kind: AppointmentSlotKind
    note: str
    source: str
    counter_proposal: dict[str, object] | None
    counter_proposal_by_user_id: UUID | None
    decline_reason: str | None
    requested_at: datetime
    responded_at: datetime | None
    expires_at: datetime | None


# ─── Endpoints ──────────────────────────────────────────────────────────────


@router.post(
    "",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Teklif üzerinden randevu talebi (müşteri → teknisyen)",
)
async def create_appointment_request(
    payload: AppointmentRequest,
    user: CurrentCustomerDep,
    db: DbDep,
) -> AppointmentResponse:
    case = await db.get(ServiceCase, payload.case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(status_code=404, detail={"type": "case_not_found"})
    if case.customer_user_id != user.id:
        raise HTTPException(status_code=403, detail={"type": "not_case_owner"})
    if case.status not in (
        ServiceCaseStatus.MATCHING,
        ServiceCaseStatus.OFFERS_READY,
        ServiceCaseStatus.APPOINTMENT_PENDING,
    ):
        raise HTTPException(
            status_code=422,
            detail={
                "type": "case_not_open_for_appointment",
                "case_status": case.status.value,
            },
        )
    offer = await _load_and_validate_appointment_offer(db, case, payload)

    # Aktif pending randevu var mı (partial unique benzeri guard)
    existing = await appointment_repo.get_active_for_case(db, case.id)
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "type": "appointment_already_pending",
                "existing_appointment_id": str(existing.id),
            },
        )

    if offer.status != CaseOfferStatus.ACCEPTED:
        try:
            await offer_acceptance.accept_offer(
                db, offer.id, actor_user_id=user.id
            )
        except offer_acceptance.OfferNotFoundError as exc:
            raise HTTPException(
                status_code=404, detail={"type": "offer_not_found"}
            ) from exc
        except offer_acceptance.OfferNotAcceptableError as exc:
            raise HTTPException(
                status_code=410,
                detail={
                    "type": "offer_not_acceptable",
                    "message": str(exc),
                },
            ) from exc
        except offer_acceptance.OfferSlotInvalidError as exc:
            raise HTTPException(
                status_code=422,
                detail={"type": "offer_slot_invalid", "message": str(exc)},
            ) from exc
        await db.refresh(offer)

    firm_appointment = await _get_appointment_for_offer(db, offer.id)
    if firm_appointment is not None:
        await db.commit()
        return AppointmentResponse.model_validate(firm_appointment)

    slot_dict = payload.slot.model_dump(mode="json", exclude_none=True)
    expires_at = payload.expires_at or datetime.now(UTC) + _APPOINTMENT_TTL
    appointment = await appointment_repo.request_appointment(
        db,
        case_id=case.id,
        technician_id=payload.technician_id,
        offer_id=offer.id,
        slot=slot_dict,
        expires_at=expires_at,
        note=payload.note,
        source=AppointmentSource.OFFER_ACCEPT,
    )
    await append_event(
        db,
        case_id=case.id,
        event_type=CaseEventType.APPOINTMENT_REQUESTED,
        title="Randevu talebi gönderildi",
        tone=CaseTone.INFO,
        actor_user_id=user.id,
        context={
            "appointment_id": str(appointment.id),
            "technician_id": str(payload.technician_id),
            "slot": slot_dict,
        },
    )
    await transition_case_status(
        db,
        case.id,
        ServiceCaseStatus.APPOINTMENT_PENDING,
        actor_user_id=user.id,
    )
    await db.commit()
    return AppointmentResponse.model_validate(appointment)


async def _load_and_validate_appointment_offer(
    db: DbDep,
    case: ServiceCase,
    payload: AppointmentRequest,
) -> CaseOffer:
    if case.kind in _OFFER_REQUIRED_KINDS and payload.offer_id is None:
        raise HTTPException(
            status_code=422,
            detail={
                "type": "offer_required_for_appointment",
                "message": "Bakım, arıza ve hasar vakalarında randevu için önce teklif seçilmelidir.",
            },
        )
    if payload.source == AppointmentSource.DIRECT_REQUEST:
        raise HTTPException(
            status_code=422,
            detail={
                "type": "direct_appointment_disabled",
                "message": "Teklif olmadan randevu talebi bu akışta kapalıdır.",
            },
        )
    if payload.offer_id is None:
        raise HTTPException(
            status_code=422,
            detail={"type": "offer_required_for_appointment"},
        )

    offer = await db.get(CaseOffer, payload.offer_id)
    if offer is None:
        raise HTTPException(status_code=404, detail={"type": "offer_not_found"})
    if offer.case_id != case.id or offer.technician_id != payload.technician_id:
        raise HTTPException(
            status_code=422,
            detail={"type": "offer_not_valid_for_appointment"},
        )
    if offer.status not in _APPOINTABLE_OFFER_STATUSES:
        raise HTTPException(
            status_code=410,
            detail={
                "type": "offer_not_acceptable",
                "offer_status": offer.status.value,
            },
        )
    return offer


async def _get_appointment_for_offer(
    db: DbDep, offer_id: UUID
) -> Appointment | None:
    stmt = select(Appointment).where(Appointment.offer_id == offer_id).limit(1)
    return (await db.execute(stmt)).scalar_one_or_none()


@router.get(
    "/case/{case_id}",
    response_model=list[AppointmentResponse],
    summary="Vakanın randevuları (case owner + assigned tech)",
)
async def list_appointments_for_case(
    case_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
) -> list[AppointmentResponse]:
    case = await db.get(ServiceCase, case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(status_code=404, detail={"type": "case_not_found"})
    _assert_case_access(case, user_id=user.id, role=user.role)
    from sqlalchemy import select

    stmt = select(Appointment).where(Appointment.case_id == case_id).order_by(
        Appointment.requested_at.desc()
    )
    rows = list((await db.execute(stmt)).scalars().all())
    return [AppointmentResponse.model_validate(r) for r in rows]


@router.post(
    "/{appointment_id}/approve",
    response_model=AppointmentResponse,
    summary="Teknisyen: randevuyu onayla",
)
async def approve_endpoint(
    appointment_id: UUID,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> AppointmentResponse:
    try:
        await technician_payment_accounts.require_can_receive_online_payments(
            db, user.id
        )
    except technician_payment_accounts.PaymentAccountRequiredError as exc:
        raise HTTPException(
            status_code=403,
            detail={"type": "payment_account_required"},
        ) from exc

    appt = await appointment_repo.get_appointment(db, appointment_id)
    if appt is None:
        raise HTTPException(
            status_code=404, detail={"type": "appointment_not_found"}
        )
    if appt.technician_id != user.id:
        raise HTTPException(
            status_code=403, detail={"type": "not_appointment_technician"}
        )
    try:
        result = await appointment_flow.approve_appointment(
            db, appointment_id, actor_user_id=user.id
        )
    except appointment_flow.AppointmentNotPendingError as exc:
        raise HTTPException(
            status_code=410,
            detail={"type": "appointment_not_pending", "message": str(exc)},
        ) from exc
    await db.commit()
    return AppointmentResponse.model_validate(result)


@router.post(
    "/{appointment_id}/decline",
    response_model=AppointmentResponse,
    summary="Teknisyen: randevuyu reddet",
)
async def decline_endpoint(
    appointment_id: UUID,
    payload: AppointmentReasonPayload,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> AppointmentResponse:
    appt = await appointment_repo.get_appointment(db, appointment_id)
    if appt is None:
        raise HTTPException(
            status_code=404, detail={"type": "appointment_not_found"}
        )
    if appt.technician_id != user.id:
        raise HTTPException(
            status_code=403, detail={"type": "not_appointment_technician"}
        )
    try:
        result = await appointment_flow.decline_appointment(
            db, appointment_id, reason=payload.reason, actor_user_id=user.id
        )
    except appointment_flow.AppointmentNotPendingError as exc:
        raise HTTPException(
            status_code=410,
            detail={"type": "appointment_not_pending", "message": str(exc)},
        ) from exc
    await db.commit()
    return AppointmentResponse.model_validate(result)


@router.post(
    "/{appointment_id}/cancel",
    response_model=AppointmentResponse,
    summary="Müşteri/admin: randevuyu iptal et",
)
async def cancel_endpoint(
    appointment_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
) -> AppointmentResponse:
    appt = await appointment_repo.get_appointment(db, appointment_id)
    if appt is None:
        raise HTTPException(
            status_code=404, detail={"type": "appointment_not_found"}
        )
    case = await db.get(ServiceCase, appt.case_id)
    if case is None:
        raise HTTPException(status_code=404, detail={"type": "case_not_found"})
    is_owner = case.customer_user_id == user.id
    is_admin = user.role == UserRole.ADMIN
    if not (is_owner or is_admin):
        raise HTTPException(
            status_code=403, detail={"type": "not_case_owner_or_admin"}
        )
    try:
        result = await appointment_flow.cancel_appointment(
            db, appointment_id, actor_user_id=user.id
        )
    except appointment_flow.AppointmentNotPendingError as exc:
        raise HTTPException(
            status_code=410,
            detail={"type": "appointment_not_pending", "message": str(exc)},
        ) from exc
    await db.commit()
    return AppointmentResponse.model_validate(result)


@router.post(
    "/{appointment_id}/counter-propose",
    response_model=AppointmentResponse,
    summary="Teknisyen: counter-offer slot önerisi",
)
async def counter_propose_endpoint(
    appointment_id: UUID,
    payload: AppointmentCounterPayload,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> AppointmentResponse:
    appt = await appointment_repo.get_appointment(db, appointment_id)
    if appt is None:
        raise HTTPException(
            status_code=404, detail={"type": "appointment_not_found"}
        )
    if appt.technician_id != user.id:
        raise HTTPException(
            status_code=403, detail={"type": "not_appointment_technician"}
        )
    try:
        result = await appointment_flow.counter_propose_slot(
            db, appointment_id, new_slot=payload.new_slot, actor_user_id=user.id
        )
    except appointment_flow.AppointmentNotPendingError as exc:
        raise HTTPException(
            status_code=410,
            detail={"type": "appointment_not_pending", "message": str(exc)},
        ) from exc
    except appointment_flow.CounterSlotInvalidError as exc:
        raise HTTPException(
            status_code=422,
            detail={"type": "counter_slot_invalid", "message": str(exc)},
        ) from exc
    await db.commit()
    return AppointmentResponse.model_validate(result)


@router.post(
    "/{appointment_id}/confirm-counter",
    response_model=AppointmentResponse,
    summary="Müşteri: counter-offer onay",
)
async def confirm_counter_endpoint(
    appointment_id: UUID,
    user: CurrentCustomerDep,
    db: DbDep,
) -> AppointmentResponse:
    appt = await appointment_repo.get_appointment(db, appointment_id)
    if appt is None:
        raise HTTPException(
            status_code=404, detail={"type": "appointment_not_found"}
        )
    case = await db.get(ServiceCase, appt.case_id)
    if case is None or case.customer_user_id != user.id:
        raise HTTPException(status_code=403, detail={"type": "not_case_owner"})
    try:
        result = await appointment_flow.confirm_counter(
            db, appointment_id, actor_user_id=user.id
        )
    except appointment_flow.AppointmentNotCounterPendingError as exc:
        raise HTTPException(
            status_code=410,
            detail={
                "type": "appointment_not_counter_pending",
                "message": str(exc),
            },
        ) from exc
    except appointment_flow.CounterSlotInvalidError as exc:
        raise HTTPException(
            status_code=422,
            detail={"type": "counter_slot_invalid", "message": str(exc)},
        ) from exc
    await db.commit()
    return AppointmentResponse.model_validate(result)


@router.post(
    "/{appointment_id}/decline-counter",
    response_model=AppointmentResponse,
    summary="Müşteri: counter-offer reddet",
)
async def decline_counter_endpoint(
    appointment_id: UUID,
    payload: AppointmentReasonPayload,
    user: CurrentCustomerDep,
    db: DbDep,
) -> AppointmentResponse:
    appt = await appointment_repo.get_appointment(db, appointment_id)
    if appt is None:
        raise HTTPException(
            status_code=404, detail={"type": "appointment_not_found"}
        )
    case = await db.get(ServiceCase, appt.case_id)
    if case is None or case.customer_user_id != user.id:
        raise HTTPException(status_code=403, detail={"type": "not_case_owner"})
    try:
        result = await appointment_flow.decline_counter(
            db, appointment_id, reason=payload.reason, actor_user_id=user.id
        )
    except appointment_flow.AppointmentNotCounterPendingError as exc:
        raise HTTPException(
            status_code=410,
            detail={
                "type": "appointment_not_counter_pending",
                "message": str(exc),
            },
        ) from exc
    await db.commit()
    return AppointmentResponse.model_validate(result)


# ─── Helpers ────────────────────────────────────────────────────────────────


def _assert_case_access(
    case: ServiceCase, *, user_id: UUID, role: UserRole
) -> None:
    if role == UserRole.ADMIN:
        return
    participants = {case.customer_user_id, case.assigned_technician_id}
    if user_id not in participants:
        raise HTTPException(
            status_code=403, detail={"type": "not_case_participant"}
        )
