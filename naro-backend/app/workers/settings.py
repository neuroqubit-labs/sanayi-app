from typing import ClassVar

from arq import cron
from arq.connections import RedisSettings

from app.core.config import get_settings
from app.workers.account_deletion_purge import account_deletion_purge
from app.workers.appointment_expiry import appointment_expiry_job
from app.workers.billing_reconcile import billing_reconcile
from app.workers.media import process_media_asset
from app.workers.media_antivirus import media_antivirus_scan
from app.workers.media_orphan_purge import media_orphan_purge
from app.workers.media_retention_sweep import media_retention_sweep
from app.workers.offer_expiry import offer_expiry_job
from app.workers.stale_case_archive import stale_case_archive_job
from app.workers.tow.dispatch_timeouts import (
    current_offer_expiry,
    dispatch_attempt_timeout,
)
from app.workers.tow.fare_reconcile import fare_reconcile
from app.workers.tow.heartbeat import heartbeat_enforcer
from app.workers.tow.retention import location_retention_purge
from app.workers.tow.scheduled_payments import scheduled_payment_window


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
        cron(
            scheduled_payment_window,
            minute={0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55},
            unique=True,
        ),
        cron(heartbeat_enforcer, second={0, 30}, unique=True),
        cron(fare_reconcile, minute={0}, unique=True),
        cron(location_retention_purge, hour={3}, minute={0}, unique=True),
        cron(media_orphan_purge, hour={3}, minute={30}, unique=True),
        cron(media_retention_sweep, hour={4}, minute={0}, unique=True),
        # B-P1-6: offer expiry sweep (pilot ölçeğinde 5 dk yeter)
        cron(
            offer_expiry_job,
            minute={0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55},
            unique=True,
        ),
        # B-P1-7: stale MATCHING case auto-archive (saatte bir)
        cron(stale_case_archive_job, minute={0}, unique=True),
        # B-P1-10: appointment expiry sweep (5 dk)
        cron(
            appointment_expiry_job,
            minute={2, 7, 12, 17, 22, 27, 32, 37, 42, 47, 52, 57},
            unique=True,
        ),
        # F1.2 (2026-04-28): non-tow billing PREAUTH_REQUESTED stale recovery
        # (30 dk; webhook gelmediyse PREAUTH_FAILED'e çek, retry açık).
        cron(billing_reconcile, minute={4, 34}, unique=True),
        # 2026-05-03: App Store + Play hesap silme policy. Günlük 03:00 UTC
        # soft-deleted user'ları 30g grace sonrası hard-delete eder.
        # V1 log-only (cascade audit + integration test sonrası gerçek silme).
        cron(account_deletion_purge, hour={3}, minute={15}, unique=True),
    ]
    on_startup = startup
    on_shutdown = shutdown

    @staticmethod
    def _redis_settings() -> RedisSettings:
        return redis_settings()

    redis_settings = _redis_settings()
