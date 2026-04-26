from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.appointment import (
    AppointmentSlotKind,
    AppointmentSource,
    AppointmentStatus,
)
from app.models.case import (
    CaseOrigin,
    CaseWaitActor,
    ServiceCaseStatus,
    ServiceRequestKind,
    ServiceRequestUrgency,
    TowDispatchStage,
    TowEquipment,
    TowIncidentReason,
    TowMode,
)
from app.models.case_artifact import CaseAttachmentKind
from app.models.case_audit import CaseEventType, CaseTone
from app.models.case_matching import (
    CaseTechnicianMatchVisibility,
    CaseTechnicianNotificationStatus,
)
from app.models.case_process import (
    CaseActor,
    CaseApprovalKind,
    CaseApprovalPaymentState,
    CaseApprovalStatus,
    CaseMilestoneStatus,
    CaseTaskKind,
    CaseTaskStatus,
    CaseTaskUrgency,
)
from app.models.offer import CaseOfferStatus
from app.models.technician import ProviderType, TechnicianVerifiedLevel


class MatchNotifyState(StrEnum):
    AVAILABLE = "available"
    ALREADY_NOTIFIED = "already_notified"
    HAS_OFFER = "has_offer"
    LIMIT_REACHED = "limit_reached"
    NOT_COMPATIBLE = "not_compatible"


class ViewerRole(StrEnum):
    CUSTOMER = "customer"
    POOL_TECHNICIAN = "pool_technician"
    ASSIGNED_TECHNICIAN = "assigned_technician"


class CaseWaitState(BaseModel):
    actor: CaseWaitActor
    label: str | None = None
    description: str | None = None


class CaseShellSection(BaseModel):
    id: UUID
    kind: ServiceRequestKind
    status: ServiceCaseStatus
    urgency: ServiceRequestUrgency
    origin: CaseOrigin
    title: str
    subtitle: str | None = None
    summary: str | None = None
    location_label: str | None = None
    wait_state: CaseWaitState
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None = None


class VehicleSnapshotSection(BaseModel):
    plate: str
    make: str | None = None
    model: str | None = None
    year: int | None = None
    fuel_type: str | None = None
    vin: str | None = None
    current_km: int | None = None


class AccidentDetail(BaseModel):
    kind: Literal[ServiceRequestKind.ACCIDENT]
    damage_area: str | None = None
    damage_severity: str | None = None
    counterparty_count: int = 0
    counterparty_note: str | None = None
    kasko_selected: bool = False
    sigorta_selected: bool = False
    kasko_brand: str | None = None
    sigorta_brand: str | None = None
    ambulance_contacted: bool = False
    report_method: str | None = None
    emergency_acknowledged: bool = False


class BreakdownDetail(BaseModel):
    kind: Literal[ServiceRequestKind.BREAKDOWN]
    breakdown_category: str
    symptoms: str | None = None
    vehicle_drivable: bool | None = None
    on_site_repair_requested: bool = False
    valet_requested: bool = False
    pickup_preference: str | None = None
    price_preference: str | None = None


class MaintenanceDetail(BaseModel):
    kind: Literal[ServiceRequestKind.MAINTENANCE]
    maintenance_category: str
    maintenance_detail: dict[str, object] | None = None
    maintenance_tier: str | None = None
    service_style_preference: str | None = None
    mileage_km: int | None = None
    valet_requested: bool = False
    pickup_preference: str | None = None
    price_preference: str | None = None


class TowingDetail(BaseModel):
    kind: Literal[ServiceRequestKind.TOWING]
    tow_mode: TowMode
    tow_stage: TowDispatchStage
    required_equipment: list[TowEquipment] | None = None
    incident_reason: TowIncidentReason | None = None
    scheduled_at: datetime | None = None
    pickup_label: str | None = None
    dropoff_label: str | None = None
    parent_case_id: UUID | None = None


KindDetailSection = AccidentDetail | BreakdownDetail | MaintenanceDetail | TowingDetail


class CaseAttachmentSummary(BaseModel):
    id: UUID
    kind: CaseAttachmentKind
    title: str
    subtitle: str | None = None
    status_label: str | None = None
    media_asset_id: UUID | None = None
    created_at: datetime | None = None


class CaseEvidenceSummary(BaseModel):
    id: UUID
    kind: CaseAttachmentKind
    title: str
    subtitle: str | None = None
    actor: str
    source_label: str
    status_label: str
    media_asset_id: UUID | None = None
    created_at: datetime | None = None


class CaseDocumentSummary(BaseModel):
    id: UUID
    kind: CaseAttachmentKind
    title: str
    subtitle: str | None = None
    source_label: str
    status_label: str
    media_asset_id: UUID | None = None
    created_at: datetime | None = None


