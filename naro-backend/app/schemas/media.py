from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.media import MediaPurpose, MediaStatus, MediaVisibility, OwnerKind


class MediaAssetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    purpose: MediaPurpose
    visibility: MediaVisibility
    status: MediaStatus
    mime_type: str
    size_bytes: int
    checksum_sha256: str | None = None
    preview_url: str | None = None
    download_url: str | None = None
    dimensions: dict[str, int] | None = None
    duration_sec: int | None = None
    exif_stripped_at: datetime | None = None
    antivirus_verdict: str | None = None
    created_at: datetime
    uploaded_at: datetime | None = None


class UploadIntentRequest(BaseModel):
    purpose: MediaPurpose
    owner_ref: str = Field(min_length=1, max_length=255)
    # Faz 11 — polymorphic owner (owner_ref kept for backward compat)
    owner_kind: OwnerKind | None = None
    owner_id: UUID | None = None
    filename: str = Field(min_length=1, max_length=255)
    mime_type: str = Field(min_length=1, max_length=255)
    size_bytes: int = Field(gt=0)
    checksum_sha256: str | None = Field(default=None, min_length=32, max_length=128)
    dimensions: dict[str, int] | None = None
    duration_sec: int | None = Field(default=None, ge=0, le=3600)

    @field_validator("purpose", mode="before")
    @classmethod
    def normalize_purpose_alias(cls, value: object) -> object:
        if value == "technician_cert":
            return MediaPurpose.TECHNICIAN_CERTIFICATE
        return value


class UploadIntentResponse(BaseModel):
    upload_id: str
    asset_id: str
    object_key: str
    upload_method: Literal["single_put"]
    upload_url: str
    upload_headers: dict[str, str]
    expires_at: datetime


class CompleteUploadRequest(BaseModel):
    etag: str | None = None
    checksum_sha256: str | None = Field(default=None, min_length=32, max_length=128)


class MediaAssetEnvelope(BaseModel):
    asset: MediaAssetResponse
