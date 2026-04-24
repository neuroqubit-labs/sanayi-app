"""ARQ job — heartbeat enforcer (Plan R2).

Availability='available' olup freshness penceresini aşan teknisyenleri offline'a
çeker. Dispatch query aynı pencereyi kullandığı için bu job ek güvenlik katmanı.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import text as _text

from app.core.config import get_settings
from app.db.session import get_db


async def heartbeat_enforcer(ctx: dict[str, object]) -> None:
    """QA tur 3 P0-1 fix: mock tech bypass — pilot dev ortamında mock
    cekici'ler last_location_at refresh edilmezse offline'a düşerdi →
    dispatch 0 aday → UC-1 bloke. Mock exclude (is_mock=false filtresi);
    production (is_mock=false) davranışı değişmedi.
    """
    _ = ctx
    settings = get_settings()
    cutoff = datetime.now(UTC) - timedelta(
        seconds=settings.tow_heartbeat_seconds + settings.tow_heartbeat_grace_seconds
    )
    async for session in get_db():
        await session.execute(
            _text(
                """
                UPDATE technician_profiles
                SET availability = 'offline'::technician_availability
                WHERE availability = 'available'::technician_availability
                  AND provider_type = 'cekici'::provider_type
                  AND is_mock = false
                  AND (last_location_at IS NULL OR last_location_at < :cutoff)
                """
            ),
            {"cutoff": cutoff},
        )
        await session.commit()
        break
