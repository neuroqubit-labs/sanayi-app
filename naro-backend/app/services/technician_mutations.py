"""Technician mutation cascade services (PR 4 Gün 3).

Coverage atomic replace + service area upsert + schedule replace + capacity
upsert + provider-mode transition + switch-active-role + cert upload/resubmit.

Her mutation'da `bump_role_config_version` + admission recompute cascade.
Brief §7 race senaryoları: serializable isolation + atomic UPDATE pattern.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, time
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import and_, delete, or_, select, update

from app.models.technician import (
    ProviderMode,
    ProviderType,
    TechnicianAvailability,
    TechnicianCertificate,
    TechnicianCertificateKind,
    TechnicianCertificateStatus,
    TechnicianProfile,
)
from app.models.technician_signal import (
    TechnicianBrandCoverage,
    TechnicianCapacity,
    TechnicianDrivetrainCoverage,
    TechnicianProcedure,
    TechnicianProcedureTag,
    TechnicianServiceArea,
    TechnicianServiceDomain,
    TechnicianWorkingDistrict,
    TechnicianWorkingSchedule,
)
from app.models.user import User, UserApprovalStatus
from app.services.technician_admission import (
    bump_role_config_version,
    force_availability_offline,
    recompute_admission,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


# ─── Domain errors ─────────────────────────────────────────────────────────


class InvalidActiveRoleError(Exception):
    """I-PR4-1: target active_provider_type legal roles içinde değil (422)."""


class InvalidProviderModeError(Exception):
    """I-PR4-11: side_gig kabul edilmez (422); ya da invalid transition."""


class CertResubmitInvalidError(Exception):
    """Resubmit sadece rejected cert'e uygulanabilir (409)."""


# ─── Value object'ler ──────────────────────────────────────────────────────


@dataclass(slots=True)
class ProcedureBinding:
    procedure_key: str
    confidence_self_declared: Decimal = Decimal("1.00")


@dataclass(slots=True)
class BrandBinding:
    brand_key: str
    is_authorized: bool = False
    is_premium_authorized: bool = False
    notes: str | None = None


@dataclass(slots=True)
class CoverageInput:
    service_domains: list[str]
    procedures: list[ProcedureBinding]
    procedure_tags: list[str]
    brand_coverage: list[BrandBinding]
    drivetrain_coverage: list[str]


@dataclass(slots=True)
class ServiceAreaInput:
    workshop_lat: Decimal
    workshop_lng: Decimal
    service_radius_km: int
    city_code: str
    primary_district_id: UUID | None
    working_districts: list[UUID]
    mobile_unit_count: int = 0
    workshop_address: str | None = None


@dataclass(slots=True)
class ScheduleSlotInput:
    weekday: int  # 0-6
    open_time: time | None
    close_time: time | None
    is_closed: bool = False
    slot_order: int = 0


@dataclass(slots=True)
class CapacityInput:
    staff_count: int
    max_concurrent_jobs: int
    night_service: bool = False
    weekend_service: bool = False
    emergency_service: bool = False


# ─── Coverage atomic replace (brief §7.1) ──────────────────────────────────


async def replace_coverage(
    session: AsyncSession,
    *,
    profile_id: UUID,
    payload: CoverageInput,
) -> None:
    """5 alt-tablo delete+insert tek transaction (I-PR4-7)."""
    # DELETE eski rowlar
    await session.execute(
        delete(TechnicianServiceDomain).where(
            TechnicianServiceDomain.profile_id == profile_id
        )
    )
    await session.execute(
        delete(TechnicianProcedure).where(
            TechnicianProcedure.profile_id == profile_id
        )
    )
    await session.execute(
        delete(TechnicianProcedureTag).where(
            TechnicianProcedureTag.profile_id == profile_id
        )
    )
    await session.execute(
        delete(TechnicianBrandCoverage).where(
            TechnicianBrandCoverage.profile_id == profile_id
        )
    )
    await session.execute(
        delete(TechnicianDrivetrainCoverage).where(
            TechnicianDrivetrainCoverage.profile_id == profile_id
        )
    )

    # INSERT yeni rowlar
    for domain_key in payload.service_domains:
        session.add(
            TechnicianServiceDomain(
                profile_id=profile_id, domain_key=domain_key
            )
        )
    for proc in payload.procedures:
        session.add(
            TechnicianProcedure(
                profile_id=profile_id,
                procedure_key=proc.procedure_key,
                confidence_self_declared=proc.confidence_self_declared,
            )
        )
    seen_tags: set[str] = set()
    for tag in payload.procedure_tags:
        normalized = tag.strip().lower()
        if not normalized or normalized in seen_tags:
            continue
        seen_tags.add(normalized)
        session.add(
            TechnicianProcedureTag(
                profile_id=profile_id, tag=tag, tag_normalized=normalized
            )
        )
    for brand in payload.brand_coverage:
        session.add(
            TechnicianBrandCoverage(
                profile_id=profile_id,
                brand_key=brand.brand_key,
                is_authorized=brand.is_authorized,
                is_premium_authorized=brand.is_premium_authorized,
                notes=brand.notes,
            )
        )
    for drivetrain_key in payload.drivetrain_coverage:
        session.add(
            TechnicianDrivetrainCoverage(
                profile_id=profile_id, drivetrain_key=drivetrain_key
            )
        )
    await session.flush()

    # Cascade: admission recompute + bump
    admission = await recompute_admission(session, profile_id)
    if not admission.passed:
        await force_availability_offline(session, profile_id)
    await bump_role_config_version(session, profile_id)


