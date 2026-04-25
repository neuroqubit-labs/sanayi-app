"""Reusable payment DTOs shared by tow and future purchase flows."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class PaymentSubjectTypeSchema(StrEnum):
    TOW_CASE = "tow_case"
    SERVICE_CASE = "service_case"
    CASE_APPROVAL = "case_approval"
    CAMPAIGN_PURCHASE = "campaign_purchase"


class PaymentModeSchema(StrEnum):
    PREAUTH_CAPTURE = "preauth_capture"
    DIRECT_CAPTURE = "direct_capture"


class PaymentStateSchema(StrEnum):
    PAYMENT_REQUIRED = "payment_required"
    PREAUTH_REQUESTED = "preauth_requested"
    PREAUTH_HELD = "preauth_held"
    PREAUTH_FAILED = "preauth_failed"
    CAPTURE_REQUESTED = "capture_requested"
    CAPTURED = "captured"
    VOIDED = "voided"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


class PaymentInitiateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    payment_order_id: UUID
    payment_attempt_id: UUID
    checkout_url: str
    amount: Decimal
    currency: str
    expires_at: datetime | None
    payment_mode: PaymentModeSchema


class PaymentSnapshot(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    state: PaymentStateSchema
    amount_label: str | None = None
    retryable: bool = False
    next_action: str | None = None
    payment_order_id: UUID | None = None
    amount: Decimal | None = None
    currency: str = "TRY"
