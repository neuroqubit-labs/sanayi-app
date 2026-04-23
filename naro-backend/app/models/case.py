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
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin
from app.db.enums import pg_enum


class ServiceRequestKind(StrEnum):
    ACCIDENT = "accident"
    TOWING = "towing"
    BREAKDOWN = "breakdown"
    MAINTENANCE = "maintenance"


class TowMode(StrEnum):
    IMMEDIATE = "immediate"
    SCHEDULED = "scheduled"


class TowEquipment(StrEnum):
    FLATBED = "flatbed"
    HOOK = "hook"
    WHEEL_LIFT = "wheel_lift"
    HEAVY_DUTY = "heavy_duty"
    MOTORCYCLE = "motorcycle"


class TowIncidentReason(StrEnum):
    NOT_RUNNING = "not_running"
    ACCIDENT = "accident"
    FLAT_TIRE = "flat_tire"
    BATTERY = "battery"
    FUEL = "fuel"
    LOCKED_KEYS = "locked_keys"
    STUCK = "stuck"
    OTHER = "other"


class TowDispatchStage(StrEnum):
    SEARCHING = "searching"
    ACCEPTED = "accepted"
    EN_ROUTE = "en_route"
    NEARBY = "nearby"
    ARRIVED = "arrived"
    LOADING = "loading"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    TIMEOUT_CONVERTED_TO_POOL = "timeout_converted_to_pool"
    SCHEDULED_WAITING = "scheduled_waiting"
    BIDDING_OPEN = "bidding_open"
    OFFER_ACCEPTED = "offer_accepted"
    PREAUTH_FAILED = "preauth_failed"
    PREAUTH_STALE = "preauth_stale"


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
        pg_enum(ServiceRequestKind, name="service_request_kind"),
        nullable=False,
    )
    urgency: Mapped[ServiceRequestUrgency] = mapped_column(
        pg_enum(ServiceRequestUrgency, name="service_request_urgency"),
        nullable=False,
        default=ServiceRequestUrgency.PLANNED,
    )
    status: Mapped[ServiceCaseStatus] = mapped_column(
        pg_enum(ServiceCaseStatus, name="service_case_status"),
        nullable=False,
        default=ServiceCaseStatus.MATCHING,
    )
    origin: Mapped[CaseOrigin] = mapped_column(
        pg_enum(CaseOrigin, name="case_origin"),
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
        pg_enum(CaseWaitActor, name="case_wait_actor"),
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

    # Faz B-3 — billing lifecycle state (non-tow kind'lar). Tow case'lerinde
    # null kalır (tow_fare_settlements.state ayrı).
    billing_state: Mapped[str | None] = mapped_column(String(40), nullable=True)

    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Faz 1 canonical case architecture (migration 0032):
    # tow_mode / tow_stage / pickup+dropoff geo / incident_reason / scheduled_at
    # / tow_fare_quote kolonları TowCase subtype tablosuna taşındı.
    # Enum tipleri (TowMode/TowDispatchStage/TowEquipment/TowIncidentReason)
    # aynı enumlar — tow_case'te create_type=False ile yeniden kullanılır.
