"""Billing domain models (Faz B-1).

4 tablo (migration 0029) — non-tow kind'lar için (bakım/arıza/hasar)
commission + refund + kasko reimbursement + PSP idempotency.

Tow'dan ayrı kalır — tow için tow_fare_settlements + tow_payment_idempotency
zaten var (Faz 10). Billing generic pattern + aynı escrow semantik.

Invariant enforcement:
- `gross = commission + net_to_technician` — DB CHECK constraint (ROUND .2)
- `payout_reference` UNIQUE — double payout engeli
- `amount > 0` refund minimum
- State değerleri StrEnum'da enforce, DB'de CHECK constraint

Decimal strict (B-3 bayrağı): net calc float sızmaz; Decimal +
ROUND_HALF_EVEN quantize('0.01') service katmanında.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    CHAR,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPkMixin

# ─── Enum'lar ──────────────────────────────────────────────────────────────


class CaseRefundReason(StrEnum):
    CANCELLATION = "cancellation"
    DISPUTE = "dispute"
    EXCESS_PREAUTH = "excess_preauth"
    KASKO_REIMBURSEMENT = "kasko_reimbursement"
    ADMIN_OVERRIDE = "admin_override"


class CaseRefundState(StrEnum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"


class CaseKaskoState(StrEnum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    REIMBURSED = "reimbursed"
    PARTIALLY_REIMBURSED = "partially_reimbursed"


class PaymentOperation(StrEnum):
    AUTHORIZE = "authorize"
    CAPTURE = "capture"
    REFUND = "refund"
    VOID = "void"


class PaymentIdempotencyState(StrEnum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"


class PaymentProvider(StrEnum):
    IYZICO = "iyzico"
    MOCK = "mock"


# ─── Modeller ──────────────────────────────────────────────────────────────


class CaseCommissionSettlement(UUIDPkMixin, Base):
    """1:1 service_cases. gross = commission + net (DB CHECK + service'te
    Decimal ROUND_HALF_EVEN)."""

    __tablename__ = "case_commission_settlements"
    __table_args__ = (
        CheckConstraint(
            "gross_amount >= 0 AND commission_amount >= 0 "
            "AND net_to_technician_amount >= 0",
            name="ck_commission_nonneg",
        ),
        CheckConstraint(
            "commission_rate >= 0 AND commission_rate <= 1",
            name="ck_commission_rate_range",
        ),
        CheckConstraint(
            "ROUND(gross_amount - commission_amount - net_to_technician_amount, 2) = 0",
            name="ck_commission_balance",
        ),
        CheckConstraint(
            "payout_scheduled_at IS NULL OR payout_completed_at IS NULL "
            "OR payout_completed_at >= payout_scheduled_at",
            name="ck_payout_order",
        ),
        UniqueConstraint(
            "payout_reference", name="uq_commission_payout_reference"
        ),
        Index(
            "ix_commission_settlements_pending_payout",
            "payout_scheduled_at",
            postgresql_where="payout_scheduled_at IS NULL",
        ),
    )

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )
    gross_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    commission_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    commission_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 4), nullable=False
    )
    net_to_technician_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    platform_currency: Mapped[str] = mapped_column(
        CHAR(3), nullable=False, server_default="TRY"
    )
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    payout_scheduled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    payout_completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    payout_reference: Mapped[str | None] = mapped_column(
        String(120), nullable=True
    )
    invoice_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )


class CaseRefund(UUIDPkMixin, Base):
    """Multi-reason refund ledger. idempotency_key UNIQUE — replay safe."""

    __tablename__ = "case_refunds"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_refund_amount_pos"),
        CheckConstraint(
            "reason IN ('cancellation','dispute','excess_preauth',"
            "'kasko_reimbursement','admin_override')",
            name="ck_refund_reason",
        ),
        CheckConstraint(
            "state IN ('pending','success','failed')",
            name="ck_refund_state",
        ),
        Index("ix_case_refunds_case", "case_id", "created_at"),
    )

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="RESTRICT"),
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    reason: Mapped[CaseRefundReason] = mapped_column(
        String(60), nullable=False
    )
    psp_ref: Mapped[str | None] = mapped_column(String(120), nullable=True)
    idempotency_key: Mapped[str] = mapped_column(
        String(120), nullable=False, unique=True
    )
    state: Mapped[CaseRefundState] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    initiated_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class CaseKaskoSettlement(UUIDPkMixin, Base):
    """1:1 case. V1 manuel flow — ops sigorta ile konuşur."""

    __tablename__ = "case_kasko_settlements"
    __table_args__ = (
        CheckConstraint(
            "state IN ('pending','submitted','approved','rejected',"
            "'reimbursed','partially_reimbursed')",
            name="ck_kasko_state",
        ),
        CheckConstraint(
            "reimbursement_amount IS NULL OR reimbursement_amount >= 0",
            name="ck_kasko_reimbursement_nonneg",
        ),
        Index(
            "ix_kasko_pending_state",
            "state",
            "submitted_at",
            postgresql_where="state IN ('pending','submitted','approved')",
        ),
    )

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )
    insurer_name: Mapped[str] = mapped_column(String(120), nullable=False)
    policy_number: Mapped[str | None] = mapped_column(String(80), nullable=True)
    claim_reference: Mapped[str | None] = mapped_column(
        String(120), nullable=True
    )
    reimbursement_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    state: Mapped[CaseKaskoState] = mapped_column(String(32), nullable=False)
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reimbursed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    refund_to_customer_psp_ref: Mapped[str | None] = mapped_column(
        String(120), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )


class PaymentIdempotency(Base):
    """Generic PSP retry cache — case-scoped, multi-operation. Tow'dan
    ayrı (tow_payment_idempotency settlement-scoped)."""

    __tablename__ = "payment_idempotency"
    __table_args__ = (
        CheckConstraint(
            "operation IN ('authorize','capture','refund','void')",
            name="ck_payment_idempotency_operation",
        ),
        CheckConstraint(
            "state IN ('pending','success','failed')",
            name="ck_payment_idempotency_state",
        ),
        CheckConstraint(
            "psp_provider IN ('iyzico','mock')",
            name="ck_payment_idempotency_provider",
        ),
        Index(
            "ix_payment_idempotency_case", "case_id", "created_at"
        ),
    )

    idempotency_key: Mapped[str] = mapped_column(String(120), primary_key=True)
    operation: Mapped[PaymentOperation] = mapped_column(
        String(32), nullable=False
    )
    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="RESTRICT"),
        nullable=False,
    )
    psp_provider: Mapped[PaymentProvider] = mapped_column(
        String(32), nullable=False
    )
    psp_ref: Mapped[str | None] = mapped_column(String(120), nullable=True)
    request_payload: Mapped[dict[str, object] | None] = mapped_column(
        JSONB, nullable=True
    )
    response_payload: Mapped[dict[str, object] | None] = mapped_column(
        JSONB, nullable=True
    )
    state: Mapped[PaymentIdempotencyState] = mapped_column(
        String(32), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
