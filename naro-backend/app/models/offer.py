"""CaseOffer — usta teklifi. (case, technician) başına 1 aktif teklif
(partial unique `status IN ('pending','shortlisted','accepted')`).
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin


class CaseOfferStatus(StrEnum):
    PENDING = "pending"
    SHORTLISTED = "shortlisted"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"
    WITHDRAWN = "withdrawn"


ACTIVE_OFFER_STATUSES: frozenset[CaseOfferStatus] = frozenset(
    {CaseOfferStatus.PENDING, CaseOfferStatus.SHORTLISTED, CaseOfferStatus.ACCEPTED}
)


class CaseOffer(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "case_offers"
    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_case_offers_amount_nonneg"),
        CheckConstraint("eta_minutes >= 0", name="ck_case_offers_eta_nonneg"),
        CheckConstraint(
            "NOT slot_is_firm OR slot_proposal IS NOT NULL",
            name="ck_case_offers_firm_slot_required",
        ),
    )

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"), nullable=False
    )
    technician_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    headline: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(8), nullable=False, default="TRY", server_default="TRY"
    )
    eta_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    delivery_mode: Mapped[str] = mapped_column(String(64), nullable=False)
    warranty_label: Mapped[str] = mapped_column(String(128), nullable=False)
    available_at_label: Mapped[str | None] = mapped_column(String(128))
    badges: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, server_default="{}"
    )

    slot_proposal: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    slot_is_firm: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    status: Mapped[CaseOfferStatus] = mapped_column(
        SAEnum(CaseOfferStatus, name="case_offer_status"),
        nullable=False,
        default=CaseOfferStatus.PENDING,
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
