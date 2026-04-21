"""Media worker smoke — orphan + retention + antivirus.

DB integration (SAEnum fix sonrası çalışır). LocalStack/S3 yok; storage delete
Exception yutulur (worker graceful handle).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import text as _text

from app.db.session import AsyncSessionLocal
from app.models.media import (
    AntivirusVerdict,
    MediaAsset,
    MediaPurpose,
    MediaStatus,
    MediaVisibility,
)
from app.repositories.media import MediaAssetRepository


async def _make_user(db) -> UUID:
    user_id = uuid4()
    await db.execute(
        _text(
            """
            INSERT INTO users (id, phone, role, status, locale, created_at, updated_at)
            VALUES (:id, :phone, CAST('customer' AS user_role),
                    CAST('active' AS user_status), 'tr-TR', now(), now())
            """
        ),
        {"id": user_id, "phone": f"+90555{uuid4().hex[:7]}"},
    )
    return user_id


async def _make_pending_asset(
    db, *, user_id: UUID, age_hours: int
) -> MediaAsset:
    now = datetime.now(UTC)
    created_at = now - timedelta(hours=age_hours)
    asset = MediaAsset(
        upload_id=uuid4(),
        purpose=MediaPurpose.USER_AVATAR,
        visibility=MediaVisibility.PUBLIC,
        status=MediaStatus.PENDING_UPLOAD,
        owner_ref=f"user:{user_id}",
        owner_kind="user",
        owner_id=user_id,
        bucket_name="test-bucket",
        object_key=f"pending/{uuid4()}",
        original_filename="test.jpg",
        mime_type="image/jpeg",
        size_bytes=1024,
        uploaded_by_user_id=user_id,
    )
    db.add(asset)
    await db.flush()
    # Override created_at for age simulation
    await db.execute(
        _text("UPDATE media_assets SET created_at = :c WHERE id = :id"),
        {"c": created_at, "id": asset.id},
    )
    await db.refresh(asset)
    return asset


@pytest.mark.skip(
    reason="Worker DB session cross-test event-loop (Faz 10 bloker); "
    "query + policy logic pure unit olarak kapsandı — integration 11+/infra fix sonrası."
)
@pytest.mark.asyncio
async def test_orphan_purge_selects_old_pending_only() -> None:
    """25h eski pending → purge; 1h eski → koru; ready → koru."""
    from app.workers.media_orphan_purge import media_orphan_purge

    async with AsyncSessionLocal() as db:
        user_id = await _make_user(db)
        old_pending = await _make_pending_asset(db, user_id=user_id, age_hours=25)
        fresh_pending = await _make_pending_asset(db, user_id=user_id, age_hours=1)
        ready_asset = await _make_pending_asset(db, user_id=user_id, age_hours=48)
        ready_asset.status = MediaStatus.READY
        await db.flush()
        await db.commit()
        old_id = old_pending.id
        fresh_id = fresh_pending.id
        ready_id = ready_asset.id

    # Run worker (storage delete will fail silently — expected)
    await media_orphan_purge({})

    async with AsyncSessionLocal() as db:
        repo = MediaAssetRepository(db)
        assert await repo.get_by_id(old_id) is None, "25h pending should be purged"
        assert await repo.get_by_id(fresh_id) is not None, "1h pending should remain"
        assert await repo.get_by_id(ready_id) is not None, "ready should remain"

        # Cleanup
        await db.execute(
            _text("DELETE FROM media_assets WHERE id = ANY(:ids)"),
            {"ids": [fresh_id, ready_id]},
        )
        await db.execute(
            _text("DELETE FROM users WHERE id = :id"), {"id": user_id}
        )
        await db.commit()


@pytest.mark.skip(
    reason="Cross-test asyncpg event-loop issue when second worker opens session; "
    "Faz 10 bloker ile ortak; per-test engine fixture sonrası aktif."
)
@pytest.mark.asyncio
async def test_antivirus_scan_stub_skips_when_no_host() -> None:
    """CLAMAV_HOST boş → verdict=skipped; asset.antivirus_verdict bind edilir."""
    from app.workers.media_antivirus import media_antivirus_scan

    async with AsyncSessionLocal() as db:
        user_id = await _make_user(db)
        asset = await _make_pending_asset(db, user_id=user_id, age_hours=0)
        asset.status = MediaStatus.UPLOADED
        asset.purpose = MediaPurpose.INSURANCE_DOC  # antivirus_required=True
        await db.flush()
        await db.commit()
        asset_id = asset.id

    # Run worker — no CLAMAV_HOST → skipped verdict
    await media_antivirus_scan({}, str(asset_id))

    async with AsyncSessionLocal() as db:
        repo = MediaAssetRepository(db)
        updated = await repo.get_by_id(asset_id)
        assert updated is not None
        assert updated.antivirus_verdict == AntivirusVerdict.SKIPPED.value
        assert updated.antivirus_scanned_at is not None
        # Status 'uploaded' → promoted to 'ready' (clean/skipped path)
        assert updated.status == MediaStatus.READY

        await db.execute(
            _text("DELETE FROM media_assets WHERE id = :id"), {"id": asset_id}
        )
        await db.execute(
            _text("DELETE FROM users WHERE id = :id"), {"id": user_id}
        )
        await db.commit()


@pytest.mark.skip(
    reason="Cross-test asyncpg event-loop issue (Faz 10 bloker); "
    "per-test engine fixture sonrası aktif."
)
@pytest.mark.asyncio
async def test_antivirus_scan_idempotent() -> None:
    """Tekrar çağırım → antivirus_scanned_at zaten dolu → no-op."""
    from app.workers.media_antivirus import media_antivirus_scan

    async with AsyncSessionLocal() as db:
        user_id = await _make_user(db)
        asset = await _make_pending_asset(db, user_id=user_id, age_hours=0)
        asset.antivirus_scanned_at = datetime.now(UTC)
        asset.antivirus_verdict = AntivirusVerdict.CLEAN.value
        await db.flush()
        await db.commit()
        asset_id = asset.id

    await media_antivirus_scan({}, str(asset_id))

    async with AsyncSessionLocal() as db:
        repo = MediaAssetRepository(db)
        updated = await repo.get_by_id(asset_id)
        assert updated is not None
        assert updated.antivirus_verdict == AntivirusVerdict.CLEAN.value

        await db.execute(
            _text("DELETE FROM media_assets WHERE id = :id"), {"id": asset_id}
        )
        await db.execute(
            _text("DELETE FROM users WHERE id = :id"), {"id": user_id}
        )
        await db.commit()
