"""Technician domain models — profile, capabilities, specialties, certificates, gallery.

Profile is 1:1 with `users` (role='technician'). KYC zinciri `technician_certificates`
üzerinden yürür; admin approve → `verified_level` recompute (service katmanı).
Pool visibility için `provider_type` + `secondary_provider_types` + `availability`
kombinasyonu kullanılır (Faz 4 KIND_PROVIDER_MAP'e köprü).
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from geoalchemy2 import Geography
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin
from app.db.enums import pg_enum

# ─── Enums ──────────────────────────────────────────────────────────────────


class ProviderType(StrEnum):
    USTA = "usta"
    CEKICI = "cekici"
    OTO_AKSESUAR = "oto_aksesuar"
    KAPORTA_BOYA = "kaporta_boya"
    LASTIK = "lastik"
    OTO_ELEKTRIK = "oto_elektrik"


class TechnicianVerifiedLevel(StrEnum):
    BASIC = "basic"
    VERIFIED = "verified"
    PREMIUM = "premium"


class TechnicianAvailability(StrEnum):
    AVAILABLE = "available"
    BUSY = "busy"
    OFFLINE = "offline"


class TechnicianCertificateKind(StrEnum):
    IDENTITY = "identity"
    TAX_REGISTRATION = "tax_registration"
    TRADE_REGISTRY = "trade_registry"
    INSURANCE = "insurance"
    TECHNICAL = "technical"
    VEHICLE_LICENSE = "vehicle_license"


class TechnicianCertificateStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class GalleryItemKind(StrEnum):
    PHOTO = "photo"
    VIDEO = "video"


class TechnicianSpecialtyKind(StrEnum):
    """Uygulama tarafında; DB'de CHECK constraint ile enforce edilir."""

    SPECIALTY = "specialty"
    EXPERTISE = "expertise"


# ─── Tables ─────────────────────────────────────────────────────────────────


class TechnicianProfile(UUIDPkMixin, TimestampMixin, Base):
    """Teknisyen markası + operasyon profili. 1:1 users."""

    __tablename__ = "technician_profiles"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    tagline: Mapped[str | None] = mapped_column(String(255))
    biography: Mapped[str | None] = mapped_column(Text)

    availability: Mapped[TechnicianAvailability] = mapped_column(
        pg_enum(TechnicianAvailability, name="technician_availability"),
        nullable=False,
        default=TechnicianAvailability.OFFLINE,
    )
    verified_level: Mapped[TechnicianVerifiedLevel] = mapped_column(
        pg_enum(TechnicianVerifiedLevel, name="technician_verified_level"),
        nullable=False,
        default=TechnicianVerifiedLevel.BASIC,
    )

    provider_type: Mapped[ProviderType] = mapped_column(
        pg_enum(ProviderType, name="provider_type"),
        nullable=False,
    )
    secondary_provider_types: Mapped[list[ProviderType]] = mapped_column(
        ARRAY(pg_enum(ProviderType, name="provider_type", create_type=False)),
        nullable=False,
        server_default="{}",
    )

    working_hours: Mapped[str | None] = mapped_column(String(255))
    area_label: Mapped[str | None] = mapped_column(String(255))
    business_info: Mapped[dict[str, object]] = mapped_column(
        JSONB, nullable=False, server_default="{}"
    )

    avatar_asset_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    promo_video_asset_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL"),
        nullable=True,
    )

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Faz 10 — tow dispatch alanları
    last_known_location_lat: Mapped[float | None] = mapped_column(Float)
    last_known_location_lng: Mapped[float | None] = mapped_column(Float)
    last_known_location: Mapped[str | None] = mapped_column(
        Geography(geometry_type="POINT", srid=4326),
        nullable=True,
    )
    last_location_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    current_offer_case_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("service_cases.id", ondelete="SET NULL"), nullable=True
    )
    current_offer_issued_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    evidence_discipline_score: Mapped[Decimal] = mapped_column(
        Numeric(3, 2), nullable=False, server_default="1.00", default=Decimal("1.00")
    )


class TechnicianCapability(Base):
    """4 boolean flag — 1:1 technician_profiles."""

    __tablename__ = "technician_capabilities"

    profile_id: Mapped[UUID] = mapped_column(
        ForeignKey("technician_profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    insurance_case_handler: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    on_site_repair: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    valet_service: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    towing_coordination: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default="now()",
        onupdate=lambda: datetime.now(),
        nullable=False,
    )


class TechnicianSpecialty(UUIDPkMixin, Base):
    """Specialty (marka) + expertise (alan) tek tablo, kind ile ayrım."""

    __tablename__ = "technician_specialties"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('specialty','expertise')",
            name="ck_tech_specialties_kind",
        ),
    )

    profile_id: Mapped[UUID] = mapped_column(
        ForeignKey("technician_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    label_normalized: Mapped[str] = mapped_column(String(120), nullable=False)
    display_order: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )


class TechnicianCertificate(UUIDPkMixin, TimestampMixin, Base):
    """KYC belgesi — admin onay zinciriyle ilerler."""

    __tablename__ = "technician_certificates"

    profile_id: Mapped[UUID] = mapped_column(
        ForeignKey("technician_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    kind: Mapped[TechnicianCertificateKind] = mapped_column(
        pg_enum(TechnicianCertificateKind, name="technician_certificate_kind"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    file_url: Mapped[str | None] = mapped_column(Text)
    mime_type: Mapped[str | None] = mapped_column(String(128))
    media_asset_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[TechnicianCertificateStatus] = mapped_column(
        pg_enum(TechnicianCertificateStatus, name="technician_certificate_status"),
        nullable=False,
        default=TechnicianCertificateStatus.PENDING,
    )
    reviewer_note: Mapped[str | None] = mapped_column(Text)


class TechnicianGalleryItem(UUIDPkMixin, Base):
    """Öne çıkan iş (fotoğraf/video); display_order ile sıralanır."""

    __tablename__ = "technician_gallery_items"

    profile_id: Mapped[UUID] = mapped_column(
        ForeignKey("technician_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    kind: Mapped[GalleryItemKind] = mapped_column(
        pg_enum(GalleryItemKind, name="gallery_item_kind"),
        nullable=False,
    )
    title: Mapped[str | None] = mapped_column(String(255))
    caption: Mapped[str | None] = mapped_column(String(255))
    media_asset_id: Mapped[UUID] = mapped_column(
        ForeignKey("media_assets.id", ondelete="CASCADE"),
        nullable=False,
    )
    display_order: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )


class TechnicianTowEquipmentLink(Base):
    """N:M — teknisyenin sahip olduğu çekici ekipmanları."""

    __tablename__ = "technician_tow_equipment"

    profile_id: Mapped[UUID] = mapped_column(
        ForeignKey("technician_profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    equipment: Mapped[str] = mapped_column(
        pg_enum(
            "flatbed", "hook", "wheel_lift", "heavy_duty", "motorcycle",
            name="tow_equipment", create_type=False,
        ),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )
