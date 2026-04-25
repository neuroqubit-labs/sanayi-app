from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.user import UserApprovalStatus, UserRole
from app.schemas.user import is_e164


class OtpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    channel: Literal["sms", "email", "console", "whatsapp"]
    phone: str | None = Field(default=None, description="E.164 formatinda (orn. +905551112233)")
    email: EmailStr | None = None
    role: Literal["customer", "technician"] = "customer"

    @field_validator("phone")
    @classmethod
    def _phone_e164(cls, value: str | None) -> str | None:
        # Mobile login normalizePhoneTR ile E.164'e çevirir; BE çift güvence.
        # Aynı telefon için raw "0555..." vs "+90555..." iki ayrı user yaratma
        # bug'ını engellemek için (2026-04-25 incident).
        if value is None:
            return None
        stripped = value.strip()
        if not is_e164(stripped):
            raise ValueError(
                "phone must be in E.164 format (e.g. +905551112233)"
            )
        return stripped


class OtpRequestResponse(BaseModel):
    delivery_id: str
    expires_in_seconds: int


class OtpVerify(BaseModel):
    model_config = ConfigDict(extra="forbid")

    delivery_id: str
    code: str = Field(min_length=4, max_length=8)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"


class OtpVerifyResponse(TokenPair):
    """OTP verify zenginleştirilmiş response — mobile routing matrisi tek
    round-trip ile karar versin diye user + profile durumu eklenmiştir.

    `is_new_user`: bu verify sırasında user create edildi mi (welcome flow için).
    `profile_completed`: technician için TechnicianProfile var mı (onboarding'e
    yönlenip yönlenmeyeceği). Customer için her zaman True.
    """

    user_id: UUID
    role: UserRole
    approval_status: UserApprovalStatus | None = None
    is_new_user: bool = False
    profile_completed: bool = True


class RefreshRequest(BaseModel):
    refresh_token: str


class SessionResponse(BaseModel):
    """Active refresh-token session — returned by GET /auth/sessions."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    device_label: str | None
    ip_address: str | None
    user_agent: str | None
    issued_at: datetime
    expires_at: datetime
    last_used_at: datetime | None
    revoked_at: datetime | None
