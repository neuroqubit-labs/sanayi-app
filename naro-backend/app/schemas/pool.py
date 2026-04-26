"""Pool response models — teknisyen havuz önizleme (müşteri PII-masked).

Customer full_name → initials; phone/email response'ta yok.
Vehicle plate tam göster (teklif için gerekli).
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.case import (
    ServiceCaseStatus,
    ServiceRequestKind,
    ServiceRequestUrgency,
)


class PoolCaseItem(BaseModel):
    """Feed listing — hafif kart."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: ServiceRequestKind
    urgency: ServiceRequestUrgency
    status: ServiceCaseStatus
    title: str
    subtitle: str | None
    location_label: str | None
    created_at: datetime
    estimate_amount: Decimal | None
    is_matched_to_me: bool = False
    match_badge: str | None = None
    match_reason_label: str | None = None
    is_notified_to_me: bool = False
    has_offer_from_me: bool = False


class PoolCaseDetail(BaseModel):
    """Detay önizleme — customer PII masked (I-9)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: ServiceRequestKind
    urgency: ServiceRequestUrgency
    status: ServiceCaseStatus
    title: str
    subtitle: str | None
    summary: str | None
    location_label: str | None
    customer_masked_name: str
    vehicle_id: UUID
    created_at: datetime
    updated_at: datetime
    estimate_amount: Decimal | None
    is_matched_to_me: bool = False
    match_badge: str | None = None
    match_reason_label: str | None = None
    is_notified_to_me: bool = False
    has_offer_from_me: bool = False
