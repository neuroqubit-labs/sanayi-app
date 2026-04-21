"""Technician repository — profile, capability, specialty, certificate, gallery.

KYC lifecycle iş akışları (`recompute_verified_level` gibi) service katmanına
(`app/services/technician_kyc.py`) taşınır; burada sadece CRUD + query helpers.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import and_, delete, select, update
from sqlalchemy.dialects.postgresql import array
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.technician import (
    GalleryItemKind,
    ProviderType,
    TechnicianAvailability,
    TechnicianCapability,
    TechnicianCertificate,
    TechnicianCertificateKind,
    TechnicianCertificateStatus,
    TechnicianGalleryItem,
    TechnicianProfile,
    TechnicianSpecialty,
    TechnicianSpecialtyKind,
)

# ─── Profile ────────────────────────────────────────────────────────────────


async def get_profile_by_user_id(
    session: AsyncSession, user_id: UUID
) -> TechnicianProfile | None:
    stmt = select(TechnicianProfile).where(
        and_(
            TechnicianProfile.user_id == user_id,
            TechnicianProfile.deleted_at.is_(None),
        )
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_profile(
    session: AsyncSession, profile_id: UUID
) -> TechnicianProfile | None:
    return await session.get(TechnicianProfile, profile_id)


async def create_profile(
    session: AsyncSession,
    *,
    user_id: UUID,
    display_name: str,
    provider_type: ProviderType,
    secondary_provider_types: list[ProviderType] | None = None,
    tagline: str | None = None,
    biography: str | None = None,
    working_hours: str | None = None,
    area_label: str | None = None,
    business_info: dict[str, object] | None = None,
    avatar_asset_id: UUID | None = None,
    promo_video_asset_id: UUID | None = None,
) -> TechnicianProfile:
    """Profile + capability satırlarını tek transaction'da yaratır."""
    profile = TechnicianProfile(
        user_id=user_id,
        display_name=display_name,
        provider_type=provider_type,
        secondary_provider_types=list(secondary_provider_types or []),
        tagline=tagline,
        biography=biography,
        working_hours=working_hours,
        area_label=area_label,
        business_info=business_info or {},
        avatar_asset_id=avatar_asset_id,
        promo_video_asset_id=promo_video_asset_id,
    )
    session.add(profile)
    await session.flush()

    capability = TechnicianCapability(profile_id=profile.id)
    session.add(capability)
    await session.flush()
    return profile


async def update_availability(
    session: AsyncSession,
    profile_id: UUID,
    availability: TechnicianAvailability,
) -> None:
    await session.execute(
        update(TechnicianProfile)
        .where(TechnicianProfile.id == profile_id)
        .values(availability=availability)
    )


async def soft_delete_profile(
    session: AsyncSession, profile_id: UUID
) -> None:
    await session.execute(
        update(TechnicianProfile)
        .where(TechnicianProfile.id == profile_id)
        .values(deleted_at=datetime.now(UTC))
    )


async def list_active_technicians_for_pool(
    session: AsyncSession,
    *,
    provider_type: ProviderType,
    limit: int = 50,
) -> list[TechnicianProfile]:
    """Havuz feed için müsait (available) teknisyenler.

    Birincil + ikincil provider_type match eder.
    """
    stmt = (
        select(TechnicianProfile)
        .where(
            and_(
                TechnicianProfile.deleted_at.is_(None),
                TechnicianProfile.availability == TechnicianAvailability.AVAILABLE,
                (
                    (TechnicianProfile.provider_type == provider_type)
                    | TechnicianProfile.secondary_provider_types.overlap(
                        array([provider_type.value])
                    )
                ),
            )
        )
        .order_by(TechnicianProfile.updated_at.desc())
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars().all())


# ─── Capability ─────────────────────────────────────────────────────────────


async def get_capability(
    session: AsyncSession, profile_id: UUID
) -> TechnicianCapability | None:
    return await session.get(TechnicianCapability, profile_id)


async def update_capability(
    session: AsyncSession,
    profile_id: UUID,
    **flags: bool,
) -> None:
    allowed = {
        "insurance_case_handler",
        "on_site_repair",
        "valet_service",
        "towing_coordination",
    }
    updates = {k: v for k, v in flags.items() if k in allowed and v is not None}
    if not updates:
        return
    await session.execute(
        update(TechnicianCapability)
        .where(TechnicianCapability.profile_id == profile_id)
        .values(**updates)
    )


# ─── Specialty ──────────────────────────────────────────────────────────────


def _normalize_label(label: str) -> str:
    return label.strip().lower()


async def set_specialties(
    session: AsyncSession,
    profile_id: UUID,
    kind: TechnicianSpecialtyKind,
    labels: list[str],
) -> list[TechnicianSpecialty]:
    """Replace-all: mevcut (profile, kind) satırlarını sil, yeni labels'ı ekle."""
    await session.execute(
        delete(TechnicianSpecialty).where(
            and_(
                TechnicianSpecialty.profile_id == profile_id,
                TechnicianSpecialty.kind == kind.value,
            )
        )
    )
    rows: list[TechnicianSpecialty] = []
    seen: set[str] = set()
    for order, label in enumerate(labels):
        norm = _normalize_label(label)
        if not norm or norm in seen:
            continue
        seen.add(norm)
        row = TechnicianSpecialty(
            profile_id=profile_id,
            kind=kind.value,
            label=label,
            label_normalized=norm,
            display_order=order,
        )
        session.add(row)
        rows.append(row)
    await session.flush()
    return rows


