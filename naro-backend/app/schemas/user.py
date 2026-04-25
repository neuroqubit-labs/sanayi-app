"""Pydantic DTOs for /users/me — customer profile read + update."""

from __future__ import annotations

import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.user import UserApprovalStatus, UserRole, UserStatus

# E.164 regex — opsiyonel "+" + 8-15 rakam.
_E164_RE = re.compile(r"^\+?[1-9]\d{7,14}$")


class UserResponse(BaseModel):
    """Authenticated user's own profile — returned by GET /users/me."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    phone: str | None
    email: str | None
    full_name: str | None
    role: UserRole
    status: UserStatus
    approval_status: UserApprovalStatus | None
    locale: str
    avatar_asset_id: UUID | None
    kvkk_consented_at: datetime | None
    last_login_at: datetime | None
    created_at: datetime


class UserUpdate(BaseModel):
    """PATCH /users/me body — partial update.

    Phone değişikliği ayrı bir OTP-reverify akışıyla yapılır (burada kabul
    edilmez). Role + status backend yönetimindedir. Avatar upload sonrası
    asset_id buradan set edilir (null gönderilirse avatar temizlenir).
    KVKK consent profile-setup submit anında client tarafından gönderilir
    (industry-standard pasif kabul + audit timestamp).
    """

    model_config = ConfigDict(extra="forbid")

    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    email: EmailStr | None = None
    locale: str | None = Field(default=None, min_length=2, max_length=10)
    avatar_asset_id: UUID | None = None
    kvkk_consented_at: datetime | None = None

    @field_validator("full_name")
    @classmethod
    def _trim_full_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if len(stripped) < 2:
            raise ValueError("full_name en az 2 karakter olmalı")
        return stripped


def is_e164(value: str) -> bool:
    """Helper — ileride register/phone-change akışında kullanılacak."""

    return bool(_E164_RE.match(value))
