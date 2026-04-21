"""ARQ on-demand — `media_antivirus_scan(asset_id)` worker.

Brief §3.5: policy.antivirus_required=True olan purpose'lar için upload
complete sonrası worker enqueue. V1'de stub always-clean; V1.1'de ClamAV
daemon REST call (env `CLAMAV_HOST`, benzino77/clamav-rest-api pattern).

Verdict:
- clean → `status=ready` (zaten ready ise no-op), `antivirus_verdict='clean'`
- infected → `status=quarantined`, notification queue intent
- skipped → (V1 yolu — ClamAV host yok) `antivirus_verdict='skipped'`
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from app.core.config import get_settings
from app.db.session import get_db
from app.integrations.storage import build_storage_gateway
from app.models.media import AntivirusVerdict, MediaStatus
from app.observability.metrics import media_antivirus_quarantined_total
from app.repositories.media import MediaAssetRepository


async def media_antivirus_scan(ctx: dict[str, object], asset_id: str) -> None:
    settings = get_settings()
    asset_uuid = UUID(asset_id)

    async for session in get_db():
        repo = MediaAssetRepository(session)
        asset = await repo.get_by_id(asset_uuid)
        if asset is None:
            return
        if asset.antivirus_scanned_at is not None:
            return  # idempotent

        verdict = await _scan(settings, asset)
        asset.antivirus_scanned_at = datetime.now(UTC)
        asset.antivirus_verdict = verdict.value
        if verdict == AntivirusVerdict.INFECTED:
            asset.status = MediaStatus.QUARANTINED
            media_antivirus_quarantined_total.inc()
        elif asset.status == MediaStatus.UPLOADED:
            # Scan completed on non-image assets → promote to ready
            asset.status = MediaStatus.READY
        await repo.update(asset)
        await session.commit()
        break


async def _scan(settings: object, asset: object) -> AntivirusVerdict:
    """V1 stub: CLAMAV_HOST yoksa skipped; varsa (V1.1) daemon REST call."""
    clamav_host = getattr(settings, "clamav_host", "") or ""
    if not clamav_host:
        return AntivirusVerdict.SKIPPED
    # V1.1: HTTP POST {CLAMAV_HOST}/scan with S3 object bytes; parse verdict.
    # V1'de opsiyonel; gerçek entegrasyon Faz 14 (ClamAV canlı sub-sprint).
    try:
        storage = build_storage_gateway()
        _ = storage.read_bytes(
            bucket=asset.bucket_name,  # type: ignore[attr-defined]
            object_key=asset.object_key,  # type: ignore[attr-defined]
        )
        # stub: assume clean
        return AntivirusVerdict.CLEAN
    except Exception:
        return AntivirusVerdict.SKIPPED
