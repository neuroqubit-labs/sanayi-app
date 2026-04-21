from typing import ClassVar

from arq import cron
from arq.connections import RedisSettings

from app.core.config import get_settings
from app.workers.media import process_media_asset
from app.workers.media_antivirus import media_antivirus_scan
from app.workers.media_orphan_purge import media_orphan_purge
from app.workers.media_retention_sweep import media_retention_sweep
from app.workers.tow.dispatch_timeouts import (
    current_offer_expiry,
    dispatch_attempt_timeout,
)
from app.workers.tow.fare_reconcile import fare_reconcile
from app.workers.tow.heartbeat import heartbeat_enforcer
from app.workers.tow.retention import location_retention_purge


def redis_settings() -> RedisSettings:
    settings = get_settings()
    return RedisSettings(host=settings.redis_host, port=settings.redis_port)


async def startup(ctx: dict[str, object]) -> None: ...


async def shutdown(ctx: dict[str, object]) -> None: ...


class WorkerSettings:
    """ARQ worker config. Çalıştırmak için: `arq app.workers.settings.WorkerSettings`."""

    functions: ClassVar[list[object]] = [
        process_media_asset,
        media_antivirus_scan,
        dispatch_attempt_timeout,
    ]
    cron_jobs: ClassVar[list[object]] = [
        cron(current_offer_expiry, second={0, 10, 20, 30, 40, 50}, unique=True),
        cron(heartbeat_enforcer, second={0, 30}, unique=True),
        cron(fare_reconcile, minute={0}, unique=True),
        cron(location_retention_purge, hour={3}, minute={0}, unique=True),
        cron(media_orphan_purge, hour={3}, minute={30}, unique=True),
        cron(media_retention_sweep, hour={4}, minute={0}, unique=True),
    ]
    on_startup = startup
    on_shutdown = shutdown

    @staticmethod
    def _redis_settings() -> RedisSettings:
        return redis_settings()

    redis_settings = _redis_settings()
