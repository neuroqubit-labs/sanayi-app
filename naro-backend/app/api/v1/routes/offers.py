"""/offers router — usta teklif submit + customer accept + listing + withdraw.

Faz A brief §3. 5 endpoint:
- POST /offers           — teknisyen teklif gönder (kind-bazlı cap + admission gate)
- GET  /offers/case/{id} — case owner + admin: vaka teklifleri
- GET  /offers/me        — teknisyen: kendi teklifleri (cursor paginated)
- POST /offers/{id}/accept   — case owner: atomic accept (offer_acceptance service)
- POST /offers/{id}/withdraw — teknisyen: pending/shortlisted → withdrawn

Race koruma:
- accept: `offer_acceptance.accept_offer` atomic (zaten mevcut)
- submit duplicate: partial unique `uq_active_offer_per_tech_case`
- withdraw: status filter UPDATE ... WHERE IN (pending, shortlisted)
"""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING, Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import and_, select

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

from app.api.pagination import (
    CursorQuery,
    LimitQuery,
    PaginatedResponse,
    build_paginated,
    decode_cursor,
    encode_cursor,
)
from app.api.v1.deps import (
    CurrentCustomerDep,
    CurrentTechnicianDep,
    CurrentUserDep,
    DbDep,
)
from app.models.case import ServiceCase, ServiceCaseStatus, ServiceRequestKind
from app.models.case_audit import CaseEventType, CaseTone
from app.models.offer import CaseOffer, CaseOfferStatus
from app.models.technician import ProviderType, TechnicianProfile
from app.models.user import UserRole
from app.repositories import offer as offer_repo
from app.services import offer_acceptance, technician_payment_accounts
from app.services.case_events import append_event
from app.services.pool_matching import KIND_PROVIDER_MAP

router = APIRouter(prefix="/offers", tags=["offers"])


# ─── Pydantic schemas ───────────────────────────────────────────────────────


class OfferSubmitPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    case_id: UUID
    amount: Decimal = Field(ge=0)
    eta_minutes: int = Field(ge=0)
    headline: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    delivery_mode: str = Field(min_length=1, max_length=64)
    warranty_label: str = Field(min_length=1, max_length=128)
    currency: str = Field(default="TRY", min_length=3, max_length=8)
    available_at_label: str | None = Field(default=None, max_length=128)
    badges: list[str] = Field(default_factory=list)
    slot_proposal: dict[str, object] | None = None
    slot_is_firm: bool = False


class OfferWithdrawPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str | None = Field(default=None, max_length=500)


class OfferShortlistPayload(BaseModel):
    """Customer teklifi kısa listeye al — V1 opsiyonel not.

    Pilot'ta not ignore edilebilir; V1.1'de `customer_note` analytics
    için saklanır.
    """

    model_config = ConfigDict(extra="forbid")
    note: str | None = Field(default=None, max_length=500)


class OfferCustomerRejectPayload(BaseModel):
    """Customer teklifi reddet — V1 opsiyonel sebep.

    Pilot'ta sebep ignore edilebilir; V1.1'de `reason` analytics için
    saklanır (PO karar).
    """

    model_config = ConfigDict(extra="forbid")
    reason: str | None = Field(default=None, max_length=500)


class OfferResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    case_id: UUID
    technician_id: UUID
    status: CaseOfferStatus
    headline: str
    description: str | None
    amount: Decimal
    currency: str
    eta_minutes: int
    delivery_mode: str
    warranty_label: str
    available_at_label: str | None
    badges: list[str]
    slot_proposal: dict[str, object] | None
    slot_is_firm: bool


# ─── Kind bazlı offer cap'ları (brief §3.2 PO kararı) ──────────────────────

_KIND_OFFER_CAP: dict[ServiceRequestKind, int] = {
    ServiceRequestKind.ACCIDENT: 5,
    ServiceRequestKind.BREAKDOWN: 7,
    ServiceRequestKind.MAINTENANCE: 10,
    ServiceRequestKind.TOWING: 5,
}


# ─── Endpoints ──────────────────────────────────────────────────────────────


