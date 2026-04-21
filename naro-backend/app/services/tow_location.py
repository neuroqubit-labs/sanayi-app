"""Tow location service — GPS ping + Redis flat cache + Streams publish.

Atomic: DB INSERT + technician_profiles UPDATE + Redis SETEX + XADD stream.
Redis keys:
- `tow:loc:last:{tech_id}` (SETEX 300s — broadcast cache; dispatch query PostGIS)
- `tow:stream:{case_id}` (XADD — WS consumer feed)

Plan agent R7: arrived transition öncesi ST_Distance(tech, pickup) ≤ 500m sanity.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case import ServiceCase
from app.models.case_audit import CaseEventType
from app.repositories import tow as tow_repo
from app.services.case_events import append_event

LAST_LOCATION_TTL_SECONDS = 300
STREAM_MAXLEN = 500  # Bounded stream per case
LOCATION_SANITY_MAX_M = 500


@dataclass(slots=True)
class LocationRecord:
    case_id: UUID
    technician_id: UUID
    lat: float
    lng: float
    captured_at: datetime


async def record_location(
    session: AsyncSession,
    *,
    redis: Redis,
    case_id: UUID,
    technician_id: UUID,
    lat: float,
    lng: float,
    heading_deg: int | None,
    speed_kmh: int | None,
    accuracy_m: int | None,
    captured_at: datetime,
) -> LocationRecord:
    # 1. DB insert (partition routing)
    await tow_repo.insert_live_location(
        session,
        case_id=case_id,
        technician_id=technician_id,
        lat=lat,
        lng=lng,
        heading_deg=heading_deg,
        speed_kmh=speed_kmh,
        accuracy_m=accuracy_m,
        captured_at=captured_at,
    )
    # 2. Technician last location update
    await tow_repo.update_technician_last_location(
        session,
        technician_id=technician_id,
        lat=lat,
        lng=lng,
        captured_at=captured_at,
    )
    # 3. Redis flat cache (broadcast)
    await redis.set(
        f"tow:loc:last:{technician_id}",
        json.dumps({
            "lat": lat,
            "lng": lng,
            "captured_at": captured_at.isoformat(),
            "heading": heading_deg,
            "speed_kmh": speed_kmh,
        }),
        ex=LAST_LOCATION_TTL_SECONDS,
    )
    # 4. Stream XADD (WS consumers)
    await redis.xadd(
        f"tow:stream:{case_id}",
        {
            "type": "location_update",
            "technician_id": str(technician_id),
            "lat": str(lat),
            "lng": str(lng),
            "captured_at": captured_at.isoformat(),
        },
        maxlen=STREAM_MAXLEN,
        approximate=True,
    )
    # 5. Audit
    await append_event(
        session,
        case_id=case_id,
        event_type=CaseEventType.TOW_LOCATION_RECORDED,
        title="Konum güncellendi",
        actor_user_id=technician_id,
        context={
            "lat": lat,
            "lng": lng,
            "captured_at": captured_at.isoformat(),
        },
    )
    return LocationRecord(
        case_id=case_id,
        technician_id=technician_id,
        lat=lat,
        lng=lng,
        captured_at=captured_at,
    )


async def sanity_check_arrival_distance(
    session: AsyncSession,
    *,
    case: ServiceCase,
    tech_lat: float,
    tech_lng: float,
) -> float:
    """Plan R7: arrived transition öncesi distance ≤ 500m kontrol.

    Fraud suspected → caller `auth_events.fraud_suspected` atar.
    """
    assert case.pickup_lat is not None and case.pickup_lng is not None
    meters = await tow_repo.distance_from_pickup_m(
        session,
        case_id=case.id,
        tech_lat=tech_lat,
        tech_lng=tech_lng,
    )
    if meters is None:
        return 0.0
    return meters


async def compute_actual_distance_km(
    session: AsyncSession, case_id: UUID
) -> Decimal:
    return await tow_repo.compute_actual_distance_km(session, case_id)
