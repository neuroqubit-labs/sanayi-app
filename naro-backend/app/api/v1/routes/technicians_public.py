"""/technicians/public/* router — 2 endpoint.

- GET /technicians/public/{id} — detay; cache `tech_public:{id}:{version}` 5m
- GET /technicians/public/feed — paginated; cache `tech_feed:{cursor}:{limit}` 1m

PII mask sıkı (I-9): response modelinde phone/email/legal_name/tax/iban YOK.
Feed admission quick-check V1: users.status='active' + approval_status='active'
+ availability IN ('available','busy') + service_domains EXISTS +
service_area mevcut.

Feed sıralama: verified_level tier DESC, rating_bayesian DESC (30d snapshot),
completed_jobs DESC, id tiebreaker. Mesafe V2.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Annotated, Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import and_, case, exists, func, select

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
from app.api.v1.deps import CurrentUserDep, DbDep, RedisDep, SettingsDep
from app.models.case_matching import CaseTechnicianNotification
from app.models.case_public_showcase import (
    CasePublicShowcase,
    CasePublicShowcaseMedia,
    CasePublicShowcaseStatus,
)
from app.models.media import MediaAsset, MediaStatus, MediaVisibility
from app.models.offer import ACTIVE_OFFER_STATUSES, CaseOffer
from app.models.taxonomy import (
    TaxonomyBrand,
    TaxonomyCity,
    TaxonomyDistrict,
    TaxonomyServiceDomain,
)
from app.models.technician import (
    TechnicianAvailability,
    TechnicianCapability,
    TechnicianCertificate,
    TechnicianCertificateStatus,
    TechnicianGalleryItem,
    TechnicianProfile,
    TechnicianVerifiedLevel,
)
from app.models.technician_signal import (
    TechnicianBrandCoverage,
    TechnicianCapacity,
    TechnicianPerformanceSnapshot,
    TechnicianProcedureTag,
    TechnicianServiceArea,
    TechnicianServiceDomain,
    TechnicianWorkingDistrict,
)
from app.models.user import User, UserApprovalStatus, UserRole, UserStatus
from app.models.vehicle import UserVehicleLink, Vehicle
from app.repositories import case as case_repo
from app.schemas.technician_public import (
    BrandCoverageSignal,
    FitSummary,
    LabelledSignal,
    LocationSummary,
    OperationsSummary,
    ProofPreviewItem,
    PublicAbout,
    PublicCaseShowcaseDetail,
    PublicCaseShowcaseMedia,
    PublicCaseShowcasePreview,
    PublicIdentitySummary,
    PublicMediaAsset,
    TechnicianFeedItem,
    TechnicianPublicView,
    TrustSummary,
)
from app.services import case_matching
from app.services.case_public_showcases import snapshot_value
from app.services.taxonomy_cache import (
    PUBLIC_FEED_TTL_SECONDS,
    PUBLIC_PROFILE_TTL_SECONDS,
    get_cached_model,
    public_feed_key,
    public_profile_key,
    set_cached_model,
)

router = APIRouter(prefix="/technicians/public", tags=["technicians-public"])

OptionalDomainQuery = Annotated[str | None, Query(max_length=60)]
OptionalDistrictQuery = Annotated[str | None, Query(max_length=80)]
OptionalUuidQuery = Annotated[UUID | None, Query()]


# Performance snapshot window — V1 için 30g
_SNAPSHOT_WINDOW_DAYS = 30


_VERIFIED_TIER_ORDER: dict[TechnicianVerifiedLevel, int] = {
    TechnicianVerifiedLevel.PREMIUM: 2,
    TechnicianVerifiedLevel.VERIFIED: 1,
    TechnicianVerifiedLevel.BASIC: 0,
}


async def _build_location_summary(
    db: AsyncSession,
    profile_id: UUID,
) -> LocationSummary:
    """Service area + city/district label join (PII-safe — lat/lng yok)."""
    stmt = (
        select(
            TechnicianServiceArea.city_code,
            TechnicianServiceArea.service_radius_km,
            TechnicianServiceArea.primary_district_id,
            TaxonomyCity.label.label("city_label"),
        )
        .outerjoin(
            TaxonomyCity,
            TaxonomyCity.city_code == TechnicianServiceArea.city_code,
        )
        .where(TechnicianServiceArea.profile_id == profile_id)
        .limit(1)
    )
    row = (await db.execute(stmt)).mappings().first()
    if row is None:
        return LocationSummary()
    district_label: str | None = None
    if row["primary_district_id"] is not None:
        d_stmt = select(TaxonomyDistrict.label).where(
            TaxonomyDistrict.district_id == row["primary_district_id"]
        )
        district_label = (await db.execute(d_stmt)).scalar_one_or_none()
    return LocationSummary(
        city_code=row["city_code"],
        city_label=row["city_label"],
        primary_district_label=district_label,
        service_radius_km=row["service_radius_km"],
    )


async def _load_snapshot_aggregates(
    db: AsyncSession, profile_ids: list[UUID]
) -> dict[UUID, tuple[Any, ...]]:
    """En güncel 30g snapshot'ı profile_id bazında map'le."""
    if not profile_ids:
        return {}
    # Son snapshot / profile — window 30
    stmt = (
        select(
            TechnicianPerformanceSnapshot.profile_id,
            TechnicianPerformanceSnapshot.rating_bayesian,
            TechnicianPerformanceSnapshot.rating_count,
            TechnicianPerformanceSnapshot.completed_jobs,
            TechnicianPerformanceSnapshot.response_time_p50_minutes,
        )
        .where(
            TechnicianPerformanceSnapshot.window_days == _SNAPSHOT_WINDOW_DAYS,
            TechnicianPerformanceSnapshot.profile_id.in_(profile_ids),
        )
        .order_by(
            TechnicianPerformanceSnapshot.profile_id,
            TechnicianPerformanceSnapshot.snapshot_at.desc(),
        )
    )
    result: dict[UUID, tuple[Any, ...]] = {}
    for row in (await db.execute(stmt)).all():
        pid = row[0]
        if pid not in result:
            result[pid] = tuple(row)
    return result


def _media_public_url(settings: Any, object_key: str | None) -> str | None:
    """Public bucket URL helper; object key itself response'a çıkmaz."""
    if not object_key:
        return None
    base_url = (settings.cloudfront_public_base_url or "").rstrip("/")
    if base_url:
        return f"{base_url}/{object_key}"
    endpoint = (settings.aws_s3_endpoint_url or "").rstrip("/")
    if endpoint:
        return f"{endpoint}/{settings.s3_public_bucket}/{object_key}"
    return f"https://{settings.s3_public_bucket}.s3.amazonaws.com/{object_key}"