@router.post(
    "",
    response_model=OfferResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Teklif gönder (teknisyen)",
)
async def submit_offer_endpoint(
    payload: OfferSubmitPayload,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> OfferResponse:
    try:
        await technician_payment_accounts.require_can_receive_online_payments(
            db, user.id
        )
    except technician_payment_accounts.PaymentAccountRequiredError as exc:
        raise HTTPException(
            status_code=403,
            detail={"type": "payment_account_required"},
        ) from exc

    case = await db.get(ServiceCase, payload.case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(
            status_code=404, detail={"type": "case_not_found"}
        )

    if case.status not in (
        ServiceCaseStatus.MATCHING,
        ServiceCaseStatus.OFFERS_READY,
    ):
        raise HTTPException(
            status_code=422,
            detail={
                "type": "case_not_open_for_offers",
                "case_status": case.status.value,
            },
        )

    # Provider_type uyumu (brief §3.2)
    profile = await _get_technician_profile(db, user.id)
    if profile is None:
        raise HTTPException(
            status_code=403,
            detail={"type": "technician_profile_missing"},
        )

    allowed_providers = KIND_PROVIDER_MAP.get(case.kind, set())
    tech_providers: set[ProviderType] = {profile.provider_type, *(profile.secondary_provider_types or [])}
    if not tech_providers & allowed_providers:
        raise HTTPException(
            status_code=422,
            detail={
                "type": "provider_type_mismatch",
                "case_kind": case.kind.value,
                "tech_provider": profile.provider_type.value,
            },
        )

    # Duplicate aktif offer guard (partial unique zaten var; fail-fast için service check)
    existing = await offer_repo.my_offer_for_case(db, case.id, user.id)
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "type": "offer_already_active",
                "existing_offer_id": str(existing.id),
                "status": existing.status.value,
            },
        )

    # Slot firm check — slot_is_firm=True → slot_proposal zorunlu
    if payload.slot_is_firm and not payload.slot_proposal:
        raise HTTPException(
            status_code=422,
            detail={
                "type": "firm_slot_requires_proposal",
                "message": "slot_is_firm=True iken slot_proposal zorunlu",
            },
        )

    # Kind-bazlı cap — cap dolu ise 200 + status='pending' shortlist dışı (brief §3.2)
    active_count = await _count_active_offers(db, case.id)
    cap = _KIND_OFFER_CAP.get(case.kind, 10)
    _cap_reached = active_count >= cap

    # QA tur 2 P1-4 fix: offer.expires_at default TTL (settings.offer_ttl_minutes).
    # B-P1-6 cron filter (expires_at <= NOW) bu alanla eşleşir — NULL ise
    # cron hiç bir zaman EXPIRED geçiremez.
    from datetime import UTC, datetime, timedelta

    from app.core.config import get_settings

    ttl_minutes = get_settings().offer_ttl_minutes
    expires_at = datetime.now(UTC) + timedelta(minutes=ttl_minutes)

    offer = await offer_repo.submit_offer(
        db,
        case_id=case.id,
        technician_id=user.id,
        amount=payload.amount,
        eta_minutes=payload.eta_minutes,
        headline=payload.headline,
        description=payload.description,
        delivery_mode=payload.delivery_mode,
        warranty_label=payload.warranty_label,
        currency=payload.currency,
        available_at_label=payload.available_at_label,
        badges=payload.badges,
        expires_at=expires_at,
    )
    if payload.slot_proposal:
        offer.slot_proposal = payload.slot_proposal
    offer.slot_is_firm = payload.slot_is_firm
    await db.flush()

    # Case henüz matching ise offers_ready'ye geçir (ilk teklifte)
    if case.status == ServiceCaseStatus.MATCHING:
        case.status = ServiceCaseStatus.OFFERS_READY

    # B-P1-10: OFFER_RECEIVED emit — FE timeline "yeni teklif geldi".
    await append_event(
        db,
        case_id=case.id,
        event_type=CaseEventType.OFFER_RECEIVED,
        title="Yeni teklif geldi",
        tone=CaseTone.INFO,
        actor_user_id=user.id,
        context={
            "offer_id": str(offer.id),
            "technician_id": str(user.id),
            "amount": str(payload.amount),
        },
    )

    await db.commit()
    return OfferResponse.model_validate(offer)


