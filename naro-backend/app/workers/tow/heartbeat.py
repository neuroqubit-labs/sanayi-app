"""ARQ job — heartbeat enforcer (Plan R2).

Her 30sn: availability='available' ama last_location_at 90sn+ eski teknisyenleri
availability='offline' yap. Dispatch query `last_location_at > NOW - 90s` filter
ile zaten güvende; bu job ek güvenlik katmanı + WS push.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import text as _text

from app.core.config import get_settings
from app.db.session import get_db


async def heartbeat_enforcer(ctx: dict[str, object]) -> None:
    settings = get_settings()
    cutoff = datetime.now(UTC) - timedelta(seconds=settings.tow_heartbeat_seconds)
    async for session in get_db():
        await session.execute(
            _text(
                """
                UPDATE technician_profiles
                SET availability = 'offline'::technician_availability
                WHERE availability = 'available'::technician_availability
                  AND provider_type = 'cekici'::provider_type
                  AND (last_location_at IS NULL OR last_location_at < :cutoff)
                """
            ),
            {"cutoff": cutoff},
        )
        await session.commit()
        break