def _serialize_public_media(
    settings: Any,
    asset: MediaAsset | None,
) -> PublicMediaAsset | None:
    if asset is None:
        return None
    if asset.visibility != MediaVisibility.PUBLIC:
        return None
    if asset.status not in {MediaStatus.READY, MediaStatus.UPLOADED}:
        return None
    if asset.deleted_at is not None:
        return None

    return PublicMediaAsset(
        id=asset.id,
        purpose=asset.purpose,
        mime_type=asset.mime_type,
        preview_url=_media_public_url(
            settings, asset.preview_object_key or asset.object_key
        ),
        thumb_url=_media_public_url(
            settings, asset.thumb_object_key or asset.preview_object_key
        ),
        download_url=_media_public_url(settings, asset.object_key),
    )


async def _load_public_asset(
    db: AsyncSession,
    settings: Any,
    asset_id: UUID | None,
) -> PublicMediaAsset | None:
    if asset_id is None:
        return None
    return _serialize_public_media(settings, await db.get(MediaAsset, asset_id))


async def _build_fit_summary(
    db: AsyncSession,
    profile: TechnicianProfile,
) -> FitSummary:
    domain_stmt = (
        select(
            TechnicianServiceDomain.domain_key,
            TaxonomyServiceDomain.label,
        )
        .join(
            TaxonomyServiceDomain,
            TaxonomyServiceDomain.domain_key
            == TechnicianServiceDomain.domain_key,
        )
        .where(TechnicianServiceDomain.profile_id == profile.id)
        .order_by(TaxonomyServiceDomain.display_order.asc())
        .limit(8)
    )
    service_domains = [
        LabelledSignal(key=row[0], label=row[1])
        for row in (await db.execute(domain_stmt)).all()
    ]

    tag_stmt = (
        select(TechnicianProcedureTag.tag)
        .where(TechnicianProcedureTag.profile_id == profile.id)
        .order_by(TechnicianProcedureTag.created_at.asc())
        .limit(10)
    )
    procedure_tags = list((await db.execute(tag_stmt)).scalars().all())

    brand_stmt = (
        select(
            TechnicianBrandCoverage.brand_key,
            TaxonomyBrand.label,
            TechnicianBrandCoverage.is_authorized,
            TechnicianBrandCoverage.is_premium_authorized,
        )
        .join(
            TaxonomyBrand,
            TaxonomyBrand.brand_key == TechnicianBrandCoverage.brand_key,
        )
        .where(TechnicianBrandCoverage.profile_id == profile.id)
        .order_by(
            TechnicianBrandCoverage.is_premium_authorized.desc(),
            TechnicianBrandCoverage.is_authorized.desc(),
            TaxonomyBrand.display_order.asc(),
        )
        .limit(8)
    )
    brand_coverage = [
        BrandCoverageSignal(
            key=row[0],
            label=row[1],
            is_authorized=bool(row[2]),
            is_premium_authorized=bool(row[3]),
        )
        for row in (await db.execute(brand_stmt)).all()
    ]

    return FitSummary(
        provider_type=profile.provider_type,
        active_provider_type=profile.active_provider_type,
        service_domains=service_domains,
        procedure_tags=procedure_tags,
        brand_coverage=brand_coverage,
    )


