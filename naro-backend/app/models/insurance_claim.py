"""Insurance claim (Faz 8) — sigorta hasar dosyası.

Karar [K1]: taslak (drafted) backend'de yok; mobil client-side persist.
Karar [K2]: submit edildikten sonra düzenleme yok — taahhüt.
Karar [K3]: reject sonrası yeni kayıt açılabilir; eski dondurulmuş kalır.
         Partial unique: aktif claim (submitted/accepted/paid) case başına 1.
Karar [K4]: status enum 4 değer (drafted kaldırıldı).

1:1 service_cases (aktif kapsamında). Status state machine + event emission
service katmanında ([insurance_claim_flow.py](app/services/insurance_claim_flow.py)).
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin
from app.db.enums import pg_enum


class InsuranceCoverageKind(StrEnum):
    KASKO = "kasko"
    TRAFIK = "trafik"


class InsuranceClaimStatus(StrEnum):
    SUBMITTED = "submitted"
    ACCEPTED = "accepted"
    PAID = "paid"
    REJECTED = "rejected"


ACTIVE_CLAIM_STATUSES: frozenset[InsuranceClaimStatus] = frozenset(
    {
        InsuranceClaimStatus.SUBMITTED,
        InsuranceClaimStatus.ACCEPTED,
        InsuranceClaimStatus.PAID,
    }
)

TERMINAL_CLAIM_STATUSES: frozenset[InsuranceClaimStatus] = frozenset(
    {InsuranceClaimStatus.PAID, InsuranceClaimStatus.REJECTED}
)


class InsuranceClaim(UUIDPkMixin, TimestampMixin, Base):
    """Sigorta hasar dosyası — aktif kapsamında 1:1 service_cases."""

    __tablename__ = "insurance_claims"
    __table_args__ = (
        CheckConstraint(
            "estimate_amount IS NULL OR estimate_amount >= 0",
            name="ck_insurance_claims_estimate_nonneg",
        ),
        CheckConstraint(
            "accepted_amount IS NULL OR accepted_amount >= 0",
            name="ck_insurance_claims_accepted_nonneg",
        ),
        CheckConstraint(
            "paid_amount IS NULL OR paid_amount >= 0",
            name="ck_insurance_claims_paid_nonneg",
        ),
        # Karar [K3]: aktif claim (submitted/accepted/paid) case başına 1
        Index(
            "uq_active_insurance_claim_per_case",
            "case_id",
            unique=True,
            postgresql_where=(
                "status IN ('submitted','accepted','paid')"
            ),
        ),
    )

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"), nullable=False
    )

    # Poliçe + sigortacı
    policy_number: Mapped[str] = mapped_column(String(64), nullable=False)
    insurer: Mapped[str] = mapped_column(String(255), nullable=False)
    coverage_kind: Mapped[InsuranceCoverageKind] = mapped_column(
        pg_enum(InsuranceCoverageKind, name="insurance_coverage_kind"),
        nullable=False,
    )
    # Sigortacının kendi dosya referansı (submit sonrası gelir)
    insurer_claim_reference: Mapped[str | None] = mapped_column(String(128))

    # Status state machine
    status: Mapped[InsuranceClaimStatus] = mapped_column(
        pg_enum(InsuranceClaimStatus, name="insurance_claim_status"),
        nullable=False,
        default=InsuranceClaimStatus.SUBMITTED,
    )

    # 3 aşamalı tutar: tahmin → onay → ödeme
    estimate_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    accepted_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    paid_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(
        String(8), nullable=False, default="TRY", server_default="TRY"
    )

    # Poliçe sahibi (aile aracı: müşteri ≠ sigortalı olabilir)
    policy_holder_name: Mapped[str | None] = mapped_column(String(255))
    policy_holder_phone: Mapped[str | None] = mapped_column(String(32))

    # Timeline (audit için)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[str | None] = mapped_column(Text)

    # Kim açtı (genelde usta origin='technician' vakada)
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_by_snapshot_name: Mapped[str | None] = mapped_column(String(255))

    notes: Mapped[str | None] = mapped_column(Text)
