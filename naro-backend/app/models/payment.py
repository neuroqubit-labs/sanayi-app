"""Reusable payment core models.

Payment Core is product-agnostic: tow cases, normal service cases and future
campaign purchases all create an order and one or more PSP attempts. Product
tables keep their own operational state; these rows are the durable PSP audit
trail and retry boundary.
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

from app.db.base import Base, TimestampMixin, UUIDPkMixin


class PaymentSubjectType(StrEnum):
    TOW_CASE = "tow_case"
    SERVICE_CASE = "service_case"
    CASE_APPROVAL = "case_approval"
    CAMPAIGN_PURCHASE = "campaign_purchase"


class PaymentMode(StrEnum):
    PREAUTH_CAPTURE = "preauth_capture"
    DIRECT_CAPTURE = "direct_capture"


class PaymentState(StrEnum):
    PAYMENT_REQUIRED = "payment_required"
    PREAUTH_REQUESTED = "preauth_requested"
    PREAUTH_HELD = "preauth_held"
    PREAUTH_FAILED = "preauth_failed"
    CAPTURE_REQUESTED = "capture_requested"
    CAPTURED = "captured"
    VOIDED = "voided"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


class PaymentOrder(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "payment_orders"
    __table_args__ = (
        CheckConstraint(
            "subject_type IN ('tow_case','service_case','case_approval','campaign_purchase')",
            name="ck_payment_orders_subject_type",
        ),
        CheckConstraint(
            "payment_mode IN ('preauth_capture','direct_capture')",
            name="ck_payment_orders_mode",
        ),
        CheckConstraint(
            "state IN ('payment_required','preauth_requested','preauth_held',"
            "'preauth_failed','capture_requested','captured','voided',"
            "'refunded','cancelled')",
            name="ck_payment_orders_state",
        ),
        CheckConstraint("amount >= 0", name="ck_payment_orders_amount_nonneg"),
        CheckConstraint(
            "provider IN ('iyzico','mock')",
            name="ck_payment_orders_provider",
        ),
        UniqueConstraint(
            "subject_type",
            "subject_id",
            "payment_mode",
            name="uq_payment_orders_subject_mode",
        ),
        Index("ix_payment_orders_subject", "subject_type", "subject_id"),
        Index("ix_payment_orders_customer", "customer_user_id", "created_at"),
    )

    subject_type: Mapped[PaymentSubjectType] = mapped_column(String(40), nullable=False)
    subject_id: Mapped[UUID] = mapped_column(nullable=False)
    case_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("service_cases.id", ondelete="RESTRICT"), nullable=True
    )
    customer_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    payment_mode: Mapped[PaymentMode] = mapped_column(String(40), nullable=False)
    state: Mapped[PaymentState] = mapped_column(
        String(40), nullable=False, default=PaymentState.PAYMENT_REQUIRED
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        CHAR(3), nullable=False, default="TRY", server_default="TRY"
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    quote_snapshot: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    latest_attempt_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "payment_attempts.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_payment_orders_latest_attempt_id",
        ),
        nullable=True,
    )


class PaymentAttempt(UUIDPkMixin, Base):
    __tablename__ = "payment_attempts"
    __table_args__ = (
        CheckConstraint(
            "state IN ('payment_required','preauth_requested','preauth_held',"
            "'preauth_failed','capture_requested','captured','voided',"
            "'refunded','cancelled')",
            name="ck_payment_attempts_state",
        ),
        CheckConstraint("amount >= 0", name="ck_payment_attempts_amount_nonneg"),
        CheckConstraint(
            "provider IN ('iyzico','mock')",
            name="ck_payment_attempts_provider",
        ),
        UniqueConstraint(
            "provider_conversation_id",
            name="uq_payment_attempts_provider_conversation",
        ),
        Index("ix_payment_attempts_order", "order_id", "created_at"),
    )

    order_id: Mapped[UUID] = mapped_column(
        ForeignKey("payment_orders.id", ondelete="CASCADE"), nullable=False
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    provider_conversation_id: Mapped[str] = mapped_column(String(120), nullable=False)
    provider_payment_id: Mapped[str | None] = mapped_column(String(160))
    provider_token: Mapped[str | None] = mapped_column(String(240))
    checkout_url: Mapped[str | None] = mapped_column(Text)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        CHAR(3), nullable=False, default="TRY", server_default="TRY"
    )
    state: Mapped[PaymentState] = mapped_column(
        String(40), nullable=False, default=PaymentState.PREAUTH_REQUESTED
    )
    raw_request: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    raw_response: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    failure_code: Mapped[str | None] = mapped_column(String(120))
    failure_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
