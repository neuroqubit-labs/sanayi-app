"""Case-technician matching and customer notification read models."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin
from app.db.enums import pg_enum


class CaseTechnicianMatchVisibility(StrEnum):
    CANDIDATE = "candidate"
    SHOWN_TO_CUSTOMER = "shown_to_customer"
    HIDDEN = "hidden"
    INVALIDATED = "invalidated"


class CaseTechnicianMatchSource(StrEnum):
    SYSTEM = "system"
    CUSTOMER_NOTIFY = "customer_notify"
    MANUAL = "manual"


class CaseTechnicianNotificationStatus(StrEnum):
    SENT = "sent"
    SEEN = "seen"
    DISMISSED = "dismissed"
    OFFER_CREATED = "offer_created"
    EXPIRED = "expired"


class CaseTechnicianMatch(UUIDPkMixin, TimestampMixin, Base):
    """System-computed "this technician fits this case" read model."""

    __tablename__ = "case_technician_matches"
    __table_args__ = (
        UniqueConstraint(
            "case_id",
            "technician_user_id",
            name="uq_case_technician_matches_case_tech",
        ),
        CheckConstraint("score >= 0", name="ck_case_technician_matches_score_nonneg"),
    )

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"), nullable=False
    )
    technician_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    technician_profile_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("technician_profiles.id", ondelete="CASCADE"), nullable=True
    )
    score: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False, default=Decimal("0.00"), server_default="0"
    )
    reason_codes: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, server_default="{}"
    )
    reason_label: Mapped[str] = mapped_column(String(255), nullable=False)
    visibility_state: Mapped[CaseTechnicianMatchVisibility] = mapped_column(
        pg_enum(
            CaseTechnicianMatchVisibility,
            name="case_technician_match_visibility",
        ),
        nullable=False,
        default=CaseTechnicianMatchVisibility.CANDIDATE,
    )
    source: Mapped[CaseTechnicianMatchSource] = mapped_column(
        pg_enum(CaseTechnicianMatchSource, name="case_technician_match_source"),
        nullable=False,
        default=CaseTechnicianMatchSource.SYSTEM,
    )
    context: Mapped[dict[str, object]] = mapped_column(
        JSONB, nullable=False, server_default="{}"
    )
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
    invalidated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CaseTechnicianNotification(UUIDPkMixin, TimestampMixin, Base):
    """Customer intent: notify a technician about an existing case."""

    __tablename__ = "case_technician_notifications"
    __table_args__ = (
        UniqueConstraint(
            "case_id",
            "technician_user_id",
            name="uq_case_technician_notifications_case_tech",
        ),
    )

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"), nullable=False
    )
    customer_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    technician_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    technician_profile_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("technician_profiles.id", ondelete="CASCADE"), nullable=True
    )
    match_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("case_technician_matches.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[CaseTechnicianNotificationStatus] = mapped_column(
        pg_enum(
            CaseTechnicianNotificationStatus,
            name="case_technician_notification_status",
        ),
        nullable=False,
        default=CaseTechnicianNotificationStatus.SENT,
    )
    note: Mapped[str | None] = mapped_column(Text)
    seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