class MatchSummary(BaseModel):
    id: UUID
    technician_profile_id: UUID | None = None
    technician_user_id: UUID | None = None
    display_name: str | None = None
    tagline: str | None = None
    provider_type: ProviderType | None = None
    area_label: str | None = None
    verified_level: TechnicianVerifiedLevel | None = None
    avatar_asset_id: UUID | None = None
    score: Decimal
    reason_label: str
    match_badge: str = "Bu vakaya uygun"
    visibility_state: CaseTechnicianMatchVisibility
    can_notify: bool = False
    notify_state: MatchNotifyState = MatchNotifyState.NOT_COMPATIBLE
    notify_disabled_reason: str | None = None


class NotificationSummary(BaseModel):
    id: UUID
    technician_user_id: UUID | None = None
    status: CaseTechnicianNotificationStatus
    created_at: datetime
    seen_at: datetime | None = None
    responded_at: datetime | None = None


class OfferSummary(BaseModel):
    id: UUID
    technician_user_id: UUID | None = None
    technician_display_label: str | None = None
    amount: Decimal | None = None
    currency: str
    status: CaseOfferStatus
    slot_proposal: dict[str, object] | None = None
    created_at: datetime


class AppointmentSummary(BaseModel):
    id: UUID
    status: AppointmentStatus
    slot: dict[str, object]
    slot_kind: AppointmentSlotKind
    source: AppointmentSource
    counter_proposal: dict[str, object] | None = None
    expires_at: datetime | None = None


class AssignmentSummary(BaseModel):
    technician_user_id: UUID
    technician_display_name: str
    accepted_offer_id: UUID | None = None
    assigned_at: datetime


class ApprovalSummary(BaseModel):
    id: UUID
    kind: CaseApprovalKind
    title: str
    description: str | None = None
    amount: Decimal | None = None
    currency: str
    status: CaseApprovalStatus
    payment_state: CaseApprovalPaymentState
    created_at: datetime


class PaymentSnapshot(BaseModel):
    billing_state: str | None = None
    estimate_amount: Decimal | None = None
    total_amount: Decimal | None = None
    preauth_held: Decimal | None = None
    captured: Decimal | None = None
    refunded: Decimal | None = None
    last_event_at: datetime | None = None


class TowSnapshot(BaseModel):
    tow_mode: TowMode
    tow_stage: TowDispatchStage
    scheduled_at: datetime | None = None
    pickup_label: str | None = None
    dropoff_label: str | None = None
    quote: dict[str, object] | None = None
    preauth_amount: Decimal | None = None
    captured_amount: Decimal | None = None


class CaseMilestoneSummary(BaseModel):
    id: UUID
    milestone_key: str
    title: str
    description: str | None = None
    actor: CaseActor
    status: CaseMilestoneStatus
    order: int


class CaseTaskSummary(BaseModel):
    id: UUID
    task_key: str
    kind: CaseTaskKind
    title: str
    description: str | None = None
    actor: CaseActor
    status: CaseTaskStatus
    urgency: CaseTaskUrgency
    cta_label: str
    helper_label: str | None = None
    milestone_key: str


class TimelineEventSummary(BaseModel):
    id: UUID
    event_type: CaseEventType
    title: str
    tone: CaseTone
    actor_user_id: UUID | None = None
    context_summary: str | None = None
    occurred_at: datetime


class ViewerContext(BaseModel):
    role: ViewerRole
    is_matched_to_me: bool = False
    match_reason_label: str | None = None
    match_badge: str | None = None
    is_notified_to_me: bool = False
    has_offer_from_me: bool = False
    can_send_offer: bool = False
    can_notify_to_me: bool = False
    other_match_count: int = 0
    competitor_offer_average: Decimal | None = None
    competitor_offer_count: int = 0


class CaseDossierResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    shell: CaseShellSection
    vehicle: VehicleSnapshotSection
    kind_detail: KindDetailSection = Field(discriminator="kind")
    attachments: list[CaseAttachmentSummary] = Field(default_factory=list)
    evidence: list[CaseEvidenceSummary] = Field(default_factory=list)
    documents: list[CaseDocumentSummary] = Field(default_factory=list)
    matches: list[MatchSummary] = Field(default_factory=list)
    notifications: list[NotificationSummary] = Field(default_factory=list)
    offers: list[OfferSummary] = Field(default_factory=list)
    appointment: AppointmentSummary | None = None
    assignment: AssignmentSummary | None = None
    approvals: list[ApprovalSummary] = Field(default_factory=list)
    payment_snapshot: PaymentSnapshot
    tow_snapshot: TowSnapshot | None = None
    milestones: list[CaseMilestoneSummary] = Field(default_factory=list)
    tasks: list[CaseTaskSummary] = Field(default_factory=list)
    timeline_summary: list[TimelineEventSummary] = Field(default_factory=list)
    viewer: ViewerContext
