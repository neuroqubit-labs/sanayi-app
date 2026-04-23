"""Dev ops — mock tech last_location_at refresh (QA tur 2 P0-1).

Mock seed tech'lerinin last_location_at heartbeat'ını NOW()'a çeker.
Dispatch SQL cutoff (90sn) yeni case'ler için candidate listesine mock
tech'lerin girmesini sağlar.

Kullanım:
    cd naro-backend
    set -a && source .env.local && set +a
    uv run python scripts/heartbeat_mock_techs.py

Idempotent — her run heartbeat fresh. Production'da çağrılmaz.
V1.1: ARQ cron + dev-mode flag (prod guard).
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime

from sqlalchemy import text as _text

from app.db.session import AsyncSessionLocal

logger = logging.getLogger("heartbeat_mock_techs")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")


async def main() -> None:
    async with AsyncSessionLocal() as db:
        now = datetime.now(UTC)
        result = await db.execute(
            _text(
                """
                UPDATE technician_profiles
                SET last_location_at = :now
                WHERE is_mock = true
                  AND last_known_location IS NOT NULL
                """
            ),
            {"now": now},
        )
        await db.commit()
        count = int(getattr(result, "rowcount", 0) or 0)
        logger.info(
            "heartbeat refreshed for %d mock tech (last_location_at=NOW)",
            count,
        )


if __name__ == "__main__":
    asyncio.run(main())
