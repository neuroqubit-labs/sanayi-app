"""Billing DTOs (Faz B-1 schema snapshot — FE Zod parity için).

Brief §10 endpoint matrisi + B-5 bayrak (kasko summary alanları).
Faz B-3'te route'lar bu DTO'ları kullanır; snapshot FE'ye Faz B-1
bitişiyle paylaşılır.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.billing import (
    CaseKaskoState,
    CaseRefundReason,
    CaseRefundState,
    PaymentIdempotencyState,
    PaymentOperation,
    PaymentProvider,
)
from app.services.case_billing_state import BillingState

# ─── Payment initiate (customer) ──────────────────────────────────────────


class PaymentInitiateRequest(BaseModel):
    """POST /cases/{id}/payment/initiate body.

    V1 — boş payload; kart verisi Iyzico checkout form (WebView) üzerinden
    3DS flow ile geçer (B-4 bayrak, stored card V1 yasak). Tokenization
    V1.1'de `card_token` alanı geri eklenecek.
    """

    model_config = ConfigDict(extra="forbid")


class PaymentInitiateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    checkout_url: str
    idempotency_key: str
    preauth_amount: Decimal
    case_id: UUID


# ─── Billing summary (customer / admin) ───────────────────────────────────


class CommissionSettlementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    gross_amount: Decimal
    commission_amount: Decimal
    commission_rate: Decimal
    net_to_technician_amount: Decimal
    platform_currency: str
    captured_at: datetime
    payout_scheduled_at: datetime | None
    payout_completed_at: datetime | None
    payout_reference: str | None
    invoice_url: str | None


class RefundOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    amount: Decimal
    reason: CaseRefundReason
    psp_ref: str | None
    state: CaseRefundState
    created_at: datetime
    completed_at: datetime | None


class KaskoSummary(BaseModel):
    """B-5 bayrak — FE "kasko bekliyorum" UI için gerekli alanlar."""

    model_config = ConfigDict(from_attributes=True)

    state: CaseKaskoState
    insurer_name: str
    policy_number: str | None
    claim_reference: str | None
    reimbursement_amount: Decimal | None
    submitted_at: datetime | None
    reimbursed_at: datetime | None


class BillingSummary(BaseModel):
    """GET /cases/{id}/billing/summary — customer veya admin.

    Consolide view: estimate + pre-auth + approved parts + final capture +
    refunds + kasko state (B-5).
    """

    model_config = ConfigDict(from_attributes=True)

    case_id: UUID
    billing_state: BillingState
    estimate_amount: Decimal | None
    preauth_amount: Decimal | None
    approved_parts_total: Decimal = Field(default=Decimal("0.00"))
    final_amount: Decimal | None = None
    settlement: CommissionSettlementOut | None = None
    refunds: list[RefundOut] = Field(default_factory=list)
    kasko: KaskoSummary | None = None


# ─── Admin moderation ─────────────────────────────────────────────────────


class KaskoReimburseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount: Decimal = Field(ge=0)


class RefundRequest(BaseModel):
    """Admin dispute / admin_override refund."""

    model_config = ConfigDict(extra="forbid")

    amount: Decimal = Field(gt=0)
    reason: CaseRefundReason


class CaptureOverrideRequest(BaseModel):
    """Admin son-çare capture (I-BILL-12 audit zorunlu)."""

    model_config = ConfigDict(extra="forbid")

    amount: Decimal = Field(gt=0)
    reason: str = Field(min_length=1, max_length=1000)


class MarkPayoutCompletedItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    settlement_id: UUID
    payout_reference: str = Field(min_length=1, max_length=120)


class MarkPayoutCompletedRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[MarkPayoutCompletedItem] = Field(min_length=1)


class TechnicianPayoutItem(BaseModel):
    """GET /technicians/me/payouts — usta kendi net_to_technician kayıtları."""

    model_config = ConfigDict(from_attributes=True)

    settlement_id: UUID
    case_id: UUID
    net_to_technician_amount: Decimal
    platform_currency: str
    captured_at: datetime
    payout_scheduled_at: datetime | None
    payout_completed_at: datetime | None
    payout_reference: str | None


# ─── Idempotency DTO ──────────────────────────────────────────────────────


class PaymentIdempotencyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    idempotency_key: str
    operation: PaymentOperation
    case_id: UUID
    psp_provider: PaymentProvider
    psp_ref: str | None
    state: PaymentIdempotencyState
    created_at: datetime
    completed_at: datetime | None
