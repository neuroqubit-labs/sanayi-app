"""/taxonomy/* router — 5 read-only endpoint, Redis cache 1h TTL.

Cache pattern: `taxonomy:{resource}:{filter?}:v1`. Miss → DB query + cache set.
Read path için `any auth` yeter; rate limit Faz A sonu generic middleware ile
gelecek.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from app.api.v1.deps import CurrentUserDep, DbDep, RedisDep
from app.models.taxonomy import (
    TaxonomyBrand,
    TaxonomyDistrict,
    TaxonomyDrivetrain,
    TaxonomyProcedure,
    TaxonomyServiceDomain,
)
from app.schemas.taxonomy import (
    BrandOut,
    DistrictOut,
    DrivetrainOut,
    ProcedureOut,
    ServiceDomainOut,
)
from app.services.taxonomy_cache import (
    TAXONOMY_TTL_SECONDS,
    fetch_or_cache_list,
    taxonomy_key,
)

router = APIRouter(prefix="/taxonomy", tags=["taxonomy"])


@router.get("/service-domains", response_model=list[ServiceDomainOut])
async def get_service_domains(
    _user: CurrentUserDep,
    db: DbDep,
    redis: RedisDep,
) -> list[ServiceDomainOut]:
    async def _load() -> list[ServiceDomainOut]:
        stmt = (
            select(TaxonomyServiceDomain)
            .where(TaxonomyServiceDomain.is_active.is_(True))
            .order_by(TaxonomyServiceDomain.display_order, TaxonomyServiceDomain.domain_key)
        )
        rows = list((await db.execute(stmt)).scalars().all())
        return [ServiceDomainOut.model_validate(r) for r in rows]

    return await fetch_or_cache_list(
        redis,
        key=taxonomy_key("service_domains"),
        model=ServiceDomainOut,
        ttl=TAXONOMY_TTL_SECONDS,
        loader=_load,
    )


@router.get("/procedures", response_model=list[ProcedureOut])
async def get_procedures(
    _user: CurrentUserDep,
    db: DbDep,
    redis: RedisDep,
    domain: Annotated[
        str | None,
        Query(description="Filter by domain_key", min_length=1, max_length=40),
    ] = None,
) -> list[ProcedureOut]:
    async def _load() -> list[ProcedureOut]:
        stmt = select(TaxonomyProcedure).where(
            TaxonomyProcedure.is_active.is_(True)
        )
        if domain:
            stmt = stmt.where(TaxonomyProcedure.domain_key == domain)
        stmt = stmt.order_by(
            TaxonomyProcedure.domain_key,
            TaxonomyProcedure.is_popular.desc(),
            TaxonomyProcedure.display_order,
            TaxonomyProcedure.procedure_key,
        )
        rows = list((await db.execute(stmt)).scalars().all())
        return [ProcedureOut.model_validate(r) for r in rows]

    return await fetch_or_cache_list(
        redis,
        key=taxonomy_key("procedures", domain),
        model=ProcedureOut,
        ttl=TAXONOMY_TTL_SECONDS,
        loader=_load,
    )


@router.get("/brands", response_model=list[BrandOut])
async def get_brands(
    _user: CurrentUserDep,
    db: DbDep,
    redis: RedisDep,
) -> list[BrandOut]:
    async def _load() -> list[BrandOut]:
        stmt = (
            select(TaxonomyBrand)
            .where(TaxonomyBrand.is_active.is_(True))
            .order_by(TaxonomyBrand.display_order, TaxonomyBrand.brand_key)
        )
        rows = list((await db.execute(stmt)).scalars().all())
        return [BrandOut.model_validate(r) for r in rows]

    return await fetch_or_cache_list(
        redis,
        key=taxonomy_key("brands"),
        model=BrandOut,
        ttl=TAXONOMY_TTL_SECONDS,
        loader=_load,
    )


@router.get("/districts", response_model=list[DistrictOut])
async def get_districts(
    _user: CurrentUserDep,
    db: DbDep,
    redis: RedisDep,
    city: Annotated[
        str,
        Query(description="TR plaka kodu", min_length=1, max_length=8),
    ],
) -> list[DistrictOut]:
    # city param zorunlu — tüm ilçelerin listesi V1'de yok (çok büyür).
    async def _load() -> list[DistrictOut]:
        stmt = (
            select(TaxonomyDistrict)
            .where(
                TaxonomyDistrict.city_code == city,
                TaxonomyDistrict.is_active.is_(True),
            )
            .order_by(TaxonomyDistrict.label)
        )
        rows = list((await db.execute(stmt)).scalars().all())
        if not rows:
            # Boş sonuç cache'lenir; 404 dönme — valid city olabilir ama
            # henüz seed yok (IST/ANK/IZM dışı iller şu an boş).
            return []
        return [DistrictOut.model_validate(r) for r in rows]

    # city_code basit sanitize — alnum+"_"
    if not city.replace("_", "").isalnum():
        raise HTTPException(
            status_code=400, detail={"type": "invalid_city_code"}
        )
    return await fetch_or_cache_list(
        redis,
        key=taxonomy_key("districts", city),
        model=DistrictOut,
        ttl=TAXONOMY_TTL_SECONDS,
        loader=_load,
    )


@router.get("/drivetrains", response_model=list[DrivetrainOut])
async def get_drivetrains(
    _user: CurrentUserDep,
    db: DbDep,
    redis: RedisDep,
) -> list[DrivetrainOut]:
    async def _load() -> list[DrivetrainOut]:
        stmt = select(TaxonomyDrivetrain).order_by(
            TaxonomyDrivetrain.display_order, TaxonomyDrivetrain.drivetrain_key
        )
        rows = list((await db.execute(stmt)).scalars().all())
        return [DrivetrainOut.model_validate(r) for r in rows]

    return await fetch_or_cache_list(
        redis,
        key=taxonomy_key("drivetrains"),
        model=DrivetrainOut,
        ttl=TAXONOMY_TTL_SECONDS,
        loader=_load,
    )
