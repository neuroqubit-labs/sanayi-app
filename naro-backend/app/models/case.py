"""ServiceCase — merkez entity. Vaka bir müşterinin talebiyle açılır;
havuzdan tamamlamaya kadar tek satır yaşar.

`request_draft` JSONB → ServiceRequestDraft snapshot (kind-spesifik 30+ field).
Status makinesi `app/services/case_lifecycle.py` enforce eder; DB yalnızca enum
validate. Compute kolonları (next_action_*, *_label) **depolanmaz**; mobil
tracking engine hesaplar.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin


class ServiceRequestKind(StrEnum):
    ACCIDENT = "accident"
    TOWING = "towing"
    BREAKDOWN = "breakdown"
    MAINTENANCE = "maintenance"


class ServiceRequestUrgency(StrEnum):
    PLANNED = "planned"
    TODAY = "today"
    URGENT = "urgent"


class ServiceCaseStatus(StrEnum):
    MATCHING = "matching"
    OFFERS_READY = "offers_ready"
    APPOINTMENT_PENDING = "appointment_pending"
    SCHEDULED = "scheduled"
    SERVICE_IN_PROGRESS = "service_in_progress"
    PARTS_APPROVAL = "parts_approval"
    INVOICE_APPROVAL = "invoice_approval"
    COMPLETED = "completed"
    ARCHIVED = "archived"
    CANCELLED = "cancelled"


class CaseOrigin(StrEnum):
    CUSTOMER = "customer"
    TECHNICIAN = "technician"


class CaseWaitActor(StrEnum):
    CUSTOMER = "customer"
    TECHNICIAN = "technician"
    SYSTEM = "system"
    NONE = "none"


class ServiceCase(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "service_cases"

    vehicle_id: Mapped[UUID] = mapped_column(
        ForeignKey("vehicles.id", ondelete="RESTRICT"), nullable=False
    )
    customer_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    kind: Mapped[ServiceRequestKind] = mapped_column(
        SAEnum(ServiceRequestKind, name="service_request_kind"),
        nullable=False,
    )
    urgency: Mapped[ServiceRequestUrgency] = mapped_column(
        SAEnum(ServiceRequestUrgency, name="service_request_urgency"),
        nullable=False,
        default=ServiceRequestUrgency.PLANNED,
    )
    status: Mapped[ServiceCaseStatus] = mapped_column(
        SAEnum(ServiceCaseStatus, name="service_case_status"),
        nullable=False,
        default=ServiceCaseStatus.MATCHING,
    )
    origin: Mapped[CaseOrigin] = mapped_column(
        SAEnum(CaseOrigin, name="case_origin"),
        nullable=False,
        default=CaseOrigin.CUSTOMER,
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String(255))
    summary: Mapped[str | None] = mapped_column(Text)
    location_label: Mapped[str | None] = mapped_column(String(255))

    preferred_technician_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    assigned_technician_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    workflow_blueprint: Mapped[str] = mapped_column(String(64), nullable=False)
    request_draft: Mapped[dict[str, object]] = mapped_column(
        JSONB, nullable=False
    )

    wait_state_actor: Mapped[CaseWaitActor] = mapped_column(
        SAEnum(CaseWaitActor, name="case_wait_actor"),
        nullable=False,
        default=CaseWaitActor.SYSTEM,
    )
    wait_state_label: Mapped[str | None] = mapped_column(String(255))
    wait_state_description: Mapped[str | None] = mapped_column(Text)

    last_seen_by_customer: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_seen_by_technician: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    total_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    estimate_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))

    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
