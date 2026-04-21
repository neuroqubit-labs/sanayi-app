"""Technician KYC service — derived verified_level recomputation.

Sertifika status değişikliği sonrası `technician_profiles.verified_level` bu
servis ile güncellenir. Repository CRUD'dan sonra çağrılır (tek transaction
veya worker job olarak).
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.technician import (
    TechnicianCertificate,
    TechnicianCertificateKind,
    TechnicianCertificateStatus,
    TechnicianProfile,
    TechnicianVerifiedLevel,
)


def _compute_level(approved_kinds: set[TechnicianCertificateKind]) -> TechnicianVerifiedLevel:
    has_identity = TechnicianCertificateKind.IDENTITY in approved_kinds
    has_tax = TechnicianCertificateKind.TAX_REGISTRATION in approved_kinds
    has_trade = TechnicianCertificateKind.TRADE_REGISTRY in approved_kinds
    has_insurance = TechnicianCertificateKind.INSURANCE in approved_kinds
    has_technical = TechnicianCertificateKind.TECHNICAL in approved_kinds
    count = len(approved_kinds)

    if (
        count >= 5
        and has_identity
        and has_tax
        and has_trade
        and has_insurance
        and has_technical
    ):
        return TechnicianVerifiedLevel.PREMIUM
    if count >= 3 and has_identity and has_tax and has_trade:
        return TechnicianVerifiedLevel.VERIFIED
    return TechnicianVerifiedLevel.BASIC


async def recompute_verified_level(
    session: AsyncSession, profile_id: UUID
) -> TechnicianVerifiedLevel:
    now = datetime.now(UTC)
    stmt = select(TechnicianCertificate.kind).where(
        TechnicianCertificate.profile_id == profile_id,
        TechnicianCertificate.status == TechnicianCertificateStatus.APPROVED,
        (TechnicianCertificate.expires_at.is_(None))
        | (TechnicianCertificate.expires_at > now),
    )
    approved: set[TechnicianCertificateKind] = set(
        (await session.execute(stmt)).scalars().all()
    )
    level = _compute_level(approved)
    await session.execute(
        update(TechnicianProfile)
        .where(TechnicianProfile.id == profile_id)
        .values(verified_level=level)
    )
    return level
