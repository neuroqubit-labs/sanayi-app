"""ARQ cron — 24h sonrası pending_upload orphan media_assets hard delete.

Brief §3.2: upload intent yarattıktan 24h içinde PUT+complete gelmediyse
kullanıcı vazgeçmiş demektir → DB row + S3 pending obj sil.

Daily 03:30 UTC. TOW_* crons 03:00 (retention), 04:00 arası; spread.
"""

from __future__ import annotations

import contextlib
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, select

from app.core.config import get_settings
from app.db.session import get_db
from app.integrations.storage import build_storage_gateway
from app.models.media import MediaAsset, MediaStatus
from app.observability.metrics import media_orphan_purged_total


async def media_orphan_purge(ctx: dict[str, object]) -> None:
    settings = get_settings()
    hours = int(getattr(settings, "media_orphan_retention_hours", 24))
    cutoff = datetime.now(UTC) - timedelta(hours=hours)
    storage = build_storage_gateway(settings)

    async for session in get_db():
        stmt = select(MediaAsset).where(
            and_(
                MediaAsset.status == MediaStatus.PENDING_UPLOAD,
                MediaAsset.created_at < cutoff,
            )
        )
        rows = (await session.execute(stmt)).scalars().all()
        for asset in rows:
            # S3 object may not exist (PUT never happened); ignore
            with contextlib.suppress(Exception):
                storage.delete_object(
                    bucket=asset.bucket_name, object_key=asset.object_key
                )
            await session.delete(asset)
            media_orphan_purged_total.inc()
        await session.commit()
        break
