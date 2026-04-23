"""Dev ops — orphan tow offer lock release (QA tur 2 P0-1).

Mock tech `current_offer_case_id` önceki testten kalan ama case
terminal (completed/cancelled/archived) olmuş veya silinmiş case'e
işaret ediyorsa NULL'a çeker → mock tech hot pool'a geri döner.

Kullanım:
    cd naro-backend
    set -a && source .env.local && set +a
    uv run python scripts/release_orphan_tow_locks.py

Idempotent. V1.1: ARQ cron orphan reaper (15 dk interval).
"""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import text as _text

from app.db.session import AsyncSessionLocal

logger = logging.getLogger("release_orphan_tow_locks")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")


async def main() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            _text(
                """
                UPDATE technician_profiles tp
                SET current_offer_case_id = NULL,
                    current_offer_issued_at = NULL
                WHERE tp.is_mock = true
                  AND tp.current_offer_case_id IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM service_cases sc
                      WHERE sc.id = tp.current_offer_case_id
                        AND sc.deleted_at IS NULL
                        AND sc.status NOT IN (
                            'completed', 'cancelled', 'archived'
                        )
                  )
                """
            )
        )
        await db.commit()
        count = int(getattr(result, "rowcount", 0) or 0)
        logger.info("released %d orphan tow offer lock(s)", count)


if __name__ == "__main__":
    asyncio.run(main())
