"""Pydantic DTOs for insurance_claim domain (Faz 8).

Mobil kaynak: [packages/domain/src/service-case.ts::InsuranceClaimSchema](packages/domain/src/service-case.ts)
+ [naro-service-app features/insurance-claim/types.ts::ClaimDraft](naro-service-app/src/features/insurance-claim/types.ts).

Karar [K1]: drafted state backend'de yok; submit endpoint'i direkt `submitted` kayıt yaratır.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.insurance_claim import (
    InsuranceClaimStatus,
    InsuranceCoverageKind,
)

# ─── Submit (yeni dosya açma) ──────────────────────────────────────────────


class InsuranceClaimSubmit(BaseModel):
    """Mobil draft → backend submit. Draft state backend'de yok; bu payload
    direkt `status='submitted'` olarak insert edilir."""

    model_config = ConfigDict(extra="forbid")

    case_id: UUID
    policy_number: str = Field(min_length=1, max_length=64)
    insurer: str = Field(min_length=1, max_length=255)
    coverage_kind: InsuranceCoverageKind
    estimate_amount: Decimal | None = Field(default=None, ge=0)
    policy_holder_name: str | None = Field(default=None, max_length=255)
    policy_holder_phone: str | None = Field(default=None, max_length=32)
    currency: str = Field(default="TRY", min_length=1, max_length=8)
    notes: str | None = None
    insurer_claim_reference: str | None = Field(default=None, max_length=128)


# ─── Status transition requests ────────────────────────────────────────────


class InsuranceClaimAcceptRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    accepted_amount: Decimal = Field(ge=0)
    insurer_claim_reference: str | None = Field(default=None, max_length=128)


class InsuranceClaimRejectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=1, max_length=1000)


class InsuranceClaimPayOutRequest(BaseModel):
    """Ödeme gerçekleşti. paid_amount verilmezse accepted_amount kullanılır."""

    model_config = ConfigDict(extra="forbid")

    paid_amount: Decimal | None = Field(default=None, ge=0)


# ─── Response ──────────────────────────────────────────────────────────────


class InsuranceClaimResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    case_id: UUID
    policy_number: str
    insurer: str
    coverage_kind: InsuranceCoverageKind
    insurer_claim_reference: str | None
    status: InsuranceClaimStatus

    estimate_amount: Decimal | None
    accepted_amount: Decimal | None
    paid_amount: Decimal | None
    currency: str

    policy_holder_name: str | None
    policy_holder_phone: str | None

    submitted_at: datetime
    accepted_at: datetime | None
    paid_at: datetime | None
    rejected_at: datetime | None
    rejection_reason: str | None

    created_by_user_id: UUID | None
    created_by_snapshot_name: str | None
    notes: str | None

    created_at: datetime
    updated_at: datetime
