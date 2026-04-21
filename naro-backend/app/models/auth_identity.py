"""AuthIdentity — 1 user → N auth methods (OTP phone/email + OAuth Google/Apple).

Faz 9a. Account linking: email match veya provider_user_id ile.
OAuth ID token'dan gelen full profile `raw_profile` JSONB'de saklanır
(audit + debug + opsiyonel alan çıkarımı).
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin
from app.db.enums import pg_enum


class AuthIdentityProvider(StrEnum):
    OTP_PHONE = "otp_phone"
    OTP_EMAIL = "otp_email"
    OAUTH_GOOGLE = "oauth_google"
    OAUTH_APPLE = "oauth_apple"


class UserIdentity(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "user_identities"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    provider: Mapped[AuthIdentityProvider] = mapped_column(
        pg_enum(AuthIdentityProvider, name="auth_identity_provider"),
        nullable=False,
    )
    # OTP: phone veya email; OAuth: id_token.sub
    provider_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    # OAuth'tan gelen email (account linking için) — OTP'de provider_user_id zaten email/phone
    email: Mapped[str | None] = mapped_column(String(255))
    # OAuth provider full response (sub, name, picture, iss, etc.)
    raw_profile: Mapped[dict[str, object]] = mapped_column(
        JSONB, nullable=False, server_default="{}"
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