async def _build_trust_summary(
    db: AsyncSession,
    profile: TechnicianProfile,
    *,
    rating_bayesian: Any,
    rating_count: int,
    completed_jobs_30d: int,
    response_time_p50_minutes: int | None,
) -> TrustSummary:
    cert_stmt = (
        select(TechnicianCertificate.kind)
        .where(
            TechnicianCertificate.profile_id == profile.id,
            TechnicianCertificate.status == TechnicianCertificateStatus.APPROVED,
        )
        .order_by(TechnicianCertificate.kind.asc())
    )
    approved_kinds = list((await db.execute(cert_stmt)).scalars().all())
    return TrustSummary(
        rating_bayesian=rating_bayesian,
        rating_count=rating_count,
        completed_jobs_30d=completed_jobs_30d,
        response_time_p50_minutes=response_time_p50_minutes,
        verified_level=profile.verified_level,
        approved_certificate_count=len(approved_kinds),
        approved_certificate_kinds=approved_kinds,
    )


async def _load_proof_preview(
    db: AsyncSession,
    settings: Any,
    profile_id: UUID,
    *,
    limit: int = 6,
) -> list[ProofPreviewItem]:
    stmt = (
        select(TechnicianGalleryItem, MediaAsset)
        .join(MediaAsset, MediaAsset.id == TechnicianGalleryItem.media_asset_id)
        .where(
            TechnicianGalleryItem.profile_id == profile_id,
            MediaAsset.visibility == MediaVisibility.PUBLIC,
            MediaAsset.status.in_([MediaStatus.READY, MediaStatus.UPLOADED]),
            MediaAsset.deleted_at.is_(None),
        )
        .order_by(
            TechnicianGalleryItem.display_order.asc(),
            TechnicianGalleryItem.created_at.desc(),
        )
        .limit(limit)
    )
    items: list[ProofPreviewItem] = []
    for gallery_item, asset in (await db.execute(stmt)).all():
        public_asset = _serialize_public_media(settings, asset)
        if public_asset is None:
            continue
        items.append(
            ProofPreviewItem(
                id=gallery_item.id,
                kind=gallery_item.kind,
                title=gallery_item.title,
                caption=gallery_item.caption,
                media=public_asset,
            )
        )
    return items


async def _load_showcase_media(
    db: AsyncSession,
    settings: Any,
    showcase_id: UUID,
    *,
    limit: int = 4,
) -> list[PublicCaseShowcaseMedia]:
    stmt = (
        select(CasePublicShowcaseMedia, MediaAsset)
        .join(MediaAsset, MediaAsset.id == CasePublicShowcaseMedia.media_asset_id)
        .where(CasePublicShowcaseMedia.showcase_id == showcase_id)
        .order_by(CasePublicShowcaseMedia.sequence.asc())
        .limit(limit)
    )
    items: list[PublicCaseShowcaseMedia] = []
    for showcase_media, asset in (await db.execute(stmt)).all():
        public_asset = _serialize_public_media(settings, asset)
        if public_asset is None:
            continue
        items.append(
            PublicCaseShowcaseMedia(
                id=showcase_media.id,
                kind=showcase_media.kind,
                title=showcase_media.title,
                caption=showcase_media.caption,
                media=public_asset,
            )
        )
    return items


