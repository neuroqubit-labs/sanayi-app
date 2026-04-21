"""Pydantic DTOs for user_identities + auth_events."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.auth_event import AuthEventType
from app.models.auth_identity import AuthIdentityProvider


class UserIdentityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    provider: AuthIdentityProvider
    provider_user_id: str
    email: str | None
    verified_at: datetime | None
    last_used_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AuthEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID | None
    session_id: UUID | None
    event_type: AuthEventType
    actor: str
    ip_address: str | None
    user_agent: str | None
    target: str | None
    context: dict[str, object]
    body: str | None
    created_at: datetime
