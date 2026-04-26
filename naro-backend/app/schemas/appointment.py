"""Pydantic DTOs for appointment domain."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.appointment import AppointmentSlotKind, AppointmentSource, AppointmentStatus


class AppointmentSlot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: AppointmentSlotKind
    dateLabel: str | None = None  # noqa: N815 — mobil payload camelCase
    timeWindow: str | None = None  # noqa: N815 — mobil payload camelCase


class AppointmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    case_id: UUID
    technician_id: UUID
    offer_id: UUID | None = None
    slot: AppointmentSlot
    note: str = ""
    expires_at: datetime | None = None
    source: AppointmentSource = AppointmentSource.OFFER_ACCEPT


class AppointmentDeclineRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=1, max_length=1000)


class AppointmentCounterRequest(BaseModel):
    """Usta randevuyu düzenleyip onay bekliyor (Kural 5)."""

    model_config = ConfigDict(extra="forbid")

    new_slot: AppointmentSlot


class AppointmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    case_id: UUID
    technician_id: UUID
    offer_id: UUID | None
    slot: dict[str, object]
    slot_kind: AppointmentSlotKind
    note: str | None
    status: AppointmentStatus
    requested_at: datetime
    expires_at: datetime
    responded_at: datetime | None
    decline_reason: str | None
    source: AppointmentSource
    counter_proposal: dict[str, object] | None
    counter_proposal_by_user_id: UUID | None
    created_at: datetime
    updated_at: datetime