# ─── Service area + working districts ──────────────────────────────────────


async def upsert_service_area(
    session: AsyncSession,
    *,
    profile_id: UUID,
    payload: ServiceAreaInput,
) -> None:
    existing = await session.get(TechnicianServiceArea, profile_id)
    if existing is None:
        session.add(
            TechnicianServiceArea(
                profile_id=profile_id,
                workshop_lat=payload.workshop_lat,
                workshop_lng=payload.workshop_lng,
                service_radius_km=payload.service_radius_km,
                city_code=payload.city_code,
                primary_district_id=payload.primary_district_id,
                mobile_unit_count=payload.mobile_unit_count,
                workshop_address=payload.workshop_address,
            )
        )
    else:
        existing.workshop_lat = payload.workshop_lat
        existing.workshop_lng = payload.workshop_lng
        existing.service_radius_km = payload.service_radius_km
        existing.city_code = payload.city_code
        existing.primary_district_id = payload.primary_district_id
        existing.mobile_unit_count = payload.mobile_unit_count
        existing.workshop_address = payload.workshop_address
        existing.updated_at = datetime.now(UTC)

    # Districts atomic replace
    await session.execute(
        delete(TechnicianWorkingDistrict).where(
            TechnicianWorkingDistrict.profile_id == profile_id
        )
    )
    for district_id in payload.working_districts:
        session.add(
            TechnicianWorkingDistrict(
                profile_id=profile_id, district_id=district_id
            )
        )
    await session.flush()

    admission = await recompute_admission(session, profile_id)
    if not admission.passed:
        await force_availability_offline(session, profile_id)
    await bump_role_config_version(session, profile_id)


# ─── Schedule replace ──────────────────────────────────────────────────────


async def replace_schedule(
    session: AsyncSession,
    *,
    profile_id: UUID,
    slots: list[ScheduleSlotInput],
) -> None:
    """Brief §7.3 — weekly grid delete+insert atomic."""
    await session.execute(
        delete(TechnicianWorkingSchedule).where(
            TechnicianWorkingSchedule.profile_id == profile_id
        )
    )
    for slot in slots:
        session.add(
            TechnicianWorkingSchedule(
                profile_id=profile_id,
                weekday=slot.weekday,
                open_time=slot.open_time,
                close_time=slot.close_time,
                is_closed=slot.is_closed,
                slot_order=slot.slot_order,
            )
        )
    await session.flush()

    admission = await recompute_admission(session, profile_id)
    if not admission.passed:
        await force_availability_offline(session, profile_id)
    await bump_role_config_version(session, profile_id)


# ─── Capacity upsert ───────────────────────────────────────────────────────


async def upsert_capacity(
    session: AsyncSession,
    *,
    profile_id: UUID,
    payload: CapacityInput,
) -> None:
    existing = await session.get(TechnicianCapacity, profile_id)
    if existing is None:
        session.add(
            TechnicianCapacity(
                profile_id=profile_id,
                staff_count=payload.staff_count,
                max_concurrent_jobs=payload.max_concurrent_jobs,
                night_service=payload.night_service,
                weekend_service=payload.weekend_service,
                emergency_service=payload.emergency_service,
            )
        )
    else:
        existing.staff_count = payload.staff_count
        existing.max_concurrent_jobs = payload.max_concurrent_jobs
        existing.night_service = payload.night_service
        existing.weekend_service = payload.weekend_service
        existing.emergency_service = payload.emergency_service
        existing.updated_at = datetime.now(UTC)
    await session.flush()
    await bump_role_config_version(session, profile_id)


# ─── Provider mode transition (büyük cascade — brief §7.5) ─────────────────


async def switch_provider_mode(
    session: AsyncSession,
    *,
    profile_id: UUID,
    new_mode: ProviderMode,
) -> ProviderModeTransitionResult:
    """provider_mode değişimi — admission recompute + offline force + bump.

    Eksik cert nedeniyle admission fail → users.approval_status='pending' +
    availability='offline'. Mobil onboarding re-trigger (UI required_onboarding
    steps listeler).
    """
    profile = await session.get(TechnicianProfile, profile_id)
    if profile is None:
        raise InvalidProviderModeError("profile_not_found")
    old_mode = profile.provider_mode
    if old_mode == new_mode:
        # No-op
        return ProviderModeTransitionResult(
            profile_id=profile_id,
            old_mode=old_mode,
            new_mode=new_mode,
            admission_passed=True,
            approval_status_changed=False,
            availability_forced_offline=False,
        )

    profile.provider_mode = new_mode
    await session.flush()

    admission = await recompute_admission(session, profile_id)

    approval_status_changed = False
    availability_forced_offline = False

    if not admission.passed:
        # approval_status=pending + availability=offline force
        user = await session.get(User, profile.user_id)
        if (
            user is not None
            and user.approval_status
            and user.approval_status == UserApprovalStatus.ACTIVE
        ):
            user.approval_status = UserApprovalStatus.PENDING
            approval_status_changed = True
        if profile.availability != TechnicianAvailability.OFFLINE:
            await force_availability_offline(session, profile_id)
            availability_forced_offline = True

    await bump_role_config_version(session, profile_id)

    return ProviderModeTransitionResult(
        profile_id=profile_id,
        old_mode=old_mode,
        new_mode=new_mode,
        admission_passed=admission.passed,
        approval_status_changed=approval_status_changed,
        availability_forced_offline=availability_forced_offline,
    )


