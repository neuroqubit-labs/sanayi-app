from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class OtpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    channel: Literal["sms", "email"]
    phone: str | None = Field(default=None, description="E.164 formatında (ör. +905551112233)")
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
