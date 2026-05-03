"""Pure tests — UserPushTokenRepository.upsert idempotency.

Aynı (user_id, device_id) ikinci kez register edilirse yeni satır
açılmaz, token + last_seen_at güncellenir. Yeni device_id → INSERT.
"""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.models.user_push_token import PushPlatform
from app.repositories.user_push_token import UserPushTokenRepository


class _FakeSession:
    """Minimal AsyncSession stub. add/flush/refresh tutar; execute fakedir."""

    def __init__(self, existing: object | None = None) -> None:
        self.existing = existing
        self.added: list[object] = []
        self.flush_calls = 0
        self.refresh_calls = 0

    async def execute(self, stmt: object) -> object:
        del stmt
        existing = self.existing

        class _Result:
            def scalar_one_or_none(self) -> object | None:
                return existing

        return _Result()

    def add(self, obj: object) -> None:
        self.added.append(obj)

    async def flush(self) -> None:
        self.flush_calls += 1

    async def refresh(self, obj: object) -> None:
        del obj
        self.refresh_calls += 1


@pytest.mark.asyncio
async def test_upsert_inserts_new_when_no_existing() -> None:
    session = _FakeSession(existing=None)
    repo = UserPushTokenRepository(session)  # type: ignore[arg-type]

    user_id = uuid4()
    record = await repo.upsert(
        user_id=user_id,
        platform=PushPlatform.ANDROID,
        token="ExpoPushToken[abc123]",
        device_id="device-xyz",
        app_version="1.0.0",
    )

    assert len(session.added) == 1
    assert session.added[0] is record
    assert record.user_id == user_id
    assert record.platform == PushPlatform.ANDROID
    assert record.token == "ExpoPushToken[abc123]"
    assert record.device_id == "device-xyz"
    assert record.app_version == "1.0.0"


@pytest.mark.asyncio
async def test_upsert_updates_existing_for_same_device() -> None:
    user_id = uuid4()
    existing = SimpleNamespace(
        user_id=user_id,
        platform=PushPlatform.IOS,
        token="OLD_TOKEN",
        device_id="device-xyz",
        app_version="0.9.0",
        last_seen_at=datetime(2026, 4, 1, tzinfo=UTC),
    )
    session = _FakeSession(existing=existing)
    repo = UserPushTokenRepository(session)  # type: ignore[arg-type]

    record = await repo.upsert(
        user_id=user_id,
        platform=PushPlatform.IOS,
        token="NEW_TOKEN",
        device_id="device-xyz",
        app_version="1.0.0",
    )

    # Yeni satır eklenmedi — mevcut UPDATE edildi
    assert len(session.added) == 0
    assert record is existing
    assert existing.token == "NEW_TOKEN"
    assert existing.app_version == "1.0.0"
    # last_seen_at yenilendi (now)
    assert existing.last_seen_at > datetime(2026, 4, 1, tzinfo=UTC)


@pytest.mark.asyncio
async def test_upsert_different_device_inserts_new_row() -> None:
    """Aynı user farklı cihazlardan (telefon + tablet) ayrı satır tutar."""
    user_id = uuid4()
    session = _FakeSession(existing=None)
    repo = UserPushTokenRepository(session)  # type: ignore[arg-type]

    await repo.upsert(
        user_id=user_id,
        platform=PushPlatform.IOS,
        token="iphone-token",
        device_id="iphone-001",
        app_version="1.0.0",
    )

    # İkinci cihaz — yeni session ama execute mock yine None döndürüyor
    session2 = _FakeSession(existing=None)
    repo2 = UserPushTokenRepository(session2)  # type: ignore[arg-type]
    await repo2.upsert(
        user_id=user_id,
        platform=PushPlatform.ANDROID,
        token="tablet-token",
        device_id="tablet-001",
        app_version="1.0.0",
    )

    assert len(session.added) == 1
    assert len(session2.added) == 1
    assert session.added[0].device_id == "iphone-001"
    assert session2.added[0].device_id == "tablet-001"