@dataclass(slots=True, frozen=True)
class ProviderModeTransitionResult:
    profile_id: UUID
    old_mode: ProviderMode
    new_mode: ProviderMode
    admission_passed: bool
    approval_status_changed: bool
    availability_forced_offline: bool


# ─── Switch active role (brief §6 + §7.4) ──────────────────────────────────


async def switch_active_role(
    session: AsyncSession,
    *,
    profile_id: UUID,
    target_provider_type: ProviderType,
) -> None:
    """Optimistic UPDATE pattern — DB constraint + service friendly error."""
    # Legal kontrol: target primary OR secondary olmalı
    result = await session.execute(
        update(TechnicianProfile)
        .where(
            and_(
                TechnicianProfile.id == profile_id,
                or_(
                    TechnicianProfile.provider_type == target_provider_type,
                    TechnicianProfile.secondary_provider_types.contains(
                        [target_provider_type]
                    ),
                ),
            )
        )
        .values(active_provider_type=target_provider_type)
        .returning(TechnicianProfile.id)
    )
    updated_id = result.scalar_one_or_none()
    if updated_id is None:
        raise InvalidActiveRoleError(
            f"target {target_provider_type.value} not in primary or secondary roles"
        )
    await bump_role_config_version(session, profile_id)


# ─── Certificate upload + resubmit ─────────────────────────────────────────


async def submit_certificate(
    session: AsyncSession,
    *,
    profile_id: UUID,
    kind: TechnicianCertificateKind,
    title: str,
    media_asset_id: UUID | None,
    expires_at: datetime | None = None,
) -> TechnicianCertificate:
    cert = TechnicianCertificate(
        profile_id=profile_id,
        kind=kind,
        title=title,
        media_asset_id=media_asset_id,
        expires_at=expires_at,
        status=TechnicianCertificateStatus.PENDING,
    )
    session.add(cert)
    await session.flush()
    # Upload anında admission değişmez (pending). Admin approve cascade PR 9.
    return cert


async def resubmit_certificate(
    session: AsyncSession,
    *,
    cert_id: UUID,
    media_asset_id: UUID,
    title: str | None = None,
) -> TechnicianCertificate:
    """Rejected cert için yeni media ile PENDING'e döndür."""
    cert = await session.get(TechnicianCertificate, cert_id)
    if cert is None:
        raise CertResubmitInvalidError(f"certificate {cert_id} not found")
    if cert.status != TechnicianCertificateStatus.REJECTED:
        raise CertResubmitInvalidError(
            f"resubmit only for rejected certs; current={cert.status.value}"
        )
    cert.media_asset_id = media_asset_id
    if title is not None:
        cert.title = title
    cert.status = TechnicianCertificateStatus.PENDING
    cert.reviewer_note = None
    cert.verified_at = None
    await session.flush()
    return cert


# ─── Read helpers for shell config cache ──────────────────────────────────


async def load_coverage_snapshot(
    session: AsyncSession, profile_id: UUID
) -> dict[str, list[str]]:
    """Kısa summary — coverage endpoint'in response'unda kullanılır."""
    domains_stmt = select(TechnicianServiceDomain.domain_key).where(
        TechnicianServiceDomain.profile_id == profile_id
    )
    procedures_stmt = select(TechnicianProcedure.procedure_key).where(
        TechnicianProcedure.profile_id == profile_id
    )
    brands_stmt = select(TechnicianBrandCoverage.brand_key).where(
        TechnicianBrandCoverage.profile_id == profile_id
    )
    drivetrains_stmt = select(TechnicianDrivetrainCoverage.drivetrain_key).where(
        TechnicianDrivetrainCoverage.profile_id == profile_id
    )
    tags_stmt = select(TechnicianProcedureTag.tag).where(
        TechnicianProcedureTag.profile_id == profile_id
    )
    return {
        "service_domains": [r[0] for r in (await session.execute(domains_stmt)).all()],
        "procedures": [r[0] for r in (await session.execute(procedures_stmt)).all()],
        "brand_coverage": [r[0] for r in (await session.execute(brands_stmt)).all()],
        "drivetrain_coverage": [
            r[0] for r in (await session.execute(drivetrains_stmt)).all()
        ],
        "procedure_tags": [r[0] for r in (await session.execute(tags_stmt)).all()],
    }
