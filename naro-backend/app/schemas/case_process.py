"""Pydantic DTOs for case_process domain (Faz 7a + 7b + 7c + 7d)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.case_artifact import CaseAttachmentKind
from app.models.case_audit import (
    CaseEventType,
    CaseNotificationIntentType,
    CaseTone,
)
from app.models.case_communication import CaseMessageAuthorRole
from app.models.case_process import (
    CaseActor,
    CaseApprovalKind,
    CaseApprovalStatus,
    CaseMilestoneStatus,
    CaseTaskKind,
    CaseTaskStatus,
    CaseTaskUrgency,
)

# ─── Milestone ──────────────────────────────────────────────────────────────


class CaseMilestoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    case_id: UUID
    key: str
    title: str
    description: str | None
    actor: CaseActor
    sequence: int
    status: CaseMilestoneStatus
    badge_label: str | None
    blocker_reason: str | None
    created_at: datetime
    updated_at: datetime


# ─── Task ───────────────────────────────────────────────────────────────────


class CaseEvidenceRequirement(BaseModel):
    """Task içinde JSONB inline (Eksen 4 [4e])."""

    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    kind: CaseAttachmentKind
    required: bool = True
    hint: str | None = None


class CaseTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    case_id: UUID
    milestone_id: UUID
    kind: CaseTaskKind
    title: str
    description: str | None
    actor: CaseActor
    status: CaseTaskStatus
    urgency: CaseTaskUrgency
    cta_label: str
    helper_label: str | None
    blocker_reason: str | None
    evidence_requirements: list[dict[str, object]]
    created_at: datetime
    updated_at: datetime


# ─── Approval ───────────────────────────────────────────────────────────────


class CaseApprovalLineItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str = Field(min_length=1, max_length=255)
    value: str = Field(min_length=1, max_length=255)
    note: str | None = None


class CaseApprovalLineItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    label: str
    value: str
    note: str | None
    sequence: int


class CaseApprovalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: CaseApprovalKind
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    amount: Decimal | None = None
    currency: str = "TRY"
    service_comment: str | None = None
    line_items: list[CaseApprovalLineItemCreate] = Field(default_factory=list)


class CaseApprovalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    case_id: UUID
    kind: CaseApprovalKind
    status: CaseApprovalStatus
    title: str
    description: str | None
    requested_by_user_id: UUID | None
    requested_by_snapshot_name: str | None
    requested_at: datetime
    responded_at: datetime | None
    amount: Decimal | None
    currency: str
    service_comment: str | None
    created_at: datetime
    updated_at: datetime


# ─── Evidence / Document / Attachment ──────────────────────────────────────


class CaseEvidenceItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=255)
    kind: CaseAttachmentKind
    actor: CaseActor
    source_label: str = Field(min_length=1, max_length=255)
    status_label: str = "Yüklendi"
    subtitle: str | None = None
    media_asset_id: UUID | None = None
    task_id: UUID | None = None
    milestone_id: UUID | None = None
    approval_id: UUID | None = None
    requirement_id: str | None = Field(default=None, max_length=64)


class CaseEvidenceItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    case_id: UUID
    task_id: UUID | None
    milestone_id: UUID | None
    title: str
    subtitle: str | None
    kind: CaseAttachmentKind
    actor: str
    source_label: str
    status_label: str
    media_asset_id: UUID | None
    is_new: bool
    created_at: datetime
    updated_at: datetime


class CaseDocumentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=255)
    kind: CaseAttachmentKind
    source_label: str = Field(min_length=1, max_length=255)
    status_label: str = "Hazır"
    subtitle: str | None = None
    media_asset_id: UUID | None = None


class CaseDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    case_id: UUID
    kind: CaseAttachmentKind
    title: str
    subtitle: str | None
    source_label: str
    status_label: str
    media_asset_id: UUID | None
    created_at: datetime
    updated_at: datetime


class CaseAttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    case_id: UUID
    kind: CaseAttachmentKind
    title: str
    subtitle: str | None
    status_label: str | None
    media_asset_id: UUID | None
    created_at: datetime
    updated_at: datetime


# ─── Thread + Message ───────────────────────────────────────────────────────


class CaseMessageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: str = Field(min_length=1)
    attachment_asset_ids: list[UUID] = Field(default_factory=list)


class CaseMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    thread_id: UUID
    case_id: UUID
    author_user_id: UUID | None
    author_role: CaseMessageAuthorRole
    author_snapshot_name: str | None
    body: str
    created_at: datetime


class CaseThreadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    case_id: UUID
    preview: str | None
    unread_customer: int
    unread_technician: int
    created_at: datetime
    updated_at: datetime


# ─── Event + Notification intent ───────────────────────────────────────────


class CaseEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    case_id: UUID
    event_type: CaseEventType = Field(alias="event_type")
    title: str
    body: str | None
    tone: CaseTone
    actor_user_id: UUID | None
    context: dict[str, object]
    created_at: datetime


class CaseNotificationIntentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    case_id: UUID
    task_id: UUID | None
    intent_type: CaseNotificationIntentType
    actor: str
    title: str
    body: str | None
    route_hint: str | None
    is_new: bool
    read_at: datetime | None
    created_at: datetime
