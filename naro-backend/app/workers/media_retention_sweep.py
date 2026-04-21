"""ARQ cron — per-purpose retention + owner state bazlı hard delete.

Brief §3.7: her purpose için `retention_days` + `retention_owner_state` policy;
daily 04:00 UTC tarama + purge.

Owner state mapping:
- `closed` → service_cases.closed_at NOT NULL, NOW - closed_at > retention_days
- `deleted` → owner (user/vehicle) deleted_at NOT NULL, NOW - deleted_at > retention_days
- `deactivated` → technician_profiles.deleted_at NOT NULL veya campaign deactive

Retention policy KVKK uyumlu; V1'de best-effort — owner lookup SQL union all.
"""

from __future__ import annotations

import contextlib
from datetime import UTC, datetime, timedelta

from sqlalchemy import text as _text

from app.core.config import get_settings
from app.db.session import get_db
from app.integrations.storage import build_storage_gateway
from app.observability.metrics import media_retention_deleted_total
from app.services import media_policy


async def media_retention_sweep(ctx: dict[str, object]) -> None:
    settings = get_settings()
    storage = build_storage_gateway(settings)
    now = datetime.now(UTC)

    async for session in get_db():
        for purpose, rule in media_policy.POLICY.items():
            if rule.retention_days is None or rule.retention_owner_state is None:
                continue
            cutoff = now - timedelta(days=rule.retention_days)

            # Owner state sub-query bazlı candidate selection
            if rule.retention_owner_state == "closed":
                sub = _text(
                    """
                    SELECT id FROM service_cases
                    WHERE closed_at IS NOT NULL AND closed_at < :cutoff
                    """
                )
                owner_ids = (
                    await session.execute(sub, {"cutoff": cutoff})
                ).scalars().all()
            elif rule.retention_owner_state in ("deleted", "deactivated"):
                table = {
                    "user": "users",
                    "vehicle": "vehicles",
                    "technician_profile": "technician_profiles",
                }.get(rule.owner_kind)
                if table is None:
                    continue
                sub = _text(
                    f"""
                    SELECT id FROM {table}
                    WHERE deleted_at IS NOT NULL AND deleted_at < :cutoff
                    """
                )
                owner_ids = (
                    await session.execute(sub, {"cutoff": cutoff})
                ).scalars().all()
            else:
                continue

            if not owner_ids:
                continue

            candidates = (
                await session.execute(
                    _text(
                        """
                        SELECT id, bucket_name, object_key,
                               preview_object_key, thumb_object_key
                        FROM media_assets
                        WHERE purpose = :purpose
                          AND owner_id = ANY(:ids)
                          AND deleted_at IS NULL
                        """
                    ),
                    {"purpose": purpose.value, "ids": list(owner_ids)},
                )
            ).mappings().all()

            for row in candidates:
                for key_field in ("object_key", "preview_object_key", "thumb_object_key"):
                    object_key = row[key_field]
                    if not object_key:
                        continue
                    with contextlib.suppress(Exception):
                        storage.delete_object(
                            bucket=row["bucket_name"], object_key=object_key
                        )
                await session.execute(
                    _text("DELETE FROM media_assets WHERE id = :id"),
                    {"id": row["id"]},
                )
                media_retention_deleted_total.labels(purpose=purpose.value).inc()
        await session.commit()
        break
