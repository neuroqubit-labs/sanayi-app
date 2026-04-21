"""Case process katmanı (Faz 7a) — vaka yaşam döngüsünün süreç iskeletini
backend'de authoritative state ile tutan tablolar: milestones, tasks,
approvals, approval_line_items.

Mobil `CaseMilestoneSchema`, `CaseTaskSchema`, `CaseApprovalSchema`,
`CaseApprovalLineItemSchema` — packages/domain/src/service-case.ts'te tanımlı.
Case create'de workflow_blueprint'e göre `workflow_seed` servisi milestone+task
satırlarını otomatik insert eder.

FK matrisi (Eksen 4 [4b]):
- service_cases → case_milestones            CASCADE
- case_milestones → case_tasks.milestone_id  CASCADE
- service_cases → case_tasks                 CASCADE
- service_cases → case_approvals             CASCADE
- users (requested_by) → case_approvals      SET NULL
- case_approvals → case_approval_line_items  CASCADE
"""

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
    SmallInteger,
    String,
    Text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin

# ─── Enums ──────────────────────────────────────────────────────────────────


class CaseActor(StrEnum):
    CUSTOMER = "customer"
    TECHNICIAN = "technician"
    SYSTEM = "system"


class CaseMilestoneStatus(StrEnum):
    COMPLETED = "completed"
    ACTIVE = "active"
    UPCOMING = "upcoming"
    BLOCKED = "blocked"


class CaseTaskKind(StrEnum):
    REFRESH_MATCHING = "refresh_matching"
    REVIEW_OFFERS = "review_offers"
    CONFIRM_APPOINTMENT = "confirm_appointment"
    REVIEW_PROGRESS = "review_progress"
    APPROVE_PARTS = "approve_parts"
    APPROVE_INVOICE = "approve_invoice"
    CONFIRM_COMPLETION = "confirm_completion"
    MESSAGE_SERVICE = "message_service"
    UPLOAD_INTAKE_PROOF = "upload_intake_proof"
    UPLOAD_PROGRESS_PROOF = "upload_progress_proof"
    SHARE_STATUS_UPDATE = "share_status_update"
    REQUEST_PARTS_APPROVAL = "request_parts_approval"
    SHARE_INVOICE = "share_invoice"
    UPLOAD_DELIVERY_PROOF = "upload_delivery_proof"
    MARK_READY_FOR_DELIVERY = "mark_ready_for_delivery"
    START_SIMILAR_REQUEST = "start_similar_request"
    OPEN_DOCUMENTS = "open_documents"


class CaseTaskStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    BLOCKED = "blocked"


class CaseTaskUrgency(StrEnum):
    BACKGROUND = "background"
    SOON = "soon"
    NOW = "now"


class CaseApprovalKind(StrEnum):
    PARTS_REQUEST = "parts_request"
    INVOICE = "invoice"
    COMPLETION = "completion"


class CaseApprovalStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class CaseWorkflowBlueprint(StrEnum):
    """App-level; service_cases.workflow_blueprint string olarak tutulur."""

    DAMAGE_INSURED = "damage_insured"
    DAMAGE_UNINSURED = "damage_uninsured"
    MAINTENANCE_STANDARD = "maintenance_standard"
    MAINTENANCE_MAJOR = "maintenance_major"


# ─── Tables ─────────────────────────────────────────────────────────────────


class CaseMilestone(UUIDPkMixin, TimestampMixin, Base):
    """Vaka workflow aşaması (intake, diagnosis, approval, repair, delivery...)."""

    __tablename__ = "case_milestones"

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"), nullable=False
    )
    key: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    actor: Mapped[CaseActor] = mapped_column(
        SAEnum(CaseActor, name="case_actor"), nullable=False
    )
    sequence: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    status: Mapped[CaseMilestoneStatus] = mapped_column(
        SAEnum(CaseMilestoneStatus, name="case_milestone_status"),
        nullable=False,
        default=CaseMilestoneStatus.UPCOMING,
    )
    badge_label: Mapped[str | None] = mapped_column(String(64))
    blocker_reason: Mapped[str | None] = mapped_column(Text)


class CaseTask(UUIDPkMixin, TimestampMixin, Base):
    """Milestone altındaki atomic aksiyon (upload_proof, approve_parts, vb.)."""

    __tablename__ = "case_tasks"

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"), nullable=False
    )
    milestone_id: Mapped[UUID] = mapped_column(
        ForeignKey("case_milestones.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[CaseTaskKind] = mapped_column(
        SAEnum(CaseTaskKind, name="case_task_kind"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    actor: Mapped[CaseActor] = mapped_column(
        SAEnum(CaseActor, name="case_actor", create_type=False), nullable=False
    )
    status: Mapped[CaseTaskStatus] = mapped_column(
        SAEnum(CaseTaskStatus, name="case_task_status"),
        nullable=False,
        default=CaseTaskStatus.PENDING,
    )
    urgency: Mapped[CaseTaskUrgency] = mapped_column(
        SAEnum(CaseTaskUrgency, name="case_task_urgency"),
        nullable=False,
        default=CaseTaskUrgency.BACKGROUND,
    )
    cta_label: Mapped[str] = mapped_column(String(255), nullable=False)
    helper_label: Mapped[str | None] = mapped_column(String(255))
    blocker_reason: Mapped[str | None] = mapped_column(Text)
    # Eksen 4 [4e]: sorgulanmıyor, sadece UI için; JSONB inline yeterli
    evidence_requirements: Mapped[list[dict[str, object]]] = mapped_column(
        JSONB, nullable=False, server_default="[]"
    )


class CaseApproval(UUIDPkMixin, TimestampMixin, Base):
    """Parça / fatura / teslim onay talebi — multi-part karar."""

    __tablename__ = "case_approvals"

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[CaseApprovalKind] = mapped_column(
        SAEnum(CaseApprovalKind, name="case_approval_kind"), nullable=False
    )
    status: Mapped[CaseApprovalStatus] = mapped_column(
        SAEnum(CaseApprovalStatus, name="case_approval_status"),
        nullable=False,
        default=CaseApprovalStatus.PENDING,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    # Eksen 4 [4h]: hard delete'te SET NULL + snapshot
    requested_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    requested_by_snapshot_name: Mapped[str | None] = mapped_column(String(255))
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(
        String(8), nullable=False, default="TRY", server_default="TRY"
    )
    service_comment: Mapped[str | None] = mapped_column(Text)


class CaseApprovalLineItem(UUIDPkMixin, Base):
    """Approval kalem (parça/işçilik satırı)."""

    __tablename__ = "case_approval_line_items"
    __table_args__ = (
        CheckConstraint("sequence >= 0", name="ck_case_approval_line_items_seq"),
    )

    approval_id: Mapped[UUID] = mapped_column(
        ForeignKey("case_approvals.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    sequence: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
