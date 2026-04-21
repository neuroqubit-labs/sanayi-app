"""Auth domain models — refresh token persistence + OTP history.

Token bodies are never stored raw; only sha256 hashes. OTP codes are hashed
and rate-limited through application logic; cleanup jobs hard-delete entries
older than the retention window.
"""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, SmallInteger, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import INET
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin
from app.models.user import UserRole


class OtpChannel(StrEnum):
    SMS = "sms"
    CONSOLE = "console"
    WHATSAPP = "whatsapp"


class AuthSession(UUIDPkMixin, TimestampMixin, Base):
    """Refresh token session — one row per device/login."""

    __tablename__ = "auth_sessions"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    refresh_token_hash: Mapped[str] = mapped_column(
        String(128), nullable=False, unique=True
    )
    device_label: Mapped[str | None] = mapped_column(String(255))
    ip_address: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(String(512))

    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class OtpCode(UUIDPkMixin, Base):
    """OTP issuance history — hashed codes + rate limit + audit."""

    __tablename__ = "otp_codes"

    phone: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    channel: Mapped[OtpChannel] = mapped_column(
        SAEnum(OtpChannel, name="otp_channel"),
        nullable=False,
        default=OtpChannel.SMS,
    )
    code_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    target_role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role", create_type=False), nullable=False
    )
    delivery_id: Mapped[str | None] = mapped_column(String(128))
    attempts: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)

    consumed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default="now()",
    )
