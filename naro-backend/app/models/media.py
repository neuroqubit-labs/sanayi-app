from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin


class MediaPurpose(StrEnum):
    CASE_ATTACHMENT = "case_attachment"
    TECHNICIAN_CERTIFICATE = "technician_certificate"
    TECHNICIAN_GALLERY = "technician_gallery"
    TECHNICIAN_PROMO = "technician_promo"
    USER_AVATAR = "user_avatar"


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


class MediaAsset(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "media_assets"

    upload_id: Mapped[UUID] = mapped_column(default=uuid4, unique=True, nullable=False, index=True)
    purpose: Mapped[MediaPurpose] = mapped_column(
        SAEnum(MediaPurpose, name="media_purpose"),
        nullable=False,
    )
    visibility: Mapped[MediaVisibility] = mapped_column(
        SAEnum(MediaVisibility, name="media_visibility"),
        nullable=False,
    )
    status: Mapped[MediaStatus] = mapped_column(
        SAEnum(MediaStatus, name="media_status"),
        nullable=False,
        default=MediaStatus.PENDING_UPLOAD,
    )
    owner_ref: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    bucket_name: Mapped[str] = mapped_column(String(255), nullable=False)
    object_key: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    preview_object_key: Mapped[str | None] = mapped_column(Text)
    thumb_object_key: Mapped[str | None] = mapped_column(Text)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(255), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    checksum_sha256: Mapped[str | None] = mapped_column(String(128))
    etag: Mapped[str | None] = mapped_column(String(255))
    uploaded_by_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
