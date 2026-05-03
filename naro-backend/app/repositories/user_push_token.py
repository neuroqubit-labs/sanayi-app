"""Push token registry repository — idempotent upsert.

(user_id, device_id) unique constraint sayesinde aynı cihazdan ikinci
register UPDATE düşer; token rotate veya app reinstall durumunda yeni satır
açılmaz, mevcut satırın token + last_seen_at + app_version alanları
yenilenir.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_push_token import PushPlatform, UserPushToken


class UserPushTokenRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def upsert(
        self,
        *,
        user_id: UUID,
        platform: PushPlatform,
        token: str,
        device_id: str,
        app_version: str | None,
    ) -> UserPushToken:
        now = datetime.now(UTC)
        existing = (
            await self._db.execute(
                select(UserPushToken).where(
                    UserPushToken.user_id == user_id,
                    UserPushToken.device_id == device_id,
                )
            )
        ).scalar_one_or_none()

        if existing is not None:
            existing.token = token
            existing.platform = platform
            existing.app_version = app_version
            existing.last_seen_at = now
            await self._db.flush()
            return existing

        record = UserPushToken(
            user_id=user_id,
            platform=platform,
            token=token,
            device_id=device_id,
            app_version=app_version,
            last_seen_at=now,
        )
        self._db.add(record)
        await self._db.flush()
        await self._db.refresh(record)
        return record
