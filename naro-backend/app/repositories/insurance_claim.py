"""Insurance claim repository — CRUD + status-aware query helpers.

State transitions `app/services/insurance_claim_flow.py`'ta; burada yalnızca
satır-level operasyonlar.
"""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.insurance_claim import (
    ACTIVE_CLAIM_STATUSES,
    InsuranceClaim,
    InsuranceClaimStatus,
    InsuranceCoverageKind,
)


async def get_claim(
    session: AsyncSession, claim_id: UUID
) -> InsuranceClaim | None:
    return await session.get(InsuranceClaim, claim_id)


async def get_active_claim_for_case(
    session: AsyncSession, case_id: UUID
) -> InsuranceClaim | None:
    """Aktif (submitted/accepted/paid) dosya — partial unique sağlar."""
    stmt = select(InsuranceClaim).where(
        and_(
            InsuranceClaim.case_id == case_id,
            InsuranceClaim.status.in_(ACTIVE_CLAIM_STATUSES),
        )
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_claims_for_case(
    session: AsyncSession, case_id: UUID
) -> list[InsuranceClaim]:
    """Tarihsel dahil — rejected olanlar da dahil, en yeni önce."""
    stmt = (
        select(InsuranceClaim)
        .where(InsuranceClaim.case_id == case_id)
        .order_by(InsuranceClaim.submitted_at.desc())
    )
    return list((await session.execute(stmt)).scalars().all())


async def insert_submitted(
    session: AsyncSession,
    *,
    case_id: UUID,
    policy_number: str,
    insurer: str,
    coverage_kind: InsuranceCoverageKind,
    estimate_amount: Decimal | None = None,
    policy_holder_name: str | None = None,
    policy_holder_phone: str | None = None,
    currency: str = "TRY",
    notes: str | None = None,
    insurer_claim_reference: str | None = None,
    created_by_user_id: UUID | None = None,
    created_by_snapshot_name: str | None = None,
) -> InsuranceClaim:
    """Karar [K1]: direkt `submitted` olarak insert — drafted yok."""
    claim = InsuranceClaim(
        case_id=case_id,
        policy_number=policy_number,
        insurer=insurer,
        coverage_kind=coverage_kind,
        estimate_amount=estimate_amount,
        policy_holder_name=policy_holder_name,
        policy_holder_phone=policy_holder_phone,
        currency=currency,
        notes=notes,
        insurer_claim_reference=insurer_claim_reference,
        created_by_user_id=created_by_user_id,
        created_by_snapshot_name=created_by_snapshot_name,
        status=InsuranceClaimStatus.SUBMITTED,
    )
    session.add(claim)
    await session.flush()
    return claim


async def list_pending_acceptance(
    session: AsyncSession, *, limit: int = 100
) -> list[InsuranceClaim]:
    """Admin/insurer dashboard — sigortadan onay bekleyenler."""
    stmt = (
        select(InsuranceClaim)
        .where(InsuranceClaim.status == InsuranceClaimStatus.SUBMITTED)
        .order_by(InsuranceClaim.submitted_at.asc())
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars().all())