@router.get(
    "/case/{case_id}",
    response_model=list[OfferResponse],
    summary="Vakanın teklifleri (case owner + admin)",
)
async def list_offers_for_case_endpoint(
    case_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
) -> list[OfferResponse]:
    case = await db.get(ServiceCase, case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(status_code=404, detail={"type": "case_not_found"})
    if case.customer_user_id != user.id and user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail={"type": "not_case_owner"}
        )
    offers = await offer_repo.list_offers_for_case(db, case_id)
    return [OfferResponse.model_validate(o) for o in offers]


@router.get(
    "/me",
    response_model=PaginatedResponse[OfferResponse],
    summary="Teknisyenin teklifleri (cursor paginated)",
)
async def list_my_offers_endpoint(
    user: CurrentTechnicianDep,
    db: DbDep,
    cursor: CursorQuery = None,
    limit: LimitQuery = 20,
    status_in: Annotated[
        list[CaseOfferStatus] | None,
        Query(description="Filter by status"),
    ] = None,
) -> PaginatedResponse[OfferResponse]:
    cursor_data = decode_cursor(cursor)
    conds = [CaseOffer.technician_id == user.id]
    if status_in:
        conds.append(CaseOffer.status.in_(status_in))
    if cursor_data is not None:
        last_sort = cursor_data.get("sort")
        if isinstance(last_sort, str):
            conds.append(CaseOffer.submitted_at < __import__("datetime").datetime.fromisoformat(last_sort))

    stmt = (
        select(CaseOffer)
        .where(and_(*conds))
        .order_by(CaseOffer.submitted_at.desc())
        .limit(limit + 1)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    items = [OfferResponse.model_validate(o) for o in rows]
    return build_paginated(
        items,
        limit=limit,
        cursor_fn=lambda o: encode_cursor(id_=o.id, sort_value=next(
            r.submitted_at for r in rows if r.id == o.id
        )),
    )


@router.post(
    "/{offer_id}/accept",
    response_model=OfferResponse,
    summary="Teklif kabul (müşteri — atomic)",
)
async def accept_offer_endpoint(
    offer_id: UUID,
    user: CurrentCustomerDep,
    db: DbDep,
) -> OfferResponse:
    offer = await offer_repo.get_offer(db, offer_id)
    if offer is None:
        raise HTTPException(status_code=404, detail={"type": "offer_not_found"})
    case = await db.get(ServiceCase, offer.case_id)
    if case is None or case.customer_user_id != user.id:
        raise HTTPException(status_code=403, detail={"type": "not_case_owner"})

    try:
        accepted = await offer_acceptance.accept_offer(
            db, offer_id, actor_user_id=user.id
        )
    except offer_acceptance.OfferNotFoundError as exc:
        raise HTTPException(
            status_code=404, detail={"type": "offer_not_found"}
        ) from exc
    except offer_acceptance.OfferNotAcceptableError as exc:
        raise HTTPException(
            status_code=410,
            detail={
                "type": "offer_already_accepted_or_rejected",
                "message": str(exc),
            },
        ) from exc
    except offer_acceptance.OfferSlotInvalidError as exc:
        raise HTTPException(
            status_code=422,
            detail={"type": "offer_slot_invalid", "message": str(exc)},
        ) from exc

    await db.commit()
    return OfferResponse.model_validate(accepted)


@router.post(
    "/{offer_id}/shortlist",
    response_model=OfferResponse,
    summary="Teklifi kısa listeye al (müşteri)",
)
async def shortlist_offer_endpoint(
    offer_id: UUID,
    payload: OfferShortlistPayload,
    user: CurrentCustomerDep,
    db: DbDep,
) -> OfferResponse:
    """pending → shortlisted. Parallel shortlist OK — aynı case için
    birden fazla usta kısa listeye alınabilir. Accept anında rakipler
    otomatik rejected (offer_acceptance.accept_offer).

    V1'de `payload.note` ignore; V1.1 analytics için saklanır.
    """
    _ = payload  # V1 pilot: body içeriği ignore — PO karar
    offer = await offer_repo.get_offer(db, offer_id)
    if offer is None:
        raise HTTPException(
            status_code=404, detail={"type": "offer_not_found"}
        )
    case = await db.get(ServiceCase, offer.case_id)
    if case is None or case.customer_user_id != user.id:
        raise HTTPException(
            status_code=403, detail={"type": "not_case_owner"}
        )
    if offer.status != CaseOfferStatus.PENDING:
        raise HTTPException(
            status_code=409,
            detail={
                "type": "offer_not_shortlistable",
                "current_status": offer.status.value,
            },
        )
    await offer_repo.shortlist_offer(db, offer_id)
    await db.commit()
    await db.refresh(offer)
    return OfferResponse.model_validate(offer)


@router.post(
    "/{offer_id}/reject",
    response_model=OfferResponse,
    summary="Teklifi reddet (müşteri)",
)
async def reject_offer_endpoint(
    offer_id: UUID,
    payload: OfferCustomerRejectPayload,
    user: CurrentCustomerDep,
    db: DbDep,
) -> OfferResponse:
    """pending/shortlisted → rejected. Customer-side reject; usta
    `withdraw` ayrı flow. ACCEPTED → 409 (accepted offer reddedilemez).

    V1'de `payload.reason` ignore; V1.1 analytics için saklanır
    (PO karar — cancellation_reason store).
    """
    _ = payload  # V1 pilot: body içeriği ignore — PO karar
    offer = await offer_repo.get_offer(db, offer_id)
    if offer is None:
        raise HTTPException(
            status_code=404, detail={"type": "offer_not_found"}
        )
    case = await db.get(ServiceCase, offer.case_id)
    if case is None or case.customer_user_id != user.id:
        raise HTTPException(
            status_code=403, detail={"type": "not_case_owner"}
        )
    if offer.status not in (
        CaseOfferStatus.PENDING,
        CaseOfferStatus.SHORTLISTED,
    ):
        raise HTTPException(
            status_code=409,
            detail={
                "type": "offer_not_rejectable",
                "current_status": offer.status.value,
            },
        )
    await offer_repo.customer_reject_offer(db, offer_id)
    # B-P1-10: OFFER_REJECTED emit — customer tarafından red.
    await append_event(
        db,
        case_id=offer.case_id,
        event_type=CaseEventType.OFFER_REJECTED,
        title="Teklif reddedildi",
        tone=CaseTone.WARNING,
        actor_user_id=user.id,
        context={"offer_id": str(offer_id), "by": "customer"},
    )
    await db.commit()
    await db.refresh(offer)
    return OfferResponse.model_validate(offer)


@router.post(
    "/{offer_id}/withdraw",
    response_model=OfferResponse,
    summary="Teklif geri çek (teknisyen)",
)
async def withdraw_offer_endpoint(
    offer_id: UUID,
    payload: OfferWithdrawPayload,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> OfferResponse:
    offer = await offer_repo.get_offer(db, offer_id)
    if offer is None:
        raise HTTPException(status_code=404, detail={"type": "offer_not_found"})
    if offer.technician_id != user.id:
        raise HTTPException(
            status_code=403, detail={"type": "not_offer_owner"}
        )
    if offer.status not in (
        CaseOfferStatus.PENDING,
        CaseOfferStatus.SHORTLISTED,
    ):
        raise HTTPException(
            status_code=409,
            detail={
                "type": "offer_not_withdrawable",
                "current_status": offer.status.value,
            },
        )
    await offer_repo.withdraw_offer(db, offer_id, technician_id=user.id)
    # B-P1-10: OFFER_WITHDRAWN emit — teknisyen geri çekti.
    await append_event(
        db,
        case_id=offer.case_id,
        event_type=CaseEventType.OFFER_WITHDRAWN,
        title="Teklif geri çekildi",
        tone=CaseTone.NEUTRAL,
        actor_user_id=user.id,
        context={"offer_id": str(offer_id), "by": "technician"},
    )
    await db.commit()
    await db.refresh(offer)
    return OfferResponse.model_validate(offer)


# ─── Helpers ────────────────────────────────────────────────────────────────


async def _get_technician_profile(
    db: AsyncSession, user_id: UUID
) -> TechnicianProfile | None:
    stmt = select(TechnicianProfile).where(TechnicianProfile.user_id == user_id)
    result: TechnicianProfile | None = (
        await db.execute(stmt)
    ).scalar_one_or_none()
    return result


async def _count_active_offers(db: AsyncSession, case_id: UUID) -> int:
    stmt = select(CaseOffer).where(
        and_(
            CaseOffer.case_id == case_id,
            CaseOffer.status.in_(
                (CaseOfferStatus.PENDING, CaseOfferStatus.SHORTLISTED)
            ),
        )
    )
    return len(list((await db.execute(stmt)).scalars().all()))
