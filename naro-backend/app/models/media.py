from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, Integer, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin
from app.db.enums import pg_enum


class MediaPurpose(StrEnum):
    # Legacy (kept for backward compat; canonicalize() alias'lar yönlendirir)
    CASE_ATTACHMENT = "case_attachment"
    TECHNICIAN_CERTIFICATE = "technician_certificate"
    TECHNICIAN_GALLERY = "technician_gallery"
    TECHNICIAN_PROMO = "technician_promo"
    USER_AVATAR = "user_avatar"
    # Faz 11 — canonical 18-purpose master taksonomi
    VEHICLE_LICENSE_PHOTO = "vehicle_license_photo"
    VEHICLE_PHOTO = "vehicle_photo"
    CASE_DAMAGE_PHOTO = "case_damage_photo"
    CASE_EVIDENCE_PHOTO = "case_evidence_photo"
    CASE_EVIDENCE_VIDEO = "case_evidence_video"
    CASE_EVIDENCE_AUDIO = "case_evidence_audio"
    ACCIDENT_PROOF = "accident_proof"
    INSURANCE_DOC = "insurance_doc"
    TECHNICIAN_AVATAR = "technician_avatar"
    TECHNICIAN_GALLERY_PHOTO = "technician_gallery_photo"
    TECHNICIAN_GALLERY_VIDEO = "technician_gallery_video"
    TECHNICIAN_PROMO_VIDEO = "technician_promo_video"
    TOW_ARRIVAL_PHOTO = "tow_arrival_photo"
    TOW_LOADING_PHOTO = "tow_loading_photo"
    TOW_DELIVERY_PHOTO = "tow_delivery_photo"
    CAMPAIGN_ASSET = "campaign_asset"


class MediaVisibility(StrEnum):
    PUBLIC = "public"
    PRIVATE = "private"


class MediaStatus(StrEnum):
    PENDING_UPLOAD = "pending_upload"
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"
    DELETED = "deleted"
    QUARANTINED = "quarantined"


class OwnerKind(StrEnum):
    """Polymorphic owner kind — FK yok, service layer validate."""

    USER = "user"
    VEHICLE = "vehicle"
    SERVICE_CASE = "service_case"
    TECHNICIAN_PROFILE = "technician_profile"
    TECHNICIAN_CERTIFICATE = "technician_certificate"
    INSURANCE_CLAIM = "insurance_claim"
    CAMPAIGN = "campaign"


class AntivirusVerdict(StrEnum):
    CLEAN = "clean"
    INFECTED = "infected"
    SKIPPED = "skipped"


class MediaAsset(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "media_assets"
    __table_args__ = (
        Index(
            "ix_media_assets_pending_old",
            "created_at",
            postgresql_where="status = 'pending_upload'",
        ),
        Index(
            "ix_media_assets_owner_active",
            "owner_kind",
            "owner_id",
            postgresql_where="deleted_at IS NULL AND status IN ('ready', 'uploaded')",
        ),
    )

    upload_id: Mapped[UUID] = mapped_column(default=uuid4, unique=True, nullable=False, index=True)
    purpose: Mapped[MediaPurpose] = mapped_column(
        pg_enum(MediaPurpose, name="media_purpose"),
        nullable=False,
    )
    visibility: Mapped[MediaVisibility] = mapped_column(
        pg_enum(MediaVisibility, name="media_visibility"),
        nullable=False,
    )
    status: Mapped[MediaStatus] = mapped_column(
        pg_enum(MediaStatus, name="media_status"),
        nullable=False,
        default=MediaStatus.PENDING_UPLOAD,
    )
    owner_ref: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    # Faz 11 — polymorphic ownership (owner_ref korunur backward compat)
    owner_kind: Mapped[str | None] = mapped_column(String(32))
    owner_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True))
    bucket_name: Mapped[str] = mapped_column(String(255), nullable=False)
    object_key: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    preview_object_key: Mapped[str | None] = mapped_column(Text)
    thumb_object_key: Mapped[str | None] = mapped_column(Text)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(255), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    checksum_sha256: Mapped[str | None] = mapped_column(String(128))
    etag: Mapped[str | None] = mapped_column(String(255))
    dimensions_json: Mapped[dict[str, int] | None] = mapped_column(JSONB)
    duration_sec: Mapped[int | None] = mapped_column(SmallInteger)
    exif_stripped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    antivirus_scanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    antivirus_verdict: Mapped[str | None] = mapped_column(String(16))
    uploaded_by_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Faz 12 — case bind (owner_id'den farklı: owner semantic; linked = reuse guard)
    linked_case_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("service_cases.id", ondelete="SET NULL"), nullable=True
    )
    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
