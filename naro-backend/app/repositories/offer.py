"""CaseOffer repository — submit, withdraw, accept, reject, list.

Atomic acceptance (`accept_offer` + case transition + kardeşleri reject) için
bkz: `app/services/offer_acceptance.py`. Burada yalnızca tekil CRUD + query.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import CursorResult, and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.offer import CaseOffer, CaseOfferStatus


async def get_offer(
    session: AsyncSession, offer_id: UUID
) -> CaseOffer | None:
    return await session.get(CaseOffer, offer_id)


async def submit_offer(
    session: AsyncSession,
    *,
    case_id: UUID,
    technician_id: UUID,
    amount: Decimal,
    eta_minutes: int,
    headline: str,
    description: str | None,
    delivery_mode: str,
    warranty_label: str,
    currency: str = "TRY",
    available_at_label: str | None = None,
    badges: list[str] | None = None,
    expires_at: datetime | None = None,
) -> CaseOffer:
    offer = CaseOffer(
        case_id=case_id,
        technician_id=technician_id,
        headline=headline,
        description=description,
        amount=amount,
        currency=currency,
        eta_minutes=eta_minutes,
        delivery_mode=delivery_mode,
        warranty_label=warranty_label,
        available_at_label=available_at_label,
        badges=list(badges or []),
        expires_at=expires_at,
    )
    session.add(offer)
    await session.flush()
    return offer


async def withdraw_offer(
    session: AsyncSession, offer_id: UUID, *, technician_id: UUID
) -> None:
    await session.execute(
        update(CaseOffer)
        .where(
            and_(
                CaseOffer.id == offer_id,
                CaseOffer.technician_id == technician_id,
                CaseOffer.status.in_(
                    (
                        CaseOfferStatus.PENDING,
                        CaseOfferStatus.SHORTLISTED,
                    )
                ),
            )
        )
        .values(status=CaseOfferStatus.WITHDRAWN)
    )


async def reject_offer(session: AsyncSession, offer_id: UUID) -> None:
    await session.execute(
        update(CaseOffer)
        .where(CaseOffer.id == offer_id)
        .values(
            status=CaseOfferStatus.REJECTED,
            rejected_at=datetime.now(UTC),
        )
    )


async def mark_accepted(session: AsyncSession, offer_id: UUID) -> None:
    """Düşük seviye — service `offer_acceptance.accept_offer` bunu çağırır."""
    await session.execute(
        update(CaseOffer)
        .where(CaseOffer.id == offer_id)
        .values(
            status=CaseOfferStatus.ACCEPTED,
            accepted_at=datetime.now(UTC),
        )
    )


async def list_offers_for_case(
    session: AsyncSession, case_id: UUID
) -> list[CaseOffer]:
    stmt = (
        select(CaseOffer)
        .where(CaseOffer.case_id == case_id)
        .order_by(CaseOffer.amount, CaseOffer.submitted_at)
    )
    return list((await session.execute(stmt)).scalars().all())


async def my_offer_for_case(
    session: AsyncSession, case_id: UUID, technician_id: UUID
) -> CaseOffer | None:
    stmt = select(CaseOffer).where(
        and_(
            CaseOffer.case_id == case_id,
            CaseOffer.technician_id == technician_id,
            CaseOffer.status.in_(
                (
                    CaseOfferStatus.PENDING,
                    CaseOfferStatus.SHORTLISTED,
                    CaseOfferStatus.ACCEPTED,
                )
            ),
        )
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_offers_for_technician(
    session: AsyncSession,
    technician_id: UUID,
    *,
    status_in: list[CaseOfferStatus] | None = None,
) -> list[CaseOffer]:
    conds = [CaseOffer.technician_id == technician_id]
    if status_in:
        conds.append(CaseOffer.status.in_(status_in))
    stmt = (
        select(CaseOffer)
        .where(and_(*conds))
        .order_by(CaseOffer.submitted_at.desc())
    )
    return list((await session.execute(stmt)).scalars().all())


async def list_siblings_for_case(
    session: AsyncSession, case_id: UUID, *, exclude_id: UUID
) -> list[CaseOffer]:
    stmt = select(CaseOffer).where(
        and_(
            CaseOffer.case_id == case_id,
            CaseOffer.id != exclude_id,
            CaseOffer.status.in_(
                (CaseOfferStatus.PENDING, CaseOfferStatus.SHORTLISTED)
            ),
        )
    )
    return list((await session.execute(stmt)).scalars().all())


async def expire_stale_offers(
    session: AsyncSession, *, before: datetime | None = None
) -> int:
    """Cron: pending + expires_at <= NOW → expired. Etkilenen row sayısı."""
    threshold = before or datetime.now(UTC)
    result: CursorResult[object] = await session.execute(  # type: ignore[assignment]
        update(CaseOffer)
        .where(
            and_(
                CaseOffer.status == CaseOfferStatus.PENDING,
                CaseOffer.expires_at.is_not(None),
                CaseOffer.expires_at <= threshold,
            )
        )
        .values(status=CaseOfferStatus.EXPIRED)
    )
    return int(result.rowcount or 0)
