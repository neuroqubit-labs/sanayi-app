"""Technician payment account / PSP sub-merchant state."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin
from app.db.enums import pg_enum


class TechnicianPaymentAccountStatus(StrEnum):
    NOT_STARTED = "not_started"
    DRAFT = "draft"
    SUBMITTED = "submitted"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    DISABLED = "disabled"


class TechnicianPaymentLegalType(StrEnum):
    INDIVIDUAL_SOLE_PROP = "individual_sole_prop"
    COMPANY = "company"


class TechnicianPaymentAccount(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "technician_payment_accounts"
    __table_args__ = (
        CheckConstraint(
            "provider IN ('iyzico','mock')",
            name="ck_technician_payment_accounts_provider",
        ),
    )

    technician_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    provider: Mapped[str] = mapped_column(
        String(32), nullable=False, default="mock", server_default="mock"
    )
    status: Mapped[TechnicianPaymentAccountStatus] = mapped_column(
        pg_enum(
            TechnicianPaymentAccountStatus,
            name="technician_payment_account_status",
        ),
        nullable=False,
        default=TechnicianPaymentAccountStatus.NOT_STARTED,
        server_default=TechnicianPaymentAccountStatus.NOT_STARTED.value,
    )
    sub_merchant_key: Mapped[str | None] = mapped_column(String(160))
    legal_type: Mapped[TechnicianPaymentLegalType | None] = mapped_column(
        pg_enum(
            TechnicianPaymentLegalType,
            name="technician_payment_legal_type",
        ),
        nullable=True,
    )
    legal_name: Mapped[str | None] = mapped_column(String(255))
    tax_number_ref: Mapped[str | None] = mapped_column(String(80))
    iban_ref: Mapped[str | None] = mapped_column(String(80))
    authorized_person_name: Mapped[str | None] = mapped_column(String(255))
    address_snapshot: Mapped[dict[str, object]] = mapped_column(
        JSONB, nullable=False, server_default="{}"
    )
    business_snapshot: Mapped[dict[str, object]] = mapped_column(
        JSONB, nullable=False, server_default="{}"
    )
    can_receive_online_payments: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewer_note: Mapped[str | None] = mapped_column(Text)
