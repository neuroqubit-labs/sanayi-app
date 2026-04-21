from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.media import MediaAsset, MediaStatus


class MediaAssetRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create(self, asset: MediaAsset) -> MediaAsset:
        self._db.add(asset)
        await self._db.flush()
        await self._db.refresh(asset)
        return asset

    async def get_by_id(self, asset_id: UUID) -> MediaAsset | None:
        result = await self._db.execute(select(MediaAsset).where(MediaAsset.id == asset_id))
        return result.scalar_one_or_none()

    async def get_by_upload_id(self, upload_id: UUID) -> MediaAsset | None:
        result = await self._db.execute(
            select(MediaAsset).where(MediaAsset.upload_id == upload_id)
        )
        return result.scalar_one_or_none()

    async def update(self, asset: MediaAsset) -> MediaAsset:
        await self._db.flush()
        await self._db.refresh(asset)
        return asset

    async def mark_deleted(self, asset: MediaAsset) -> MediaAsset:
        asset.status = MediaStatus.DELETED
        asset.deleted_at = datetime.now(UTC)
        return await self.update(asset)
