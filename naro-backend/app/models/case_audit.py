"""Case audit + notification katmanı (Faz 7d) — events + notification_intents.

`case_events`: append-only audit trail. Eksen 4 [4f] + Eksen 5: 26 event type.
Her service transition'ı explicit `append_event` çağırır.

`case_notification_intents`: sunucu-tarafı bildirim kuyrudu. Mobil push/sms
delivery Faz 8+; şu an intent insert yeter (UI polling + read mark).

Append-only: hiçbir update/delete API'si yok; retention cron (Faz 15) 2 yıl
sonra hard delete.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPkMixin
from app.db.enums import pg_enum


class CaseEventType(StrEnum):
    # Mevcut (mobil 8) + eksen 4 [4f] + eksen 5
    SUBMITTED = "submitted"
    OFFER_RECEIVED = "offer_received"
    OFFER_ACCEPTED = "offer_accepted"
    OFFER_REJECTED = "offer_rejected"
    OFFER_WITHDRAWN = "offer_withdrawn"
    APPOINTMENT_REQUESTED = "appointment_requested"
    APPOINTMENT_APPROVED = "appointment_approved"
    APPOINTMENT_DECLINED = "appointment_declined"
    APPOINTMENT_CANCELLED = "appointment_cancelled"
    APPOINTMENT_EXPIRED = "appointment_expired"
    APPOINTMENT_COUNTER = "appointment_counter"
    TECHNICIAN_SELECTED = "technician_selected"
    TECHNICIAN_UNASSIGNED = "technician_unassigned"
    STATUS_UPDATE = "status_update"
    PARTS_REQUESTED = "parts_requested"
    PARTS_APPROVED = "parts_approved"
    PARTS_REJECTED = "parts_rejected"
    INVOICE_SHARED = "invoice_shared"
    INVOICE_APPROVED = "invoice_approved"
    EVIDENCE_ADDED = "evidence_added"
    DOCUMENT_ADDED = "document_added"
    MESSAGE = "message"
    WAIT_STATE_CHANGED = "wait_state_changed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ARCHIVED = "archived"
    SOFT_DELETED = "soft_deleted"
    # Faz 8 — insurance claims
    INSURANCE_CLAIM_SUBMITTED = "insurance_claim_submitted"
    INSURANCE_CLAIM_ACCEPTED = "insurance_claim_accepted"
    INSURANCE_CLAIM_PAID = "insurance_claim_paid"
    INSURANCE_CLAIM_REJECTED = "insurance_claim_rejected"
    # Faz 10 — tow dispatch
    TOW_STAGE_REQUESTED = "tow_stage_requested"
    TOW_STAGE_COMMITTED = "tow_stage_committed"
    TOW_EVIDENCE_ADDED = "tow_evidence_added"
    TOW_LOCATION_RECORDED = "tow_location_recorded"
    TOW_FARE_CAPTURED = "tow_fare_captured"
    TOW_DISPATCH_CANDIDATE_SELECTED = "tow_dispatch_candidate_selected"
    # Faz B-3 — billing lifecycle (non-tow kind'lar)
    PAYMENT_INITIATED = "payment_initiated"
    PAYMENT_AUTHORIZED = "payment_authorized"
    PAYMENT_CAPTURED = "payment_captured"
    PAYMENT_REFUNDED = "payment_refunded"
    COMMISSION_CALCULATED = "commission_calculated"
    PAYOUT_SCHEDULED = "payout_scheduled"
    PAYOUT_COMPLETED = "payout_completed"
    BILLING_STATE_CHANGED = "billing_state_changed"
    INVOICE_ISSUED = "invoice_issued"


class CaseTone(StrEnum):
    ACCENT = "accent"
    NEUTRAL = "neutral"
    SUCCESS = "success"
    WARNING = "warning"
    CRITICAL = "critical"
    INFO = "info"


class CaseNotificationIntentType(StrEnum):
    CUSTOMER_APPROVAL_NEEDED = "customer_approval_needed"
    QUOTE_READY = "quote_ready"
    APPOINTMENT_CONFIRMATION = "appointment_confirmation"
    EVIDENCE_MISSING = "evidence_missing"
    STATUS_UPDATE_REQUIRED = "status_update_required"
    DELIVERY_READY = "delivery_ready"
    PAYMENT_REVIEW = "payment_review"


class CaseEvent(UUIDPkMixin, Base):
    """Append-only audit log. Eksen 5 [5a]: explicit service-layer call."""

    __tablename__ = "case_events"
    __table_args__ = (
        CheckConstraint(
            "tone IN ('accent','neutral','success','warning','critical','info')",
            name="ck_case_events_tone",
        ),
    )

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[CaseEventType] = mapped_column(
        "type",
        pg_enum(CaseEventType, name="case_event_type"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    tone: Mapped[str] = mapped_column(String(16), nullable=False, default="neutral")
    actor_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # Eksen 5 [5b]: old_value, new_value, metadata
    context: Mapped[dict[str, object]] = mapped_column(
        JSONB, nullable=False, server_default="{}"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )


class CaseNotificationIntent(UUIDPkMixin, Base):
    """Sunucu-tarafı bildirim intent kuyrudu — push/sms delivery V2."""

    __tablename__ = "case_notification_intents"
    __table_args__ = (
        CheckConstraint(
            "actor IN ('customer','technician','system')",
            name="ck_case_notification_intents_actor",
        ),
    )

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"), nullable=False
    )
    task_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("case_tasks.id", ondelete="SET NULL"), nullable=True
    )
    intent_type: Mapped[CaseNotificationIntentType] = mapped_column(
        "type",
        pg_enum(CaseNotificationIntentType, name="case_notification_intent_type"),
        nullable=False,
    )
    actor: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    route_hint: Mapped[str | None] = mapped_column(String(512))
    is_new: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
