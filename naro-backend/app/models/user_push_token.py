"""Push notification token registry — kullanıcı + cihaz başına 1 satır.

FE bootstrap'te (`usePushTokenRegistration`) device push token alınır,
`POST /users/me/push-tokens` ile idempotent kaydedilir. (user_id, device_id)
unique; token rotate olursa aynı satır UPDATE edilir.

Push gönderme akışı (V1.1) bu tablodan tüm aktif token'ları sorgulayıp
FCM (Android) / APN (iOS) provider'larına forward eder. last_seen_at,
stale token cleanup'ı için izlenir.

Account deletion: User soft delete'te tüm token'lar kullanıcı için
geçerliliğini kaybeder; hard-delete worker (V1.1) FK CASCADE ile satırı
DB'den siler.
"""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin
from app.db.enums import pg_enum


class PushPlatform(StrEnum):
    IOS = "ios"
    ANDROID = "android"


class UserPushToken(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "user_push_tokens"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "device_id", name="uq_user_push_tokens_user_device"
        ),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    platform: Mapped[PushPlatform] = mapped_column(
        pg_enum(PushPlatform, name="push_platform"), nullable=False
    )
    token: Mapped[str] = mapped_column(String(512), nullable=False)
    device_id: Mapped[str] = mapped_column(String(255), nullable=False)
    app_version: Mapped[str | None] = mapped_column(String(32))
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
