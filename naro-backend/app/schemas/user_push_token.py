"""Pydantic DTOs — POST /users/me/push-tokens body + response."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.user_push_token import PushPlatform


class PushTokenRegisterPayload(BaseModel):
    """FE bootstrap'inden gelen device token kaydı.

    device_id, idempotency anahtarı; aynı cihazdan tekrar register edilirse
    token + last_seen_at güncellenir, yeni satır açılmaz. app_version teşhis
    için (hangi sürümde token alındı).
    """

    model_config = ConfigDict(extra="forbid")

    platform: PushPlatform
    token: str = Field(min_length=1, max_length=512)
    device_id: str = Field(min_length=1, max_length=255)
    app_version: str | None = Field(default=None, max_length=32)


class PushTokenResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    platform: PushPlatform
    device_id: str
    last_seen_at: datetime
