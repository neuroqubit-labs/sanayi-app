"""ARQ job — tow_live_locations partition retention purge + rolling bootstrap.

Günlük 03:00 UTC:
1. 30g eski partition'ı DROP
2. Gelecekteki 7 gün partition'ını oluştur (idempotent)
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import text as _text

from app.core.config import get_settings
from app.db.session import get_db

RETENTION_DAYS_DEFAULT = 30
ROLLING_FORWARD_DAYS = 7


async def location_retention_purge(ctx: dict[str, object]) -> None:
    settings = get_settings()
    retention_days = settings.tow_location_retention_days or RETENTION_DAYS_DEFAULT
    today = datetime.now(UTC).date()
    drop_cutoff = today - timedelta(days=retention_days)

    async for session in get_db():
        # Detach + drop old partitions
        old_partitions = (
            await session.execute(
                _text(
                    """
                    SELECT inhrelid::regclass::text AS partition_name
                    FROM pg_inherits
                    WHERE inhparent = 'tow_live_locations'::regclass
                      AND inhrelid::regclass::text LIKE 'tow_live_locations_%'
                      AND inhrelid::regclass::text !~ 'default$'
                    """
                )
            )
        ).scalars().all()
        for part in old_partitions:
            # Expect format tow_live_locations_YYYYMMDD
            suffix = part.rsplit("_", 1)[-1]
            try:
                part_date = datetime.strptime(suffix, "%Y%m%d").date()
            except ValueError:
                continue
            if part_date < drop_cutoff:
                await session.execute(_text(f"DROP TABLE IF EXISTS {part}"))

        # Rolling create for next 7 days
        for i in range(ROLLING_FORWARD_DAYS + 1):
            day = today + timedelta(days=i)
            next_day = day + timedelta(days=1)
            partition_name = f"tow_live_locations_{day.strftime('%Y%m%d')}"
            await session.execute(
                _text(
                    f"""
                    CREATE TABLE IF NOT EXISTS {partition_name}
                    PARTITION OF tow_live_locations
                    FOR VALUES FROM ('{day.isoformat()}') TO ('{next_day.isoformat()}')
                    """
                )
            )
            await session.execute(
                _text(
                    f"CREATE INDEX IF NOT EXISTS ix_{partition_name}_case_time "
                    f"ON {partition_name} (case_id, captured_at DESC)"
                )
            )
            await session.execute(
                _text(
                    f"CREATE INDEX IF NOT EXISTS ix_{partition_name}_location_gist "
                    f"ON {partition_name} USING GIST (location)"
                )
            )
            await session.execute(
                _text(
                    f"ALTER TABLE {partition_name} SET ("
                    f"autovacuum_vacuum_scale_factor = 0.01, "
                    f"autovacuum_vacuum_cost_limit = 2000)"
                )
            )
        await session.commit()
        break
