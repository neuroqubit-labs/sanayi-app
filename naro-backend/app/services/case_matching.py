"""Case-technician match and notification orchestration."""

from __future__ import annotations

import logging
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case import ServiceCase, ServiceRequestKind
from app.models.case_matching import (
    CaseServiceTag,
    CaseServiceTagSource,
    CaseTechnicianMatch,
    CaseTechnicianMatchSource,
    CaseTechnicianMatchVisibility,
    CaseTechnicianNotification,
    CaseTechnicianNotificationStatus,
)
from app.models.case_subtypes import BreakdownCase, MaintenanceCase, TowCase
from app.models.offer import CaseOffer, CaseOfferStatus
from app.models.taxonomy import (
    BrandTier,
    TaxonomyBrand,
    TaxonomyCity,
    TaxonomyDistrict,
    TaxonomyServiceDomain,
)
from app.models.technician import ProviderType, TechnicianAvailability, TechnicianProfile
from app.models.technician_signal import (
    TechnicianBrandCoverage,
    TechnicianProcedureTag,
    TechnicianServiceArea,
    TechnicianServiceDomain,
    TechnicianVehicleKindCoverage,
    TechnicianWorkingDistrict,
)
from app.models.vehicle import Vehicle, VehicleKind
from app.services.pool_matching import KIND_PROVIDER_MAP, kinds_for_provider

logger = logging.getLogger(__name__)

MAX_CUSTOMER_NOTIFICATIONS_PER_CASE = 3
ACTIVE_NOTIFICATION_STATUSES = (
    CaseTechnicianNotificationStatus.SENT,
    CaseTechnicianNotificationStatus.SEEN,
    CaseTechnicianNotificationStatus.OFFER_CREATED,
)


@dataclass(slots=True)
class ProfileFitResult:
    context_score: Decimal
    context_group: str
    context_tier: str
    compatibility_state: str
    match_badge: str
    notify_badge: str | None
    match_reason_label: str
    fit_signals: list[str] = field(default_factory=list)
    fit_badges: list[str] = field(default_factory=list)
    is_vehicle_compatible: bool = True
    is_case_compatible: bool = False
    reason_codes: list[str] = field(default_factory=list)
    notify_state: str = "not_compatible"
    notify_disabled_reason: str | None = None

    @property
    def can_notify(self) -> bool:
        return self.compatibility_state == "notifyable" and self.notify_state == "available"


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


MAINTENANCE_CATEGORY_DOMAINS: dict[str, set[str]] = {
    "periodic": {"motor", "fren", "elektrik", "aku"},
    "tire": {"lastik"},
    "glass_film": {"cam"},
    "coating": {"aksesuar", "kaporta"},
    "battery": {"aku", "elektrik"},
    "climate": {"klima", "elektrik"},
    "brake": {"fren"},
    "detail_wash": {"aksesuar"},
    "headlight_polish": {"aksesuar", "kaporta"},
    "engine_wash": {"motor", "aksesuar"},
    "package_summer": {"klima", "lastik", "cam", "aksesuar"},
    "package_winter": {"lastik", "aku", "fren", "klima"},
    "package_new_car": {"aksesuar", "cam", "kaporta"},
    "package_sale_prep": {"aksesuar", "motor", "kaporta", "cam"},
}

BREAKDOWN_CATEGORY_DOMAINS: dict[str, set[str]] = {
    "engine": {"motor"},
    "electric": {"elektrik", "aku"},
    "mechanic": {"motor", "fren"},
    "climate": {"klima", "elektrik"},
    "transmission": {"sanziman", "motor"},
    "tire": {"lastik"},
    "fluid": {"motor"},
    "other": set(),
}

SYMPTOM_DOMAIN_KEYWORDS: dict[str, set[str]] = {
    "aku": {"aku", "elektrik"},
    "akü": {"aku", "elektrik"},
    "battery": {"aku", "elektrik"},
    "elektrik": {"elektrik"},
    "far": {"elektrik"},
    "klima": {"klima", "elektrik"},
    "fren": {"fren"},
    "lastik": {"lastik"},
    "motor": {"motor"},
    "hararet": {"motor"},
    "sanziman": {"sanziman"},
    "şanzıman": {"sanziman"},
    "kapı": {"aksesuar", "kaporta"},
    "kapi": {"aksesuar", "kaporta"},
    "kapı kolu": {"aksesuar", "kaporta"},
    "kapi kolu": {"aksesuar", "kaporta"},
    "kilit": {"aksesuar", "kaporta"},
    "trim": {"aksesuar", "kaporta"},
    "cam mekanizması": {"aksesuar", "kaporta"},
    "cam mekanizmasi": {"aksesuar", "kaporta"},
    "kaporta": {"kaporta", "boya"},
    "tampon": {"kaporta", "boya"},
}

PACKAGE_MAINTENANCE_CATEGORIES = {
    "package_summer",
    "package_winter",
    "package_new_car",
    "package_sale_prep",
}


def _maintenance_category_domain_keys(
    category: str | None,
    selected_items: list[str] | None = None,
) -> set[str]:
    if not category:
        return set()
    if category in PACKAGE_MAINTENANCE_CATEGORIES:
        domains: set[str] = set()
        for item in selected_items or []:
            domains.update(MAINTENANCE_CATEGORY_DOMAINS.get(item, set()))
        return domains
    return set(MAINTENANCE_CATEGORY_DOMAINS.get(category, set()))


def _breakdown_domain_keys(
    category: str | None,
    symptoms: str | list[str] | None,
) -> set[str]:
    domains = set(BREAKDOWN_CATEGORY_DOMAINS.get(category or "", set()))
    symptom_values = [symptoms] if isinstance(symptoms, str) else symptoms or []
    normalized = " ".join(_normalize_text(value) for value in symptom_values)
    for keyword, keyword_domains in SYMPTOM_DOMAIN_KEYWORDS.items():
        if _normalize_text(keyword) in normalized:
            domains.update(keyword_domains)
    return domains


ACCIDENT_AREA_DOMAINS: dict[str, set[str]] = {
    "front": {"kaporta", "boya"},
    "rear": {"kaporta", "boya"},
    "side": {"kaporta", "boya"},
    "door": {"kaporta", "boya", "aksesuar"},
    "glass": {"cam"},
    "general": {"kaporta", "boya"},
}


def _accident_domain_keys(damage_area: str | None) -> set[str]:
    if not damage_area:
        return {"kaporta", "boya"}
    key = damage_area.strip().lower()
    return set(ACCIDENT_AREA_DOMAINS.get(key, {"kaporta", "boya"}))


def service_tag_keys_for_draft(draft: object) -> set[str]:
    kind = getattr(draft, "kind", None)
    if kind == ServiceRequestKind.MAINTENANCE:
        category = getattr(getattr(draft, "maintenance_category", None), "value", None)
        if category is None:
            category = getattr(draft, "maintenance_category", None)
        selected_items = list(getattr(draft, "maintenance_items", []) or [])
        detail = getattr(draft, "maintenance_detail", None)
        if isinstance(detail, dict):
            raw_selected = detail.get("selected_items")
            if isinstance(raw_selected, list):
                selected_items.extend(
                    item for item in raw_selected if isinstance(item, str)
                )
        return _maintenance_category_domain_keys(category, selected_items)
    if kind == ServiceRequestKind.BREAKDOWN:
        category = getattr(getattr(draft, "breakdown_category", None), "value", None)
        if category is None:
            category = getattr(draft, "breakdown_category", None)
        return _breakdown_domain_keys(category, getattr(draft, "symptoms", None))
    if kind == ServiceRequestKind.ACCIDENT:
        damage_area = getattr(draft, "damage_area", None)
        if isinstance(damage_area, str):
            return _accident_domain_keys(damage_area)
        return _accident_domain_keys(None)
    return set()


async def sync_case_service_tags(
    session: AsyncSession,
    *,
    case_id: UUID,
    tag_keys: set[str],
    source: CaseServiceTagSource = CaseServiceTagSource.COMPOSER,
) -> None:
    if not tag_keys:
        return
    for tag_key in sorted(tag_keys):
        stmt = (
            insert(CaseServiceTag)
            .values(
                case_id=case_id,
                tag_key=tag_key,
                source=source.value,
                confidence=Decimal("1.00"),
            )
            .on_conflict_do_update(
                index_elements=["case_id", "tag_key"],
                set_={
                    "source": source.value,
                    "confidence": Decimal("1.00"),
                    "updated_at": datetime.now(UTC),
                },
            )
        )
        await session.execute(stmt)


async def profile_matches_case_scope(
    session: AsyncSession,
    *,
    case: ServiceCase,
    profile: TechnicianProfile,
) -> bool:
    fit = await evaluate_profile_fit(session, case=case, profile=profile)
    return fit.compatibility_state == "notifyable"


async def evaluate_profile_fit(
    session: AsyncSession,
    *,
    profile: TechnicianProfile,
    case: ServiceCase | None = None,
    vehicle: Vehicle | None = None,
) -> ProfileFitResult:
    """Deterministic profile fit used by case matching and public discovery.

    The hierarchy is intentionally explicit and boring: hard vehicle-kind scope,
    case/service domain, brand/model, service area, then activity/trust. It never
    reads request_draft; composer output must arrive as typed case fields or
    case_service_tags.
    """
    if vehicle is None and case is not None:
        vehicle = await session.get(Vehicle, case.vehicle_id)

    score = Decimal("0.00")
    reason_codes: list[str] = []
    badges: list[str] = []
    fit_signals: list[str] = []

    vehicle_scope = await _vehicle_kind_scope(
        session,
        vehicle=vehicle,
        profile=profile,
    )
    vehicle_compatible = vehicle_scope == "explicit_match"
    if vehicle is not None and vehicle.vehicle_kind is not None:
        if vehicle_compatible:
            score += Decimal("25.00")
            reason_codes.append("vehicle_kind")
            badges.append("Araç tipi uygun")
            fit_signals.append("vehicle_kind")
        elif vehicle_scope == "missing_coverage":
            reason_codes.append("vehicle_kind_missing_coverage")
        else:
            reason_codes.append("vehicle_kind_mismatch")

    provider_ok = True
    domain_ok = True
    required_domains: set[str] = set()
    domain_labels: list[str] = []
    if case is not None:
        if case.kind == ServiceRequestKind.TOWING:
            provider_ok = False
        else:
            provider_ok = profile_matches_case_kind(case.kind, profile)
        if provider_ok:
            score += Decimal("20.00")
            reason_codes.append("provider_type")
            fit_signals.append("provider_type")
        required_domains = await _case_required_domain_keys(session, case)
        domain_ok = (
            not required_domains
            or await _profile_has_any_domain(session, profile, required_domains)
        )
        if domain_ok and required_domains:
            score += Decimal("30.00")
            reason_codes.append("service_domain")
            fit_signals.append("service_domain")
            domain_labels = await _domain_labels(session, required_domains)
            badges.extend(domain_labels[:2])
    else:
        has_any_domain = bool(
            await session.scalar(
                select(TechnicianServiceDomain.profile_id)
                .where(TechnicianServiceDomain.profile_id == profile.id)
                .limit(1)
            )
        )
        if has_any_domain:
            score += Decimal("5.00")
            reason_codes.append("service_domain")

    brand_label = await _profile_brand_match_label(session, vehicle=vehicle, profile=profile)
    if brand_label:
        score += Decimal("15.00")
        reason_codes.append("brand_match")
        fit_signals.append("brand")
        badges.append(f"{brand_label} uyumlu")

    model_label = await _profile_model_match_label(session, vehicle=vehicle, profile=profile)
    if model_label:
        score += Decimal("8.00")
        reason_codes.append("model_match")
        fit_signals.append("model")
        badges.append(f"{model_label} deneyimi")

    if case is not None:
        area_reason_codes = await _area_reason_codes(session, case, profile)
        if "city_match" in area_reason_codes:
            score += Decimal("10.00")
            fit_signals.append("city")
            badges.append("Şehir uyumlu")
        if "district_match" in area_reason_codes:
            score += Decimal("5.00")
            fit_signals.append("district")
            badges.append("Yakın bölge")
        reason_codes.extend(area_reason_codes)

    availability = getattr(profile, "availability", None)
    if availability == TechnicianAvailability.AVAILABLE:
        score += Decimal("5.00")
        reason_codes.append("availability")
    elif availability == TechnicianAvailability.BUSY:
        score += Decimal("2.00")
        reason_codes.append("busy")

    verified_level = getattr(profile, "verified_level", None)
    verified_value = getattr(verified_level, "value", verified_level)
    if verified_value == "premium":
        score += Decimal("5.00")
        reason_codes.append("premium")
    elif verified_value == "verified":
        score += Decimal("3.00")
        reason_codes.append("verified")

    case_compatible = (
        case is not None
        and vehicle_compatible
        and provider_ok
        and domain_ok
        and case.kind != ServiceRequestKind.TOWING
    )
    make_present = bool(_normalize_text(getattr(vehicle, "make", None)))
    if not make_present and vehicle is not None and case is not None:
        reason_codes.append("brand_unknown")
    city_ok = case is None or "city_match" in reason_codes or not case.location_label
    notifyable = (
        case_compatible
        and bool(required_domains)
        and ("brand_match" in reason_codes or not make_present)
        and city_ok
    )
    compatibility_state = _compatibility_state(
        case=case,
        vehicle_scope=vehicle_scope,
        case_compatible=case_compatible,
        notifyable=notifyable,
        required_domains=required_domains,
        reason_codes=reason_codes,
    )
    if case is None:
        context_group = "primary" if compatibility_state in {"vehicle_only", "compatible"} else "other"
    else:
        context_group = "primary" if compatibility_state in {"notifyable", "compatible"} else "other"

    context_tier = _context_tier(
        case=case,
        case_compatible=case_compatible,
        vehicle_compatible=vehicle_compatible,
        reason_codes=reason_codes,
    )
    score = max(Decimal("0.00"), min(score, Decimal("100.00"))).quantize(
        Decimal("0.01")
    )
    match_badge = _match_badge(
        case_compatible=case_compatible,
        vehicle_compatible=vehicle_compatible,
        compatibility_state=compatibility_state,
    )
    label = _fit_reason_label(
        case=case,
        domain_labels=domain_labels,
        brand_label=brand_label,
        vehicle_compatible=vehicle_compatible,
        case_compatible=case_compatible,
        reason_codes=reason_codes,
    )
    return ProfileFitResult(
        context_score=score,
        context_group=context_group,
        context_tier=context_tier,
        compatibility_state=compatibility_state,
        match_badge=match_badge,
        notify_badge="Bildirilebilir" if compatibility_state == "notifyable" else None,
        match_reason_label=label,
        fit_signals=_dedupe_preserve_order(fit_signals),
        fit_badges=_dedupe_preserve_order(badges)[:5],
        is_vehicle_compatible=vehicle_compatible,
        is_case_compatible=case_compatible,
        reason_codes=reason_codes or ["manual"],
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
        if not await profile_matches_case_scope(session, case=case, profile=profile):
            continue
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
    fit = await evaluate_profile_fit(session, case=case, profile=profile)
    reason_codes = getattr(fit, "reason_codes", None) or []
    if "vehicle_kind_mismatch" in reason_codes:
        logger.warning(
            "case_notify_rejected",
            extra={
                "case_id": str(case.id),
                "technician_user_id": str(technician_user_id),
                "reason": "vehicle_kind_mismatch",
                "reason_codes": list(reason_codes),
                "compatibility_state": fit.compatibility_state,
            },
        )
        raise ValueError("vehicle_kind_mismatch")
    if fit.compatibility_state != "notifyable":
        logger.warning(
            "case_notify_rejected",
            extra={
                "case_id": str(case.id),
                "technician_user_id": str(technician_user_id),
                "reason": "compatibility_not_notifyable",
                "reason_codes": list(reason_codes),
                "compatibility_state": fit.compatibility_state,
            },
        )
        raise ValueError("technician_case_kind_mismatch")

    existing_notification = await get_notification_for_technician(
        session,
        case_id=case.id,
        technician_user_id=technician_user_id,
    )
    if existing_notification is None:
        active_notification_count = await session.scalar(
            select(func.count(CaseTechnicianNotification.id)).where(
                CaseTechnicianNotification.case_id == case.id,
                CaseTechnicianNotification.status.in_(
                    ACTIVE_NOTIFICATION_STATUSES
                ),
            )
        )
        if int(active_notification_count or 0) >= MAX_CUSTOMER_NOTIFICATIONS_PER_CASE:
            raise ValueError("case_notification_limit_reached")

    match = await get_match_for_technician(
        session,
        case_id=case.id,
        technician_user_id=technician_user_id,
    )
    match_id = match.id if match else None
    stmt = (
        insert(CaseTechnicianNotification)
        .values(
            case_id=case.id,
            customer_user_id=customer_user_id,
            technician_user_id=technician_user_id,
            technician_profile_id=profile.id,
            match_id=match_id,
            status=CaseTechnicianNotificationStatus.SENT,
            note=note,
        )
        .on_conflict_do_update(
            index_elements=["case_id", "technician_user_id"],
            set_={
                "customer_user_id": customer_user_id,
                "technician_profile_id": profile.id,
                "match_id": match_id,
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


async def get_match_for_technician(
    session: AsyncSession,
    *,
    case_id: UUID,
    technician_user_id: UUID,
) -> CaseTechnicianMatch | None:
    stmt = (
        select(CaseTechnicianMatch)
        .where(
            CaseTechnicianMatch.case_id == case_id,
            CaseTechnicianMatch.technician_user_id == technician_user_id,
            CaseTechnicianMatch.invalidated_at.is_(None),
        )
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_notification_for_technician(
    session: AsyncSession,
    *,
    case_id: UUID,
    technician_user_id: UUID,
) -> CaseTechnicianNotification | None:
    stmt = (
        select(CaseTechnicianNotification)
        .where(
            CaseTechnicianNotification.case_id == case_id,
            CaseTechnicianNotification.technician_user_id == technician_user_id,
        )
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


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
    fit = await evaluate_profile_fit(session, case=case, profile=profile)
    return fit.context_score, fit.reason_codes, fit.match_reason_label


async def _case_required_domain_keys(
    session: AsyncSession,
    case: ServiceCase,
) -> set[str]:
    tag_rows = (
        await session.execute(
            select(CaseServiceTag.tag_key).where(CaseServiceTag.case_id == case.id)
        )
    ).scalars().all()
    if tag_rows:
        return set(tag_rows)
    if case.kind == ServiceRequestKind.MAINTENANCE:
        subtype = await session.get(MaintenanceCase, case.id)
        if subtype is None:
            return set()
        selected_items: list[str] = []
        detail = subtype.maintenance_detail
        if isinstance(detail, dict):
            raw_selected = detail.get("selected_items")
            if isinstance(raw_selected, list):
                selected_items = [
                    item for item in raw_selected if isinstance(item, str)
                ]
        return _maintenance_category_domain_keys(
            subtype.maintenance_category, selected_items
        )
    if case.kind == ServiceRequestKind.BREAKDOWN:
        subtype = await session.get(BreakdownCase, case.id)
        if subtype is None:
            return set()
        return _breakdown_domain_keys(subtype.breakdown_category, subtype.symptoms)
    return set()


async def _vehicle_kind_matches_profile(
    session: AsyncSession,
    *,
    case: ServiceCase,
    profile: TechnicianProfile,
) -> bool:
    vehicle = await session.get(Vehicle, case.vehicle_id)
    return await _vehicle_kind_matches_vehicle(
        session,
        vehicle=vehicle,
        profile=profile,
    )


async def _vehicle_kind_matches_vehicle(
    session: AsyncSession,
    *,
    vehicle: Vehicle | None,
    profile: TechnicianProfile,
) -> bool:
    return await _vehicle_kind_scope(
        session,
        vehicle=vehicle,
        profile=profile,
    ) == "explicit_match"


async def _vehicle_kind_scope(
    session: AsyncSession,
    *,
    vehicle: Vehicle | None,
    profile: TechnicianProfile,
) -> str:
    if vehicle is None or vehicle.vehicle_kind is None:
        return "unknown"
    explicit_coverage = (
        await session.execute(
            select(TechnicianVehicleKindCoverage.vehicle_kind).where(
                TechnicianVehicleKindCoverage.profile_id == profile.id
            )
        )
    ).scalars().all()
    if explicit_coverage:
        return (
            "explicit_match"
            if vehicle.vehicle_kind in set(explicit_coverage)
            else "explicit_mismatch"
        )
    if vehicle.vehicle_kind != VehicleKind.MOTOSIKLET:
        return "missing_coverage"
    motorcycle_brand = await session.scalar(
        select(TechnicianBrandCoverage.profile_id)
        .join(
            TaxonomyBrand,
            TaxonomyBrand.brand_key == TechnicianBrandCoverage.brand_key,
        )
        .where(
            TechnicianBrandCoverage.profile_id == profile.id,
            TaxonomyBrand.tier == BrandTier.MOTORCYCLE,
        )
        .limit(1)
    )
    return "explicit_match" if motorcycle_brand else "explicit_mismatch"


async def _profile_brand_match_label(
    session: AsyncSession,
    *,
    vehicle: Vehicle | None,
    profile: TechnicianProfile,
) -> str | None:
    make = _normalize_text(vehicle.make if vehicle is not None else None)
    if not make:
        return None
    rows = (
        await session.execute(
            select(
                TechnicianBrandCoverage.brand_key,
                TaxonomyBrand.label,
            )
            .join(
                TaxonomyBrand,
                TaxonomyBrand.brand_key == TechnicianBrandCoverage.brand_key,
            )
            .where(TechnicianBrandCoverage.profile_id == profile.id)
        )
    ).all()
    for brand_key, label in rows:
        if make in {
            _normalize_text(brand_key),
            _normalize_text(label),
        }:
            return str(label)
    return None


async def _profile_model_match_label(
    session: AsyncSession,
    *,
    vehicle: Vehicle | None,
    profile: TechnicianProfile,
) -> str | None:
    model = _normalize_text(vehicle.model if vehicle is not None else None)
    if not model:
        return None
    tag_rows = (
        await session.execute(
            select(TechnicianProcedureTag.tag_normalized, TechnicianProcedureTag.tag)
            .where(TechnicianProcedureTag.profile_id == profile.id)
            .limit(50)
        )
    ).all()
    for normalized, tag in tag_rows:
        normalized_tag = _normalize_text(normalized or tag)
        if model and (model in normalized_tag or normalized_tag in model):
            return str(vehicle.model)
    return None


async def _domain_labels(
    session: AsyncSession,
    domain_keys: set[str],
) -> list[str]:
    if not domain_keys:
        return []
    rows = (
        await session.execute(
            select(
                TaxonomyServiceDomain.domain_key,
                TaxonomyServiceDomain.label,
            ).where(TaxonomyServiceDomain.domain_key.in_(domain_keys))
        )
    ).all()
    labels_by_key = {row[0]: row[1] for row in rows}
    return [labels_by_key.get(key, key.replace("_", " ").title()) for key in sorted(domain_keys)]


async def _profile_has_any_domain(
    session: AsyncSession,
    profile: TechnicianProfile,
    domain_keys: set[str],
) -> bool:
    if not domain_keys:
        return False
    return bool(
        await session.scalar(
            select(TechnicianServiceDomain.profile_id)
            .where(
                TechnicianServiceDomain.profile_id == profile.id,
                TechnicianServiceDomain.domain_key.in_(domain_keys),
            )
            .limit(1)
        )
    )


def _reason_label(reason_codes: list[str]) -> str:
    if "service_domain" in reason_codes and "brand_match" in reason_codes:
        return "Hizmet ve marka uyumu güçlü"
    if "service_domain" in reason_codes:
        return "Bu hizmeti veriyor"
    if "brand_match" in reason_codes:
        return "Araç markana bakıyor"
    if "provider_type" in reason_codes and "district_match" in reason_codes:
        return "Bu vaka türüne ve ilçeye uygun"
    if "provider_type" in reason_codes and "city_match" in reason_codes:
        return "Bu vaka türüne ve şehre uygun"
    if "provider_type" in reason_codes:
        return "Bu vaka türüne uygun"
    return "Müşteri bu vakayı bildirdi"


def _context_tier(
    *,
    case: ServiceCase | None,
    case_compatible: bool,
    vehicle_compatible: bool,
    reason_codes: list[str],
) -> str:
    if case_compatible and {"service_domain", "brand_match"} <= set(reason_codes):
        return "exact_case_fit"
    if case_compatible:
        return "case_fit"
    if vehicle_compatible and "brand_match" in reason_codes:
        return "brand_fit"
    if vehicle_compatible and case is None:
        return "strong_vehicle_fit"
    if "city_match" in reason_codes:
        return "city_fit"
    return "other"


def _compatibility_state(
    *,
    case: ServiceCase | None,
    vehicle_scope: str,
    case_compatible: bool,
    notifyable: bool,
    required_domains: set[str],
    reason_codes: list[str],
) -> str:
    if vehicle_scope in {"explicit_mismatch", "missing_coverage"}:
        return "incompatible" if vehicle_scope == "explicit_mismatch" else "weak"
    if case is None:
        return "vehicle_only" if vehicle_scope in {"explicit_match", "unknown"} else "weak"
    if notifyable:
        return "notifyable"
    if case_compatible and required_domains and "service_domain" in reason_codes:
        return "compatible"
    if case_compatible:
        return "weak"
    return "incompatible"


def _match_badge(
    *,
    case_compatible: bool,
    vehicle_compatible: bool,
    compatibility_state: str,
) -> str:
    if compatibility_state == "notifyable":
        return "Bu vakaya uygun"
    if case_compatible:
        return "Bu vakaya uygun"
    if vehicle_compatible:
        return "Aracına uygun"
    return "Diğer seçenek"


def _fit_reason_label(
    *,
    case: ServiceCase | None,
    domain_labels: list[str],
    brand_label: str | None,
    vehicle_compatible: bool,
    case_compatible: bool,
    reason_codes: list[str],
) -> str:
    if case_compatible and domain_labels and brand_label:
        return f"{domain_labels[0]} ve {brand_label} için uygun"
    if case_compatible and domain_labels:
        return f"{domain_labels[0]} hizmeti veriyor"
    if brand_label:
        return f"{brand_label} araçlara bakıyor"
    if case_compatible:
        return _reason_label(reason_codes)
    if vehicle_compatible and case is None:
        return "Aktif aracınla uyumlu"
    if vehicle_compatible:
        return "Araç tipi uyumlu, vaka konusu zayıf"
    return "Bu bağlam için güçlü eşleşme değil"


def _dedupe_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


async def _area_reason_codes(
    session: AsyncSession,
    case: ServiceCase,
    profile: TechnicianProfile,
) -> list[str]:
    area = await session.get(TechnicianServiceArea, profile.id)
    if area is None:
        return []

    subtype: object | None = None
    if case.kind == ServiceRequestKind.TOWING:
        subtype = await session.get(TowCase, case.id)
    location_text = _case_location_text(case, subtype=subtype)
    if not location_text:
        return ["service_area_configured"]

    reasons: list[str] = []
    city = await session.get(TaxonomyCity, area.city_code)
    city_candidates = [area.city_code]
    if city is not None:
        city_candidates.append(city.label)
    if _matches_any_location_candidate(location_text, city_candidates):
        reasons.append("city_match")

    district_ids: set[UUID] = set()
    if area.primary_district_id is not None:
        district_ids.add(area.primary_district_id)
    district_ids.update(
        (
            await session.execute(
                select(TechnicianWorkingDistrict.district_id).where(
                    TechnicianWorkingDistrict.profile_id == profile.id
                )
            )
        )
        .scalars()
        .all()
    )
    if district_ids:
        districts = (
            await session.execute(
                select(TaxonomyDistrict.label).where(
                    TaxonomyDistrict.district_id.in_(district_ids)
                )
            )
        ).scalars().all()
        if _matches_any_location_candidate(location_text, list(districts)):
            reasons.append("district_match")

    return reasons or ["service_area_configured"]


def _case_location_text(case: ServiceCase, *, subtype: object | None = None) -> str:
    values: list[str] = []
    if case.location_label:
        values.append(case.location_label)
    if isinstance(subtype, TowCase):
        if subtype.pickup_address:
            values.append(subtype.pickup_address)
        if subtype.dropoff_address:
            values.append(subtype.dropoff_address)
    return _normalize_text(" ".join(values))


def _matches_any_location_candidate(
    location_text: str, candidates: list[str | None]
) -> bool:
    for candidate in candidates:
        normalized = _normalize_text(candidate or "")
        if len(normalized) >= 3 and normalized in location_text:
            return True
    return False


def _normalize_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    without_marks = "".join(
        char for char in normalized if not unicodedata.combining(char)
    )
    return re.sub(r"\s+", " ", without_marks.casefold()).strip()