async def list_specialties(
    session: AsyncSession,
    profile_id: UUID,
    kind: TechnicianSpecialtyKind | None = None,
) -> list[TechnicianSpecialty]:
    conds = [TechnicianSpecialty.profile_id == profile_id]
    if kind is not None:
        conds.append(TechnicianSpecialty.kind == kind.value)
    stmt = (
        select(TechnicianSpecialty)
        .where(and_(*conds))
        .order_by(TechnicianSpecialty.kind, TechnicianSpecialty.display_order)
    )
    return list((await session.execute(stmt)).scalars().all())


async def search_technicians_by_specialty(
    session: AsyncSession,
    query: str,
    *,
    limit: int = 20,
) -> list[TechnicianProfile]:
    """trgm substring search — label_normalized üzerinde ILIKE + trigram match."""
    q = _normalize_label(query)
    if not q:
        return []
    stmt = (
        select(TechnicianProfile)
        .join(TechnicianSpecialty, TechnicianSpecialty.profile_id == TechnicianProfile.id)
        .where(
            and_(
                TechnicianProfile.deleted_at.is_(None),
                TechnicianSpecialty.label_normalized.like(f"%{q}%"),
            )
        )
        .distinct()
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars().all())


# ─── Certificate ────────────────────────────────────────────────────────────


async def list_certificates(
    session: AsyncSession,
    profile_id: UUID,
    status: TechnicianCertificateStatus | None = None,
) -> list[TechnicianCertificate]:
    conds = [TechnicianCertificate.profile_id == profile_id]
    if status is not None:
        conds.append(TechnicianCertificate.status == status)
    stmt = (
        select(TechnicianCertificate)
        .where(and_(*conds))
        .order_by(TechnicianCertificate.uploaded_at.desc())
    )
    return list((await session.execute(stmt)).scalars().all())


async def add_certificate(
    session: AsyncSession,
    *,
    profile_id: UUID,
    kind: TechnicianCertificateKind,
    title: str,
    media_asset_id: UUID | None = None,
    file_url: str | None = None,
    mime_type: str | None = None,
    expires_at: datetime | None = None,
) -> TechnicianCertificate:
    row = TechnicianCertificate(
        profile_id=profile_id,
        kind=kind,
        title=title,
        media_asset_id=media_asset_id,
        file_url=file_url,
        mime_type=mime_type,
        expires_at=expires_at,
    )
    session.add(row)
    await session.flush()
    return row


async def update_certificate_status(
    session: AsyncSession,
    certificate_id: UUID,
    status: TechnicianCertificateStatus,
    *,
    reviewer_note: str | None = None,
) -> None:
    values: dict[str, object] = {"status": status, "reviewer_note": reviewer_note}
    if status == TechnicianCertificateStatus.APPROVED:
        values["verified_at"] = datetime.now(UTC)
    await session.execute(
        update(TechnicianCertificate)
        .where(TechnicianCertificate.id == certificate_id)
        .values(**values)
    )


async def list_expiring_certificates(
    session: AsyncSession, before: datetime
) -> list[TechnicianCertificate]:
    stmt = select(TechnicianCertificate).where(
        and_(
            TechnicianCertificate.status == TechnicianCertificateStatus.APPROVED,
            TechnicianCertificate.expires_at.is_not(None),
            TechnicianCertificate.expires_at <= before,
        )
    )
    return list((await session.execute(stmt)).scalars().all())


# ─── Gallery ────────────────────────────────────────────────────────────────


async def list_gallery(
    session: AsyncSession, profile_id: UUID
) -> list[TechnicianGalleryItem]:
    stmt = (
        select(TechnicianGalleryItem)
        .where(TechnicianGalleryItem.profile_id == profile_id)
        .order_by(TechnicianGalleryItem.display_order, TechnicianGalleryItem.created_at)
    )
    return list((await session.execute(stmt)).scalars().all())


async def add_gallery_item(
    session: AsyncSession,
    *,
    profile_id: UUID,
    kind: GalleryItemKind,
    media_asset_id: UUID,
    title: str | None = None,
    caption: str | None = None,
    display_order: int = 0,
) -> TechnicianGalleryItem:
    row = TechnicianGalleryItem(
        profile_id=profile_id,
        kind=kind,
        media_asset_id=media_asset_id,
        title=title,
        caption=caption,
        display_order=display_order,
    )
    session.add(row)
    await session.flush()
    return row


async def reorder_gallery(
    session: AsyncSession,
    profile_id: UUID,
    item_orders: list[tuple[UUID, int]],
) -> None:
    for item_id, order in item_orders:
        await session.execute(
            update(TechnicianGalleryItem)
            .where(
                and_(
                    TechnicianGalleryItem.id == item_id,
                    TechnicianGalleryItem.profile_id == profile_id,
                )
            )
            .values(display_order=order)
        )


async def delete_gallery_item(
    session: AsyncSession, item_id: UUID
) -> None:
    await session.execute(
        delete(TechnicianGalleryItem).where(TechnicianGalleryItem.id == item_id)
    )
