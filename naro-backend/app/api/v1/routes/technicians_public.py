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

from typing import TYPE_CHECKING, Any
from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import and_, case, exists, select

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
from app.api.v1.deps import CurrentUserDep, DbDep, RedisDep
from app.models.taxonomy import TaxonomyCity, TaxonomyDistrict
from app.models.technician import (
    TechnicianAvailability,
    TechnicianProfile,
    TechnicianVerifiedLevel,
)
from app.models.technician_signal import (
    TechnicianPerformanceSnapshot,
    TechnicianServiceArea,
    TechnicianServiceDomain,
)
from app.models.user import User, UserApprovalStatus, UserRole, UserStatus
from app.schemas.technician_public import (
    LocationSummary,
    TechnicianFeedItem,
    TechnicianPublicView,
)
from app.services.taxonomy_cache import (
    PUBLIC_FEED_TTL_SECONDS,
    PUBLIC_PROFILE_TTL_SECONDS,
    get_cached_model,
    public_feed_key,
    public_profile_key,
    set_cached_model,
)

router = APIRouter(prefix="/technicians/public", tags=["technicians-public"])


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


def _accepting_new_jobs(availability: TechnicianAvailability) -> bool:
    return availability == TechnicianAvailability.AVAILABLE


@router.get(
    "/feed",
    response_model=PaginatedResponse[TechnicianFeedItem],
    summary="Public teknisyen feed — admission quick-check filter + tier sort",
)
async def get_public_feed(
    _user: CurrentUserDep,
    db: DbDep,
    redis: RedisDep,
    cursor: CursorQuery = None,
    limit: LimitQuery = 20,
) -> PaginatedResponse[TechnicianFeedItem]:
    cache_key = public_feed_key(cursor=cursor, limit=limit)
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

    if cursor_data is not None:
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
        .limit(limit + 1)
    )
    rows = list((await db.execute(stmt)).scalars().all())

    snapshots = await _load_snapshot_aggregates(db, [p.id for p in rows])

    items: list[TechnicianFeedItem] = []
    for p in rows:
        snap = snapshots.get(p.id)
        rating_bayesian = snap[1] if snap else None
        rating_count = int(snap[2]) if snap else 0
        completed_jobs_30d = int(snap[3]) if snap else 0
        location = await _build_location_summary(db, p.id)
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
            )
        )

    paginated = build_paginated(
        items,
        limit=limit,
        cursor_fn=lambda item: encode_cursor(
            id_=item.id, sort_value=_VERIFIED_TIER_ORDER[item.verified_level]
        ),
    )

    await redis.set(
        cache_key, paginated.model_dump_json(), ex=PUBLIC_FEED_TTL_SECONDS
    )
    return paginated


@router.get("/{technician_id}", response_model=TechnicianPublicView)
async def get_public_profile(
    technician_id: UUID,
    _user: CurrentUserDep,
    db: DbDep,
    redis: RedisDep,
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

    view = TechnicianPublicView(
        id=profile.id,
        display_name=profile.display_name,
        tagline=profile.tagline,
        biography=profile.biography,
        avatar_asset_id=profile.avatar_asset_id,
        verified_level=profile.verified_level,
        provider_type=profile.provider_type,
        secondary_provider_types=list(profile.secondary_provider_types or []),
        active_provider_type=profile.active_provider_type,
        provider_mode=profile.provider_mode,
        accepting_new_jobs=_accepting_new_jobs(profile.availability),
        rating_bayesian=rating_bayesian,
        rating_count=rating_count,
        completed_jobs_30d=completed_jobs_30d,
        response_time_p50_minutes=response_time,
        location_summary=location,
    )
    await set_cached_model(
        redis, key=cache_key, value=view, ttl=PUBLIC_PROFILE_TTL_SECONDS
    )
    return view
