"""Pydantic DTOs for case_offer domain."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.offer import CaseOfferStatus
from app.schemas.appointment import AppointmentSlot


class OfferSubmit(BaseModel):
    """Canonical usta teklif submit payload.

    B-P2-3 (2026-04-23): technician_id schema'dan çıkarıldı — auth'dan
    türetilir (security: teknisyen başka kişi adına teklif gönderemesin).
    Route inline payload artık canonical import'tan geliyor.
    """

    model_config = ConfigDict(extra="forbid")

    case_id: UUID
    headline: str = Field(min_length=1, max_length=255)
    description: str | None = None
    amount: Decimal = Field(ge=0)
    currency: str = Field(default="TRY", min_length=1, max_length=8)
    eta_minutes: int = Field(ge=0)
    delivery_mode: str = Field(min_length=1, max_length=64)
    warranty_label: str = Field(min_length=1, max_length=128)
    available_at_label: str | None = Field(default=None, max_length=128)
    badges: list[str] = Field(default_factory=list)
    expires_at: datetime | None = None
    slot_proposal: AppointmentSlot | None = None
    slot_is_firm: bool = False

    @model_validator(mode="after")
    def _firm_requires_slot(self) -> OfferSubmit:
        if self.slot_is_firm and self.slot_proposal is None:
            raise ValueError("slot_is_firm=True için slot_proposal zorunlu")
        return self


class OfferResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    case_id: UUID
    technician_id: UUID
    headline: str
    description: str | None
    amount: Decimal
    currency: str
    eta_minutes: int
    delivery_mode: str
    warranty_label: str
    available_at_label: str | None
    badges: list[str]
    slot_proposal: dict[str, object] | None
    slot_is_firm: bool
    status: CaseOfferStatus
    submitted_at: datetime
    accepted_at: datetime | None
    rejected_at: datetime | None
    expires_at: datetime | None
    created_at: datetime
    updated_at: datetime
