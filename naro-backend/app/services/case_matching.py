"""Case-technician match and notification orchestration."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case import ServiceCase, ServiceRequestKind
from app.models.case_matching import (
    CaseTechnicianMatch,
    CaseTechnicianMatchSource,
    CaseTechnicianMatchVisibility,
    CaseTechnicianNotification,
    CaseTechnicianNotificationStatus,
)
from app.models.offer import CaseOffer, CaseOfferStatus
from app.models.technician import ProviderType, TechnicianAvailability, TechnicianProfile
from app.models.technician_signal import TechnicianServiceArea, TechnicianServiceDomain
from app.services.pool_matching import KIND_PROVIDER_MAP, kinds_for_provider


def technician_matches_case_kind(
    case_kind: ServiceRequestKind, provider_type: ProviderType
) -> bool:
    if case_kind == ServiceRequestKind.TOWING:
        return False
    return case_kind in kinds_for_provider(provider_type)


def profile_matches_case_kind(
    case_kind: ServiceRequestKind, profile: TechnicianProfile
) -> bool:
    provider_types = {
        profile.provider_type,
        *(profile.secondary_provider_types or []),
    }
    return any(
        technician_matches_case_kind(case_kind, provider_type)
        for provider_type in provider_types
    )


async def upsert_match_for_profile(
    session: AsyncSession,
    *,
    case: ServiceCase,
    profile: TechnicianProfile,
    source: CaseTechnicianMatchSource = CaseTechnicianMatchSource.SYSTEM,
) -> CaseTechnicianMatch:
    score, reason_codes, reason_label = await _score_match(session, case, profile)
    stmt = (
        insert(CaseTechnicianMatch)
        .values(
            case_id=case.id,
            technician_user_id=profile.user_id,
            technician_profile_id=profile.id,
            score=score,
            reason_codes=reason_codes,
            reason_label=reason_label,
            visibility_state=CaseTechnicianMatchVisibility.CANDIDATE,
            source=source,
            context={},
            computed_at=datetime.now(UTC),
            invalidated_at=None,
        )
        .on_conflict_do_update(
            index_elements=["case_id", "technician_user_id"],
            set_={
                "technician_profile_id": profile.id,
                "score": score,
                "reason_codes": reason_codes,
                "reason_label": reason_label,
                "visibility_state": CaseTechnicianMatchVisibility.CANDIDATE,
                "source": source,
                "computed_at": datetime.now(UTC),
                "invalidated_at": None,
            },
        )
        .returning(CaseTechnicianMatch)
    )
    return (await session.execute(stmt)).scalar_one()


async def generate_initial_matches(
    session: AsyncSession,
    *,
    case: ServiceCase,
    limit: int = 50,
) -> list[CaseTechnicianMatch]:
    if case.kind == ServiceRequestKind.TOWING:
        return []
    # Some legacy smoke/test DBs are intentionally not migrated to the latest
    # read-model tables. The canonical path still creates the case; matching
    # is a read model and can be rebuilt after migrations.
    table_exists = await session.scalar(
        text("select to_regclass('case_technician_matches')")
    )
    if table_exists is None:
        return []
    provider_types = KIND_PROVIDER_MAP.get(case.kind, set())
    if not provider_types:
        return []
    stmt = (
        select(TechnicianProfile)
        .where(
            TechnicianProfile.deleted_at.is_(None),
            TechnicianProfile.provider_type.in_(provider_types),
        )
        .order_by(TechnicianProfile.updated_at.desc())
        .limit(limit)
    )
    profiles = list((await session.execute(stmt)).scalars().all())
    matches: list[CaseTechnicianMatch] = []
    for profile in profiles:
        matches.append(
            await upsert_match_for_profile(
                session,
                case=case,
                profile=profile,
                source=CaseTechnicianMatchSource.SYSTEM,
            )
        )
    return matches


async def notify_case_to_technician(
    session: AsyncSession,
    *,
    case: ServiceCase,
    customer_user_id: UUID,
    technician_user_id: UUID,
    note: str | None = None,
) -> CaseTechnicianNotification:
    profile = await _get_profile_for_user(session, technician_user_id)
    if profile is None:
        raise ValueError("technician_profile_not_found")
    if not profile_matches_case_kind(case.kind, profile):
        raise ValueError("technician_case_kind_mismatch")

    match = await upsert_match_for_profile(
        session,
        case=case,
        profile=profile,
        source=CaseTechnicianMatchSource.CUSTOMER_NOTIFY,
    )
    stmt = (
        insert(CaseTechnicianNotification)
        .values(
            case_id=case.id,
            customer_user_id=customer_user_id,
            technician_user_id=technician_user_id,
            technician_profile_id=profile.id,
            match_id=match.id,
            status=CaseTechnicianNotificationStatus.SENT,
            note=note,
        )
        .on_conflict_do_update(
            index_elements=["case_id", "technician_user_id"],
            set_={
                "customer_user_id": customer_user_id,
                "technician_profile_id": profile.id,
                "match_id": match.id,
                "status": CaseTechnicianNotificationStatus.SENT,
                "note": note,
                "updated_at": datetime.now(UTC),
            },
        )
        .returning(CaseTechnicianNotification)
    )
    return (await session.execute(stmt)).scalar_one()


async def mark_notification_offer_created(
    session: AsyncSession,
    *,
    case_id: UUID,
    technician_user_id: UUID,
) -> None:
    await session.execute(
        update(CaseTechnicianNotification)
        .where(
            CaseTechnicianNotification.case_id == case_id,
            CaseTechnicianNotification.technician_user_id == technician_user_id,
        )
        .values(
            status=CaseTechnicianNotificationStatus.OFFER_CREATED,
            responded_at=datetime.now(UTC),
        )
    )


async def context_for_cases(
    session: AsyncSession,
    *,
    case_ids: list[UUID],
    technician_user_id: UUID,
) -> dict[UUID, dict[str, object]]:
    if not case_ids:
        return {}
    match_rows = (
        await session.execute(
            select(CaseTechnicianMatch).where(
                CaseTechnicianMatch.case_id.in_(case_ids),
                CaseTechnicianMatch.technician_user_id == technician_user_id,
                CaseTechnicianMatch.invalidated_at.is_(None),
            )
        )
    ).scalars().all()
    notification_rows = (
        await session.execute(
            select(CaseTechnicianNotification).where(
                CaseTechnicianNotification.case_id.in_(case_ids),
                CaseTechnicianNotification.technician_user_id == technician_user_id,
            )
        )
    ).scalars().all()
    offer_rows = (
        await session.execute(
            select(CaseOffer.case_id).where(
                CaseOffer.case_id.in_(case_ids),
                CaseOffer.technician_id == technician_user_id,
                CaseOffer.status.in_(
                    (
                        CaseOfferStatus.PENDING,
                        CaseOfferStatus.SHORTLISTED,
                        CaseOfferStatus.ACCEPTED,
                    )
                ),
            )
        )
    ).scalars().all()
    ctx: dict[UUID, dict[str, object]] = {
        case_id: {
            "is_matched_to_me": False,
            "match_reason_label": None,
            "match_badge": None,
            "is_notified_to_me": False,
            "has_offer_from_me": False,
        }
        for case_id in case_ids
    }
    for row in match_rows:
        item = ctx[row.case_id]
        item["is_matched_to_me"] = True
        item["match_reason_label"] = row.reason_label
        item["match_badge"] = "Bu vakaya uygun"
    for row in notification_rows:
        item = ctx[row.case_id]
        item["is_notified_to_me"] = row.status not in (
            CaseTechnicianNotificationStatus.DISMISSED,
            CaseTechnicianNotificationStatus.EXPIRED,
        )
    for case_id in offer_rows:
        ctx[case_id]["has_offer_from_me"] = True
    return ctx


async def _get_profile_for_user(
    session: AsyncSession, user_id: UUID
) -> TechnicianProfile | None:
    stmt = select(TechnicianProfile).where(
        TechnicianProfile.user_id == user_id,
        TechnicianProfile.deleted_at.is_(None),
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def _score_match(
    session: AsyncSession,
    case: ServiceCase,
    profile: TechnicianProfile,
) -> tuple[Decimal, list[str], str]:
    score = Decimal("0.00")
    reason_codes: list[str] = []
    if profile_matches_case_kind(case.kind, profile):
        score += Decimal("50.00")
        reason_codes.append("provider_type")
    if profile.availability != TechnicianAvailability.OFFLINE:
        score += Decimal("15.00")
        reason_codes.append("availability")
    has_area = await session.scalar(
        select(TechnicianServiceArea.profile_id)
        .where(TechnicianServiceArea.profile_id == profile.id)
        .limit(1)
    )
    if has_area:
        score += Decimal("15.00")
        reason_codes.append("service_area")
    has_domain = await session.scalar(
        select(TechnicianServiceDomain.profile_id)
        .where(TechnicianServiceDomain.profile_id == profile.id)
        .limit(1)
    )
    if has_domain:
        score += Decimal("10.00")
        reason_codes.append("service_domain")
    if not reason_codes:
        reason_codes.append("manual")
    label = _reason_label(reason_codes)
    return score, reason_codes, label


def _reason_label(reason_codes: list[str]) -> str:
    if "provider_type" in reason_codes and "service_area" in reason_codes:
        return "Bu vaka türüne ve bölgeye uygun"
    if "provider_type" in reason_codes:
        return "Bu vaka türüne uygun"
    return "Müşteri bu vakayı bildirdi"
