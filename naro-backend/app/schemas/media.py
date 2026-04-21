from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.media import MediaPurpose, MediaStatus, MediaVisibility


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
    created_at: datetime
    uploaded_at: datetime | None = None


class UploadIntentRequest(BaseModel):
    purpose: MediaPurpose
    owner_ref: str = Field(min_length=1, max_length=255)
    filename: str = Field(min_length=1, max_length=255)
    mime_type: str = Field(min_length=1, max_length=255)
    size_bytes: int = Field(gt=0)
    checksum_sha256: str | None = Field(default=None, min_length=32, max_length=128)


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
