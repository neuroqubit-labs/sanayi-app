"""Tow dispatch domain models — Faz 10.

Tablolar:
- tow_dispatch_attempts: Uber-tarzı auto-dispatch attempt audit (UNIQUE case+tech+order).
- tow_live_locations: Partitioned (RANGE captured_at, günlük). Generated geography.
- tow_fare_settlements: 1:1 service_cases finansal ledger.
- tow_fare_refunds: multi-refund separation (capture_delta / cancellation / kasko / manual).
- tow_payment_idempotency: PSP replay cache (24h TTL).
- tow_cancellations: iptal actor + reason + fee/refund + stage_at_cancel.
- tow_otp_events: arrival/delivery OTP issue + verify audit.

State machine + repositories `app/repositories/tow_*.py`, services `app/services/tow_*.py`.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from geoalchemy2 import Geography
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPkMixin
from app.models.case import TowDispatchStage

# ─── Enums ──────────────────────────────────────────────────────────────────


class TowDispatchResponse(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    TIMEOUT = "timeout"


class TowSettlementStatus(StrEnum):
    NONE = "none"
    PRE_AUTH_HOLDING = "pre_auth_holding"
    PREAUTH_STALE = "preauth_stale"
    FINAL_CHARGED = "final_charged"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"
    KASKO_REJECTED = "kasko_rejected"


class TowRefundReason(StrEnum):
    CAPTURE_DELTA = "capture_delta"
    CANCELLATION = "cancellation"
    KASKO_REIMBURSEMENT = "kasko_reimbursement"
    MANUAL = "manual"


class TowPaymentOperation(StrEnum):
    PREAUTH = "preauth"
    CAPTURE = "capture"
    REFUND = "refund"
    VOID = "void"


class TowCancellationActor(StrEnum):
    CUSTOMER = "customer"
    TECHNICIAN = "technician"
    SYSTEM = "system"
    ADMIN = "admin"


class TowOtpPurpose(StrEnum):
    ARRIVAL = "arrival"
    DELIVERY = "delivery"


class TowOtpRecipient(StrEnum):
    CUSTOMER = "customer"
    DELIVERY_PERSON = "delivery_person"


class TowOtpDelivery(StrEnum):
    SMS = "sms"
    IN_APP = "in_app"


class TowOtpVerifyResult(StrEnum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    EXPIRED = "expired"


# ─── Tables ─────────────────────────────────────────────────────────────────


class TowDispatchAttempt(UUIDPkMixin, Base):
    __tablename__ = "tow_dispatch_attempts"
    __table_args__ = (
        UniqueConstraint(
            "case_id", "technician_id", "attempt_order",
            name="uq_tow_dispatch_attempts_case_tech_order",
        ),
        CheckConstraint(
            "attempt_order >= 1", name="ck_tow_dispatch_attempts_order_pos"
        ),
        CheckConstraint(
            "distance_km IS NULL OR distance_km >= 0",
            name="ck_tow_dispatch_attempts_distance_nonneg",
        ),
    )

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"), nullable=False
    )
    technician_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    attempt_order: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    response: Mapped[TowDispatchResponse] = mapped_column(
        SAEnum(TowDispatchResponse, name="tow_dispatch_response"),
        nullable=False,
        default=TowDispatchResponse.PENDING,
        server_default="pending",
    )
    distance_km: Mapped[Decimal | None] = mapped_column(Numeric(8, 3))
    eta_minutes: Mapped[int | None] = mapped_column(SmallInteger)
    score: Mapped[Decimal | None] = mapped_column(Numeric(7, 4))
    radius_km: Mapped[int | None] = mapped_column(SmallInteger)
    rejection_reason: Mapped[str | None] = mapped_column(String(64))
    snapshot: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )


class TowLiveLocation(Base):
    """Partitioned by RANGE(captured_at). PK = (id, captured_at)."""

    __tablename__ = "tow_live_locations"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"), nullable=False
    )
    technician_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    location: Mapped[str | None] = mapped_column(
        Geography(geometry_type="POINT", srid=4326),
        nullable=True,
    )
    heading_deg: Mapped[int | None] = mapped_column(SmallInteger)
    speed_kmh: Mapped[int | None] = mapped_column(SmallInteger)
    accuracy_m: Mapped[int | None] = mapped_column(SmallInteger)
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True, nullable=False
    )
    server_received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )


class TowFareSettlement(UUIDPkMixin, Base):
    __tablename__ = "tow_fare_settlements"
    __table_args__ = (
        CheckConstraint(
            "cap_amount IS NULL OR cap_amount >= 0",
            name="ck_tow_settlements_cap_nonneg",
        ),
        CheckConstraint(
            "final_amount IS NULL OR final_amount >= 0",
            name="ck_tow_settlements_final_nonneg",
        ),
    )

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="RESTRICT"),
        nullable=False, unique=True,
    )
    state: Mapped[TowSettlementStatus] = mapped_column(
        SAEnum(TowSettlementStatus, name="tow_settlement_status"),
        nullable=False,
        default=TowSettlementStatus.NONE,
        server_default="none",
    )
    preauth_id: Mapped[str | None] = mapped_column(String(128))
    preauth_authorized_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    preauth_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    capture_id: Mapped[str | None] = mapped_column(String(128))
    captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cap_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    quoted_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    actual_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    final_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    kasko_owed_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="TRY", server_default="TRY"
    )
    retry_count: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    last_error: Mapped[str | None] = mapped_column(Text)
    psp_response: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default="now()",
        nullable=False,
    )


class TowFareRefund(UUIDPkMixin, Base):
    __tablename__ = "tow_fare_refunds"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_tow_refunds_amount_pos"),
    )

    settlement_id: Mapped[UUID] = mapped_column(
        ForeignKey("tow_fare_settlements.id", ondelete="CASCADE"),
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="TRY", server_default="TRY"
    )
    reason: Mapped[TowRefundReason] = mapped_column(
        SAEnum(TowRefundReason, name="tow_refund_reason"),
        nullable=False,
    )
    psp_ref: Mapped[str | None] = mapped_column(String(128))
    idempotency_key: Mapped[str] = mapped_column(
        String(128), nullable=False, unique=True
    )
    psp_response: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )


class TowPaymentIdempotency(Base):
    __tablename__ = "tow_payment_idempotency"

    key: Mapped[str] = mapped_column(String(160), primary_key=True)
    settlement_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("tow_fare_settlements.id", ondelete="SET NULL")
    )
    operation: Mapped[TowPaymentOperation] = mapped_column(
        SAEnum(TowPaymentOperation, name="tow_payment_operation"),
        nullable=False,
    )
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    response_status: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    response_body: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )


class TowCancellation(UUIDPkMixin, Base):
    __tablename__ = "tow_cancellations"
    __table_args__ = (
        CheckConstraint(
            "cancellation_fee >= 0", name="ck_tow_cancellations_fee_nonneg"
        ),
        CheckConstraint(
            "refund_amount >= 0", name="ck_tow_cancellations_refund_nonneg"
        ),
    )

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"),
        nullable=False, unique=True,
    )
    actor: Mapped[TowCancellationActor] = mapped_column(
        SAEnum(TowCancellationActor, name="tow_cancellation_actor"),
        nullable=False,
    )
    actor_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reason_code: Mapped[str] = mapped_column(String(64), nullable=False)
    reason_note: Mapped[str | None] = mapped_column(Text)
    stage_at_cancel: Mapped[TowDispatchStage] = mapped_column(
        SAEnum(TowDispatchStage, name="tow_dispatch_stage"),
        nullable=False,
    )
    cancellation_fee: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    refund_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    canceled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )


class TowOtpEvent(UUIDPkMixin, Base):
    __tablename__ = "tow_otp_events"
    __table_args__ = (
        CheckConstraint(
            "attempts >= 0 AND attempts <= 10",
            name="ck_tow_otp_attempts_range",
        ),
    )

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"), nullable=False
    )
    purpose: Mapped[TowOtpPurpose] = mapped_column(
        SAEnum(TowOtpPurpose, name="tow_otp_purpose"), nullable=False
    )
    recipient: Mapped[TowOtpRecipient] = mapped_column(
        SAEnum(TowOtpRecipient, name="tow_otp_recipient"), nullable=False
    )
    delivered_via: Mapped[TowOtpDelivery] = mapped_column(
        SAEnum(TowOtpDelivery, name="tow_otp_delivery"), nullable=False
    )
    code_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    verify_result: Mapped[TowOtpVerifyResult] = mapped_column(
        SAEnum(TowOtpVerifyResult, name="tow_otp_verify_result"),
        nullable=False,
        default=TowOtpVerifyResult.PENDING,
        server_default="pending",
    )
    issued_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )
