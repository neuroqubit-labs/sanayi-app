"""Review model (Faz A PR 8) — müşteri vaka bitişi sonrası usta puanlaması.

Brief §10.1:
- UNIQUE (case_id, reviewer_user_id) — 1 vaka × 1 reviewer = max 1 review
- rating: 1-5 SMALLINT (CHECK constraint DB-enforce)
- response_body + responded_at V2 (teknisyen yanıtı — şimdilik endpoint yok)

Rating bayesian aggregate `TechnicianPerformanceSnapshot.rating_bayesian`'ın
kaynağı; ARQ cron Faz 14'te window bazlı (30/90/all-time) smoothing uygular.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPkMixin


class Review(UUIDPkMixin, Base):
    """Vaka tamamlandıktan sonra müşteri → usta puanlaması."""

    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint(
            "rating BETWEEN 1 AND 5",
            name="ck_reviews_rating_range",
        ),
        UniqueConstraint(
            "case_id",
            "reviewer_user_id",
            name="uq_reviews_case_reviewer",
        ),
        Index(
            "ix_reviews_reviewee_created",
            "reviewee_user_id",
            "created_at",
        ),
        Index("ix_reviews_reviewer", "reviewer_user_id"),
    )

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="RESTRICT"), nullable=False
    )
    reviewer_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    reviewee_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    response_body: Mapped[str | None] = mapped_column(Text)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )
