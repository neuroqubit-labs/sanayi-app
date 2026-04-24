"""Public case showcase — iki taraf onaylı, PII-safe vaka vitrini.

Bu tablo public profil için kaynak olur; UI tarafı PII filtrelemeye güvenmez.
Snapshot alanı sadece backend helper'ın whitelisted özetini taşır.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin
from app.db.enums import pg_enum
from app.models.case import ServiceRequestKind


class CasePublicShowcaseStatus(StrEnum):
    PENDING_CUSTOMER = "pending_customer"
    PENDING_TECHNICIAN = "pending_technician"
    PUBLISHED = "published"
    REVOKED = "revoked"
    HIDDEN = "hidden"


class CasePublicShowcase(UUIDPkMixin, TimestampMixin, Base):
    """Tamamlanan vakanın public usta profilindeki doğrulanmış iş özeti."""

    __tablename__ = "case_public_showcases"
    __table_args__ = (
        UniqueConstraint("case_id", name="uq_case_public_showcases_case"),
        Index(
            "ix_case_public_showcases_profile_status",
            "technician_profile_id",
            "status",
            "published_at",
        ),
        Index("ix_case_public_showcases_customer", "customer_user_id"),
    )

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"), nullable=False
    )
    technician_profile_id: Mapped[UUID] = mapped_column(
        ForeignKey("technician_profiles.id", ondelete="CASCADE"), nullable=False
    )
    technician_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    customer_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    review_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("reviews.id", ondelete="SET NULL"), nullable=True
    )
    kind: Mapped[ServiceRequestKind] = mapped_column(
        pg_enum(ServiceRequestKind, name="service_request_kind", create_type=False),
        nullable=False,
    )
    status: Mapped[CasePublicShowcaseStatus] = mapped_column(
        pg_enum(
            CasePublicShowcaseStatus,
            name="case_public_showcase_status",
        ),
        nullable=False,
        default=CasePublicShowcaseStatus.PENDING_CUSTOMER,
        server_default=CasePublicShowcaseStatus.PENDING_CUSTOMER.value,
    )
    public_snapshot: Mapped[dict[str, object]] = mapped_column(
        JSONB, nullable=False, server_default="{}"
    )
    technician_consented_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    customer_consented_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    technician_revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    customer_revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    hidden_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CasePublicShowcaseMedia(UUIDPkMixin, TimestampMixin, Base):
    """Showcase'a seçilmiş public-safe süreç medyası."""

    __tablename__ = "case_public_showcase_media"
    __table_args__ = (
        CheckConstraint("sequence >= 0", name="ck_case_public_showcase_media_seq"),
        CheckConstraint(
            "kind IN ('photo','video')",
            name="ck_case_public_showcase_media_kind",
        ),
        Index(
            "ix_case_public_showcase_media_showcase_seq",
            "showcase_id",
            "sequence",
        ),
    )

    showcase_id: Mapped[UUID] = mapped_column(
        ForeignKey("case_public_showcases.id", ondelete="CASCADE"),
        nullable=False,
    )
    media_asset_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )
    evidence_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("case_evidence_items.id", ondelete="SET NULL"), nullable=True
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255))
    caption: Mapped[str | None] = mapped_column(Text)
    sequence: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