async def _load_showcase_media_batch(
    db: AsyncSession,
    settings: Any,
    showcase_ids: list[UUID],
    *,
    limit_per_showcase: int = 1,
) -> dict[UUID, list[PublicCaseShowcaseMedia]]:
    if not showcase_ids:
        return {}
    stmt = (
        select(CasePublicShowcaseMedia, MediaAsset)
        .join(MediaAsset, MediaAsset.id == CasePublicShowcaseMedia.media_asset_id)
        .where(CasePublicShowcaseMedia.showcase_id.in_(showcase_ids))
        .order_by(
            CasePublicShowcaseMedia.showcase_id.asc(),
            CasePublicShowcaseMedia.sequence.asc(),
        )
    )
    grouped: dict[UUID, list[PublicCaseShowcaseMedia]] = {
        showcase_id: [] for showcase_id in showcase_ids
    }
    for showcase_media, asset in (await db.execute(stmt)).all():
        current = grouped.setdefault(showcase_media.showcase_id, [])
        if len(current) >= limit_per_showcase:
            continue
        public_asset = _serialize_public_media(settings, asset)
        if public_asset is None:
            continue
        current.append(
            PublicCaseShowcaseMedia(
                id=showcase_media.id,
                kind=showcase_media.kind,
                title=showcase_media.title,
                caption=showcase_media.caption,
                media=public_asset,
            )
        )
    return grouped


def _showcase_preview_from_row(
    row: CasePublicShowcase,
    media_items: list[PublicCaseShowcaseMedia],
) -> PublicCaseShowcasePreview:
    snapshot = dict(row.public_snapshot or {})
    return PublicCaseShowcasePreview(
        id=row.id,
        kind=row.kind,
        kind_label=str(snapshot_value(snapshot, "kind_label") or row.kind.value),
        title=str(snapshot_value(snapshot, "title") or "Tamamlanan iş"),
        summary=str(snapshot_value(snapshot, "summary") or "Servis süreci tamamlandı."),
        month_label=snapshot_value(snapshot, "month_label"),
        location_label=snapshot_value(snapshot, "location_label"),
        rating=snapshot_value(snapshot, "rating"),
        review_body=snapshot_value(snapshot, "review_body"),
        media=media_items[0] if media_items else None,
    )


def _showcase_detail_from_row(
    row: CasePublicShowcase,
    media_items: list[PublicCaseShowcaseMedia],
) -> PublicCaseShowcaseDetail:
    snapshot = dict(row.public_snapshot or {})
    return PublicCaseShowcaseDetail(
        **_showcase_preview_from_row(row, media_items).model_dump(),
        delivery_report=snapshot_value(snapshot, "delivery_report") or [],
        media_items=media_items,
    )


async def _load_case_showcases(
    db: AsyncSession,
    settings: Any,
    profile_id: UUID,
    *,
    limit: int = 4,
) -> list[PublicCaseShowcasePreview]:
    stmt = (
        select(CasePublicShowcase)
        .where(
            CasePublicShowcase.technician_profile_id == profile_id,
            CasePublicShowcase.status == CasePublicShowcaseStatus.PUBLISHED,
        )
        .order_by(
            CasePublicShowcase.published_at.desc(),
            CasePublicShowcase.created_at.desc(),
        )
        .limit(limit)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    media_by_showcase = await _load_showcase_media_batch(
        db,
        settings,
        [row.id for row in rows],
        limit_per_showcase=1,
    )
    return [
        _showcase_preview_from_row(row, media_by_showcase.get(row.id, []))
        for row in rows
    ]


async def _build_operations_summary(
    db: AsyncSession,
    profile: TechnicianProfile,
    location: LocationSummary,
) -> OperationsSummary:
    service_area = (
        await db.execute(
            select(TechnicianServiceArea).where(
                TechnicianServiceArea.profile_id == profile.id
            )
        )
    ).scalar_one_or_none()
    capability = await db.get(TechnicianCapability, profile.id)
    capacity = await db.get(TechnicianCapacity, profile.id)

    mobile_unit_count = (
        int(service_area.mobile_unit_count) if service_area is not None else 0
    )
    on_site_repair = bool(capability and capability.on_site_repair)
    return OperationsSummary(
        location_summary=location,
        area_label=profile.area_label,
        working_hours=profile.working_hours,
        mobile_service=on_site_repair or mobile_unit_count > 0,
        valet_service=bool(capability and capability.valet_service),
        on_site_repair=on_site_repair,
        towing_coordination=bool(capability and capability.towing_coordination),
        mobile_unit_count=mobile_unit_count,
        staff_count=int(capacity.staff_count) if capacity is not None else None,
        max_concurrent_jobs=(
            int(capacity.max_concurrent_jobs) if capacity is not None else None
        ),
        night_service=bool(capacity and capacity.night_service),
        weekend_service=bool(capacity and capacity.weekend_service),
        emergency_service=bool(capacity and capacity.emergency_service),
    )


def _accepting_new_jobs(availability: TechnicianAvailability) -> bool:
    return availability == TechnicianAvailability.AVAILABLE


async def _load_context_case_and_vehicle(
    db: AsyncSession,
    user: User,
    *,
    case_id: UUID | None,
    vehicle_id: UUID | None,
) -> tuple[Any | None, Vehicle | None]:
    context_case = None
    context_vehicle = None
    if case_id is not None:
        context_case = await case_repo.get_case(db, case_id)
        if (
            context_case is None
            or context_case.deleted_at is not None
            or context_case.customer_user_id != user.id
        ):
            raise HTTPException(
                status_code=404,
                detail={"type": "case_not_found"},
            )
        context_vehicle = await db.get(Vehicle, context_case.vehicle_id)
        if vehicle_id is not None and context_case.vehicle_id != vehicle_id:
            raise HTTPException(
                status_code=422,
                detail={"type": "case_vehicle_mismatch"},
            )
    elif vehicle_id is not None:
        owned = await db.scalar(
            select(UserVehicleLink.id).where(
                UserVehicleLink.user_id == user.id,
                UserVehicleLink.vehicle_id == vehicle_id,
                UserVehicleLink.ownership_to.is_(None),
            )
        )
        if owned is None:
            raise HTTPException(
                status_code=404,
                detail={"type": "vehicle_not_found"},
            )
        context_vehicle = await db.get(Vehicle, vehicle_id)
        if context_vehicle is None or context_vehicle.deleted_at is not None:
            raise HTTPException(
                status_code=404,
                detail={"type": "vehicle_not_found"},
            )
    return context_case, context_vehicle


async def _notification_context(
    db: AsyncSession,
    *,
    case_id: UUID | None,
    profiles: list[TechnicianProfile],
) -> dict[UUID, dict[str, object]]:
    if case_id is None or not profiles:
        return {}
    user_ids = [profile.user_id for profile in profiles]
    notifications = (
        await db.execute(
            select(CaseTechnicianNotification).where(
                CaseTechnicianNotification.case_id == case_id,
                CaseTechnicianNotification.technician_user_id.in_(user_ids),
            )
        )
    ).scalars().all()
    active_count = int(
        await db.scalar(
            select(func.count(CaseTechnicianNotification.id)).where(
                CaseTechnicianNotification.case_id == case_id,
                CaseTechnicianNotification.status.in_(
                    case_matching.ACTIVE_NOTIFICATION_STATUSES
                ),
            )
        )
        or 0
    )
    offers = (
        await db.execute(
            select(CaseOffer.technician_id).where(
                CaseOffer.case_id == case_id,
                CaseOffer.technician_id.in_(user_ids),
                CaseOffer.status.in_(ACTIVE_OFFER_STATUSES),
            )
        )
    ).scalars().all()
    ctx: dict[UUID, dict[str, object]] = {
        profile.user_id: {
            "is_notified_to_me": False,
            "has_offer_from_me": False,
            "notification_limit_reached": active_count
            >= case_matching.MAX_CUSTOMER_NOTIFICATIONS_PER_CASE,
        }
        for profile in profiles
    }
    for notification in notifications:
        ctx.setdefault(notification.technician_user_id, {})[
            "is_notified_to_me"
        ] = notification.status in case_matching.ACTIVE_NOTIFICATION_STATUSES
    for technician_id in offers:
        ctx.setdefault(technician_id, {})["has_offer_from_me"] = True
    return ctx


def _notify_state_for_feed(
    *,
    has_case_context: bool,
    compatibility_state: str,
    is_notified: bool,
    has_offer: bool,
    notification_limit_reached: bool,
) -> tuple[bool, str, str | None]:
    if not has_case_context or compatibility_state != "notifyable":
        return False, "not_compatible", "not_compatible"
    if has_offer:
        return False, "has_offer", "has_offer"
    if is_notified:
        return False, "already_notified", "already_notified"
    if notification_limit_reached:
        return False, "limit_reached", "case_notification_limit_reached"
    return True, "available", None


@router.get(
    "/feed",
    response_model=PaginatedResponse[TechnicianFeedItem],
    summary="Public teknisyen feed — admission quick-check filter + tier sort",
)
async def get_public_feed(
    user: CurrentUserDep,
    db: DbDep,
    redis: RedisDep,
    settings: SettingsDep,
    cursor: CursorQuery = None,
    limit: LimitQuery = 20,
    domain: OptionalDomainQuery = None,
    brand: OptionalDomainQuery = None,
    district: OptionalDistrictQuery = None,
    vehicle_id: OptionalUuidQuery = None,
    case_id: OptionalUuidQuery = None,
) -> PaginatedResponse[TechnicianFeedItem]:
    context_case, context_vehicle = await _load_context_case_and_vehicle(
        db,
        user,
        case_id=case_id,
        vehicle_id=vehicle_id,
    )
    context_aware = any([context_case, context_vehicle, domain, brand, district])

    cache_key = public_feed_key(cursor=cursor, limit=limit)
    if not context_aware:
        cached_raw = await redis.get(cache_key)
        if cached_raw is not None:
            try:
                payload_str = (
                    cached_raw if isinstance(cached_raw, str) else cached_raw.decode()
                )
                return PaginatedResponse[TechnicianFeedItem].model_validate_json(
                    payload_str
                )
            except Exception:
                pass  # cache corrupt — fall through

    cursor_data = decode_cursor(cursor)

    tier_rank = case(
        (TechnicianProfile.verified_level == TechnicianVerifiedLevel.PREMIUM, 2),
        (TechnicianProfile.verified_level == TechnicianVerifiedLevel.VERIFIED, 1),
        else_=0,
    ).label("tier_rank")

    service_domain_exists = exists().where(
        TechnicianServiceDomain.profile_id == TechnicianProfile.id
    )
    service_area_exists = exists().where(
        TechnicianServiceArea.profile_id == TechnicianProfile.id
    )
    domain_exists = exists().where(
        TechnicianServiceDomain.profile_id == TechnicianProfile.id
    )
    brand_exists = exists().where(
        TechnicianBrandCoverage.profile_id == TechnicianProfile.id
    )

    conds = [
        TechnicianProfile.deleted_at.is_(None),
        TechnicianProfile.availability.in_(
            [TechnicianAvailability.AVAILABLE, TechnicianAvailability.BUSY]
        ),
        User.status == UserStatus.ACTIVE,
        User.approval_status == UserApprovalStatus.ACTIVE,
        User.role == UserRole.TECHNICIAN,
        service_domain_exists,
        service_area_exists,
    ]
    if domain:
        conds.append(
            domain_exists.where(TechnicianServiceDomain.domain_key == domain)
        )
    if brand:
        conds.append(
            brand_exists.where(TechnicianBrandCoverage.brand_key == brand)
        )
    if district:
        district_exists = exists().where(
            TechnicianWorkingDistrict.profile_id == TechnicianProfile.id,
            TechnicianWorkingDistrict.district_id == TaxonomyDistrict.district_id,
            TaxonomyDistrict.label.ilike(f"%{district}%"),
        )
        conds.append(district_exists)

    if cursor_data is not None and not context_aware:
        last_sort = cursor_data.get("sort")
        last_id = cursor_data.get("id")
        if isinstance(last_sort, int) and isinstance(last_id, str):
            conds.append(
                (tier_rank < last_sort)
                | (
                    (tier_rank == last_sort)
                    & (TechnicianProfile.id > UUID(last_id))
                )
            )

    stmt = (
        select(TechnicianProfile)
        .join(User, User.id == TechnicianProfile.user_id)
        .where(and_(*conds))
        .order_by(tier_rank.desc(), TechnicianProfile.id.asc())
        .limit(200 if context_aware else limit + 1)
    )
    rows = list((await db.execute(stmt)).scalars().all())

    snapshots = await _load_snapshot_aggregates(db, [p.id for p in rows])
    notification_context = await _notification_context(
        db,
        case_id=context_case.id if context_case is not None else None,
        profiles=rows,
    )

    items: list[TechnicianFeedItem] = []
    for p in rows:
        fit = await case_matching.evaluate_profile_fit(
            db,
            profile=p,
            case=context_case,
            vehicle=context_vehicle,
        )
        nctx = notification_context.get(p.user_id, {})
        is_notified = bool(nctx.get("is_notified_to_me"))
        has_offer = bool(nctx.get("has_offer_from_me"))
        notification_limit_reached = bool(nctx.get("notification_limit_reached"))
        can_notify, notify_state, disabled_reason = _notify_state_for_feed(
            has_case_context=context_case is not None,
            compatibility_state=fit.compatibility_state,
            is_notified=is_notified,
            has_offer=has_offer,
            notification_limit_reached=notification_limit_reached,
        )
        snap = snapshots.get(p.id)
        rating_bayesian = snap[1] if snap else None
        rating_count = int(snap[2]) if snap else 0
        completed_jobs_30d = int(snap[3]) if snap else 0
        location = await _build_location_summary(db, p.id)
        proof_preview = await _load_proof_preview(db, settings, p.id, limit=3)
        case_showcases = await _load_case_showcases(db, settings, p.id, limit=1)
        items.append(
            TechnicianFeedItem(
                id=p.id,
                display_name=p.display_name,
                tagline=p.tagline,
                avatar_asset_id=p.avatar_asset_id,
                verified_level=p.verified_level,
                provider_type=p.provider_type,
                secondary_provider_types=list(p.secondary_provider_types or []),
                active_provider_type=p.active_provider_type,
                accepting_new_jobs=_accepting_new_jobs(p.availability),
                rating_bayesian=rating_bayesian,
                rating_count=rating_count,
                completed_jobs_30d=completed_jobs_30d,
                location_summary=location,
                proof_preview=proof_preview,
                case_showcases=case_showcases,
                context_score=fit.context_score,
                context_group=fit.context_group,
                context_tier=fit.context_tier,
                compatibility_state=fit.compatibility_state,
                match_badge=fit.match_badge,
                notify_badge=fit.notify_badge,
                match_reason_label=fit.match_reason_label,
                fit_signals=fit.fit_signals,
                fit_badges=fit.fit_badges,
                is_vehicle_compatible=fit.is_vehicle_compatible,
                is_case_compatible=fit.is_case_compatible,
                can_notify=can_notify,
                notify_state=notify_state,
                notify_disabled_reason=disabled_reason,
                is_notified_to_me=is_notified,
                has_offer_from_me=has_offer,
            )
        )

    if context_aware:
        items.sort(
            key=lambda item: (
                0 if item.context_group == "primary" else 1,
                -float(item.context_score),
                -_VERIFIED_TIER_ORDER[item.verified_level],
                str(item.id),
            )
        )
        start = 0
        if cursor_data is not None and isinstance(cursor_data.get("id"), str):
            cursor_id = str(cursor_data["id"])
            for index, item in enumerate(items):
                if str(item.id) == cursor_id:
                    start = index + 1
                    break
        page_items = items[start : start + limit]
        next_cursor = (
            encode_cursor(id_=page_items[-1].id, sort_value="context")
            if start + limit < len(items) and page_items
            else None
        )
        paginated = PaginatedResponse(items=page_items, next_cursor=next_cursor)
    else:
        paginated = build_paginated(
            items,
            limit=limit,
            cursor_fn=lambda item: encode_cursor(
                id_=item.id, sort_value=_VERIFIED_TIER_ORDER[item.verified_level]
            ),
        )

    if not context_aware:
        await redis.set(
            cache_key, paginated.model_dump_json(), ex=PUBLIC_FEED_TTL_SECONDS
        )
    return paginated


@router.get(
    "/{technician_id}/showcases/{showcase_id}",
    response_model=PublicCaseShowcaseDetail,
    summary="Public usta profilindeki doğrulanmış iş detayı",
)
async def get_public_showcase_detail(
    technician_id: UUID,
    showcase_id: UUID,
    _user: CurrentUserDep,
    db: DbDep,
    settings: SettingsDep,
) -> PublicCaseShowcaseDetail:
    stmt = select(CasePublicShowcase).where(
        CasePublicShowcase.id == showcase_id,
        CasePublicShowcase.technician_profile_id == technician_id,
        CasePublicShowcase.status == CasePublicShowcaseStatus.PUBLISHED,
    )
    showcase = (await db.execute(stmt)).scalar_one_or_none()
    if showcase is None:
        raise HTTPException(status_code=404, detail={"type": "showcase_not_found"})
    media_items = await _load_showcase_media(db, settings, showcase.id, limit=4)
    return _showcase_detail_from_row(showcase, media_items)


@router.get("/{technician_id}", response_model=TechnicianPublicView)
async def get_public_profile(
    technician_id: UUID,
    _user: CurrentUserDep,
    db: DbDep,
    redis: RedisDep,
    settings: SettingsDep,
) -> TechnicianPublicView:
    """Tek teknisyenin public detay görünümü. PII mask sıkı."""
    profile = await db.get(TechnicianProfile, technician_id)
    if (
        profile is None
        or profile.deleted_at is not None
    ):
        raise HTTPException(
            status_code=404, detail={"type": "technician_not_found"}
        )

    # User status kontrolü — suspended/deleted teknisyen public'te görünmez
    owner = await db.get(User, profile.user_id)
    if (
        owner is None
        or owner.status != UserStatus.ACTIVE
        or owner.role != UserRole.TECHNICIAN
    ):
        raise HTTPException(
            status_code=404, detail={"type": "technician_not_found"}
        )

    # Cache check
    cache_key = public_profile_key(
        technician_id, int(profile.role_config_version)
    )
    cached = await get_cached_model(
        redis, key=cache_key, model=TechnicianPublicView
    )
    if cached is not None:
        return cached

    # Snapshot aggregate (30d)
    snapshots = await _load_snapshot_aggregates(db, [profile.id])
    snap = snapshots.get(profile.id)
    rating_bayesian = snap[1] if snap else None
    rating_count = int(snap[2]) if snap else 0
    completed_jobs_30d = int(snap[3]) if snap else 0
    response_time = snap[4] if snap else None

    location = await _build_location_summary(db, profile.id)
    accepting_new_jobs = _accepting_new_jobs(profile.availability)
    avatar_media = await _load_public_asset(db, settings, profile.avatar_asset_id)
    fit_summary = await _build_fit_summary(db, profile)
    trust_summary = await _build_trust_summary(
        db,
        profile,
        rating_bayesian=rating_bayesian,
        rating_count=rating_count,
        completed_jobs_30d=completed_jobs_30d,
        response_time_p50_minutes=response_time,
    )
    proof_preview = await _load_proof_preview(db, settings, profile.id)
    case_showcases = await _load_case_showcases(db, settings, profile.id)
    operations = await _build_operations_summary(db, profile, location)

    view = TechnicianPublicView(
        id=profile.id,
        user_id=profile.user_id,
        display_name=profile.display_name,
        tagline=profile.tagline,
        biography=profile.biography,
        avatar_asset_id=profile.avatar_asset_id,
        verified_level=profile.verified_level,
        provider_type=profile.provider_type,
        secondary_provider_types=list(profile.secondary_provider_types or []),
        active_provider_type=profile.active_provider_type,
        provider_mode=profile.provider_mode,
        accepting_new_jobs=accepting_new_jobs,
        rating_bayesian=rating_bayesian,
        rating_count=rating_count,
        completed_jobs_30d=completed_jobs_30d,
        response_time_p50_minutes=response_time,
        location_summary=location,
        identity=PublicIdentitySummary(
            display_name=profile.display_name,
            tagline=profile.tagline,
            provider_type=profile.provider_type,
            secondary_provider_types=list(profile.secondary_provider_types or []),
            active_provider_type=profile.active_provider_type,
            provider_mode=profile.provider_mode,
            avatar_asset_id=profile.avatar_asset_id,
            avatar_media=avatar_media,
            verified_level=profile.verified_level,
            accepting_new_jobs=accepting_new_jobs,
        ),
        fit_summary=fit_summary,
        trust_summary=trust_summary,
        proof_preview=proof_preview,
        case_showcases=case_showcases,
        operations=operations,
        about=PublicAbout(
            biography=profile.biography,
            service_note=profile.tagline,
        ),
    )
    await set_cached_model(
        redis, key=cache_key, value=view, ttl=PUBLIC_PROFILE_TTL_SECONDS
    )
    return view
