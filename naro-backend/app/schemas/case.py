"""Pydantic DTOs for service_case domain."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.case import (
    CaseOrigin,
    CaseWaitActor,
    ServiceCaseStatus,
    ServiceRequestKind,
    ServiceRequestUrgency,
)
from app.schemas.service_request import ServiceRequestDraftCreate


class ServiceCaseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vehicle_id: UUID
    customer_user_id: UUID
    kind: ServiceRequestKind
    urgency: ServiceRequestUrgency = ServiceRequestUrgency.PLANNED
    origin: CaseOrigin = CaseOrigin.CUSTOMER
    title: str = Field(min_length=1, max_length=255)
    subtitle: str | None = Field(default=None, max_length=255)
    summary: str | None = None
    location_label: str | None = Field(default=None, max_length=255)
    preferred_technician_id: UUID | None = None
    workflow_blueprint: str = Field(min_length=1, max_length=64)
    request_draft: ServiceRequestDraftCreate
    estimate_amount: Decimal | None = None


class ServiceCaseUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=255)
    subtitle: str | None = Field(default=None, max_length=255)
    summary: str | None = None
    location_label: str | None = Field(default=None, max_length=255)
    urgency: ServiceRequestUrgency | None = None
    preferred_technician_id: UUID | None = None
    total_amount: Decimal | None = None
    estimate_amount: Decimal | None = None


class ServiceCaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    vehicle_id: UUID
    customer_user_id: UUID
    kind: ServiceRequestKind
    urgency: ServiceRequestUrgency
    status: ServiceCaseStatus
    origin: CaseOrigin
    title: str
    subtitle: str | None
    summary: str | None
    location_label: str | None
    preferred_technician_id: UUID | None
    assigned_technician_id: UUID | None
    workflow_blueprint: str
    request_draft: dict[str, object]
    wait_state_actor: CaseWaitActor
    wait_state_label: str | None
    wait_state_description: str | None
    last_seen_by_customer: datetime | None
    last_seen_by_technician: datetime | None
    total_amount: Decimal | None
    estimate_amount: Decimal | None
    closed_at: datetime | None
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime


class StatusTransitionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    new_status: ServiceCaseStatus
    actor_user_id: UUID


class WaitStateUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    actor: CaseWaitActor
    label: str | None = Field(default=None, max_length=255)
    description: str | None = None


class AssignTechnicianRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    technician_user_id: UUID
