"""Pydantic DTOs for technician domain — in/out separation.

Response modelleri `from_attributes=True` ile SQLAlchemy row'dan direkt türer.
Request modelleri `extra='forbid'` ile client tarafı tiplerini sıkı tutar.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.technician import (
    GalleryItemKind,
    ProviderType,
    TechnicianAvailability,
    TechnicianCertificateKind,
    TechnicianCertificateStatus,
    TechnicianSpecialtyKind,
    TechnicianVerifiedLevel,
)

# ─── BusinessInfo (JSONB schema) ────────────────────────────────────────────


class BusinessInfo(BaseModel):
    model_config = ConfigDict(extra="allow")

    legal_name: str | None = None
    tax_number: str | None = None
    address: str | None = None
    city_district: str | None = None
    iban: str | None = None
    phone: str | None = None
    email: str | None = None


# ─── Profile ────────────────────────────────────────────────────────────────


class TechnicianProfileCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: UUID
    display_name: str = Field(min_length=1, max_length=255)
    provider_type: ProviderType
    secondary_provider_types: list[ProviderType] = Field(default_factory=list)
    tagline: str | None = Field(default=None, max_length=255)
    biography: str | None = None
    working_hours: str | None = Field(default=None, max_length=255)
    area_label: str | None = Field(default=None, max_length=255)
    business_info: BusinessInfo = Field(default_factory=BusinessInfo)
    avatar_asset_id: UUID | None = None
    promo_video_asset_id: UUID | None = None


class TechnicianProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str | None = Field(default=None, min_length=1, max_length=255)
    tagline: str | None = Field(default=None, max_length=255)
    biography: str | None = None
    provider_type: ProviderType | None = None
    secondary_provider_types: list[ProviderType] | None = None
    working_hours: str | None = Field(default=None, max_length=255)
    area_label: str | None = Field(default=None, max_length=255)
    business_info: BusinessInfo | None = None
    avatar_asset_id: UUID | None = None
    promo_video_asset_id: UUID | None = None


class TechnicianCapabilityUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    insurance_case_handler: bool | None = None
    on_site_repair: bool | None = None
    valet_service: bool | None = None
    towing_coordination: bool | None = None


class TechnicianCapabilityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    insurance_case_handler: bool
    on_site_repair: bool
    valet_service: bool
    towing_coordination: bool
    updated_at: datetime


class TechnicianProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    display_name: str
    tagline: str | None
    biography: str | None
    availability: TechnicianAvailability
    verified_level: TechnicianVerifiedLevel
    provider_type: ProviderType
    secondary_provider_types: list[ProviderType]
    working_hours: str | None
    area_label: str | None
    business_info: dict[str, object]
    avatar_asset_id: UUID | None
    promo_video_asset_id: UUID | None
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime


# ─── Specialty ──────────────────────────────────────────────────────────────


class TechnicianSpecialtyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: TechnicianSpecialtyKind
    label: str
    label_normalized: str
    display_order: int
    created_at: datetime


class SetSpecialtiesRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: TechnicianSpecialtyKind
    labels: list[str] = Field(default_factory=list)


# ─── Certificate ────────────────────────────────────────────────────────────


class TechnicianCertificateCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: TechnicianCertificateKind
    title: str = Field(min_length=1, max_length=255)
    file_url: str | None = None
    mime_type: str | None = Field(default=None, max_length=128)
    media_asset_id: UUID | None = None
    expires_at: datetime | None = None


class TechnicianCertificateStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: TechnicianCertificateStatus
    reviewer_note: str | None = None


class TechnicianCertificateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: TechnicianCertificateKind
    title: str
    file_url: str | None
    mime_type: str | None
    media_asset_id: UUID | None
    uploaded_at: datetime
    verified_at: datetime | None
    expires_at: datetime | None
    status: TechnicianCertificateStatus
    reviewer_note: str | None
    created_at: datetime
    updated_at: datetime


# ─── Gallery ────────────────────────────────────────────────────────────────


class TechnicianGalleryItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: GalleryItemKind
    media_asset_id: UUID
    title: str | None = Field(default=None, max_length=255)
    caption: str | None = Field(default=None, max_length=255)
    display_order: int = 0


class TechnicianGalleryItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: GalleryItemKind
    title: str | None
    caption: str | None
    media_asset_id: UUID
    display_order: int
    created_at: datetime


class GalleryReorderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item_orders: list[tuple[UUID, int]]


# ─── Availability toggle ────────────────────────────────────────────────────


class AvailabilityUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    availability: TechnicianAvailability
