"""Admin router DTOs (Faz A PR 9).

Request shapes (approve/reject/suspend/override) + list response item'ları
(technician pending, cert pending, audit log item).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.auth_event import AuthEventType
from app.models.case import ServiceCaseStatus
from app.models.technician import (
    ProviderType,
    TechnicianCertificateKind,
    TechnicianCertificateStatus,
    TechnicianVerifiedLevel,
)
from app.models.user import UserApprovalStatus, UserStatus

# ─── Technician approval ──────────────────────────────────────────────────


class TechnicianApproveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    note: str | None = Field(default=None, max_length=1000)


class TechnicianRejectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=1, max_length=1000)


class TechnicianSuspendRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=1, max_length=1000)
    until: datetime | None = None


# ─── Certificate review ──────────────────────────────────────────────────


class CertificateRejectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reviewer_note: str = Field(min_length=1, max_length=1000)


# ─── Case override ────────────────────────────────────────────────────────


class CaseOverrideRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    new_status: ServiceCaseStatus
    reason: str = Field(min_length=1, max_length=1000)


# ─── User suspension ─────────────────────────────────────────────────────


class UserSuspendRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=1, max_length=1000)
    until: datetime | None = None


# ─── List response items ──────────────────────────────────────────────────


class TechnicianPendingItem(BaseModel):
    """Admin list view — PII görünür (admin zaten KYC doğrulama yapıyor)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str | None
    email: str | None
    phone: str | None
    approval_status: UserApprovalStatus | None
    provider_type: ProviderType | None = None
    verified_level: TechnicianVerifiedLevel | None = None
    created_at: datetime


class CertificatePendingItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    profile_id: UUID
    kind: TechnicianCertificateKind
    title: str
    status: TechnicianCertificateStatus
    uploaded_at: datetime
    expires_at: datetime | None
    reviewer_note: str | None


class AdminAuditItem(BaseModel):
    """AuthEvent projection — admin action log."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    admin_user_id: UUID | None = Field(
        default=None, description="AuthEvent.user_id (admin olanın kendisi)"
    )
    event_type: AuthEventType
    target: str | None
    context: dict[str, Any]
    created_at: datetime


# ─── Simple updated user/case response ────────────────────────────────────


class UserAdminView(BaseModel):
    """User mutation sonrası response (admin görünüm)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str | None
    email: str | None
    phone: str | None
    status: UserStatus
    approval_status: UserApprovalStatus | None
    role: str
    created_at: datetime
    updated_at: datetime
