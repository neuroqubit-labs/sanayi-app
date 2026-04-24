"""Redis-backed tow presence read model.

Postgres/PostGIS remains canonical for dispatch rules. Redis stores hot,
TTL-backed presence and GEO indexes so nearby lookup can avoid a wide DB scan
when the cache is healthy.
"""

from __future__ import annotations

import json
from datetime import datetime
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.technician import TechnicianProfile
from app.models.technician_signal import TechnicianServiceArea

GLOBAL_CITY_CODE = "global"
DEFAULT_GEO_LIMIT = 100


def presence_key(technician_id: UUID) -> str:
    return f"tow:presence:{technician_id}"


def geo_key(city_code: str) -> str:
    return f"tow:geo:available:{city_code or GLOBAL_CITY_CODE}"


def available_set_key(city_code: str) -> str:
    return f"tow:available:{city_code or GLOBAL_CITY_CODE}"


def ttl_seconds() -> int:
    settings = get_settings()
    return int(settings.tow_heartbeat_seconds + settings.tow_heartbeat_grace_seconds)


async def resolve_city_code(
    session: AsyncSession, profile: TechnicianProfile
) -> str:
    city_code = (
        await session.execute(
            select(TechnicianServiceArea.city_code).where(
                TechnicianServiceArea.profile_id == profile.id
            )
        )
    ).scalar_one_or_none()
    return city_code or GLOBAL_CITY_CODE


async def mark_available(
    session: AsyncSession,
    redis: Redis,
    *,
    profile: TechnicianProfile,
    technician_id: UUID,
    lat: float,
    lng: float,
    captured_at: datetime,
) -> bool:
    city_code = await resolve_city_code(session, profile)
    payload = {
        "technician_id": str(technician_id),
        "profile_id": str(profile.id),
        "city_code": city_code,
        "lat": lat,
        "lng": lng,
        "captured_at": captured_at.isoformat(),
    }
    member = str(technician_id)
    ttl = ttl_seconds()
    city_codes = {GLOBAL_CITY_CODE, city_code}

    try:
        await redis.set(presence_key(technician_id), json.dumps(payload), ex=ttl)
        for code in city_codes:
            await redis.execute_command("GEOADD", geo_key(code), lng, lat, member)
            await redis.sadd(available_set_key(code), member)
            await redis.expire(available_set_key(code), ttl * 2)
        return True
    except Exception:
        # Redis is a hot cache only. DB state and PostGIS fallback remain canonical.
        return False


async def mark_offline(
    session: AsyncSession,
    redis: Redis,
    *,
    profile: TechnicianProfile,
    technician_id: UUID,
) -> bool:
    member = str(technician_id)
    city_codes = {GLOBAL_CITY_CODE, await resolve_city_code(session, profile)}
    try:
        raw = await redis.get(presence_key(technician_id))
        if raw:
            decoded = raw.decode() if isinstance(raw, bytes) else str(raw)
            city = json.loads(decoded).get("city_code")
            if isinstance(city, str) and city:
                city_codes.add(city)
    except Exception:
        pass

    try:
        pipe = redis.pipeline()
        pipe.delete(presence_key(technician_id))
        for code in city_codes:
            pipe.zrem(geo_key(code), member)
            pipe.srem(available_set_key(code), member)
        await pipe.execute()
        return True
    except Exception:
        return False


async def nearby_candidate_ids(
    redis: Redis,
    *,
    pickup_lat: float,
    pickup_lng: float,
    radius_km: int,
    city_code: str | None = None,
    limit: int = DEFAULT_GEO_LIMIT,
) -> list[UUID]:
    """Return nearby technician user ids from Redis GEO, or [] on cache miss.

    The caller must still validate every candidate against DB state.
    """
    codes = [city_code or GLOBAL_CITY_CODE]
    if codes[0] != GLOBAL_CITY_CODE:
        codes.append(GLOBAL_CITY_CODE)

    out: list[UUID] = []
    seen: set[UUID] = set()
    try:
        for code in codes:
            raw = await redis.execute_command(
                "GEORADIUS",
                geo_key(code),
                pickup_lng,
                pickup_lat,
                radius_km,
                "km",
                "ASC",
                "COUNT",
                limit,
            )
            for item in raw or []:
                value = item.decode() if isinstance(item, bytes) else str(item)
                try:
                    tech_id = UUID(value)
                except ValueError:
                    continue
                if tech_id not in seen:
                    seen.add(tech_id)
                    out.append(tech_id)
    except Exception:
        return []

    if not out:
        return []

    try:
        presence_values = await redis.mget([presence_key(tech_id) for tech_id in out])
    except Exception:
        return out

    live: list[UUID] = []
    stale_members: list[str] = []
    for tech_id, raw_presence in zip(out, presence_values, strict=False):
        if raw_presence:
            live.append(tech_id)
        else:
            stale_members.append(str(tech_id))

    if stale_members:
        try:
            pipe = redis.pipeline()
            for code in codes:
                pipe.zrem(geo_key(code), *stale_members)
                pipe.srem(available_set_key(code), *stale_members)
            await pipe.execute()
        except Exception:
            pass
    return live
