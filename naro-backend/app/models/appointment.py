"""Appointment — müşteri-usta buluşma talebi.

Case başına 1 aktif pending randevu (partial unique). Approve atomic transition:
appointment + case + offer tek transaction'da senkron olur.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin
from app.db.enums import pg_enum


class AppointmentSlotKind(StrEnum):
    TODAY = "today"
    TOMORROW = "tomorrow"
    CUSTOM = "custom"
    FLEXIBLE = "flexible"


class AppointmentStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    DECLINED = "declined"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    COUNTER_PENDING = "counter_pending"


class AppointmentSource(StrEnum):
    """App-level; DB'de CHECK constraint ile enforce."""

    OFFER_ACCEPT = "offer_accept"       # Müşteri firm teklifi kabul etti → auto-randevu (Kural 4)
    DIRECT_REQUEST = "direct_request"   # Müşteri teklif olmadan randevu talep (Kural 2)
    COUNTER = "counter"                 # Usta counter-offer sonrası oluşan randevu (Kural 5)


class Appointment(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "appointments"
    __table_args__ = (
        CheckConstraint(
            "source IN ('offer_accept','direct_request','counter')",
            name="ck_appointments_source",
        ),
    )

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"), nullable=False
    )
    technician_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    offer_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("case_offers.id", ondelete="SET NULL"), nullable=True
    )

    slot: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    slot_kind: Mapped[AppointmentSlotKind] = mapped_column(
        pg_enum(AppointmentSlotKind, name="appointment_slot_kind"),
        nullable=False,
    )

    note: Mapped[str | None] = mapped_column(Text, default="", server_default="")
    status: Mapped[AppointmentStatus] = mapped_column(
        pg_enum(AppointmentStatus, name="appointment_status"),
        nullable=False,
        default=AppointmentStatus.PENDING,
    )

    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decline_reason: Mapped[str | None] = mapped_column(Text)

    source: Mapped[str] = mapped_column(
        String(16), nullable=False, default="offer_accept", server_default="offer_accept"
    )
    counter_proposal: Mapped[dict[str, object] | None] = mapped_column(
        JSONB, nullable=True
    )
    counter_proposal_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
