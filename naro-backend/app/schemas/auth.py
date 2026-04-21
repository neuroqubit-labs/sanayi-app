from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class OtpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    channel: Literal["sms", "email", "console", "whatsapp"]
    phone: str | None = Field(default=None, description="E.164 formatinda (orn. +905551112233)")
    email: EmailStr | None = None
    role: Literal["customer", "technician"] = "customer"


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
