"""Pure tests — public case showcase contract.

DB-bağımsız: model/table names, PII-safe snapshot ve schema alanları.
"""

from __future__ import annotations

from uuid import uuid4

from app.models.case import ServiceRequestKind
from app.models.case_public_showcase import (
    CasePublicShowcase,
    CasePublicShowcaseMedia,
    CasePublicShowcaseStatus,
)
from app.schemas.technician_public import (
    PublicCaseShowcasePreview,
    TechnicianPublicView,
)


def test_showcase_model_table_names() -> None:
    assert CasePublicShowcase.__tablename__ == "case_public_showcases"
    assert CasePublicShowcaseMedia.__tablename__ == "case_public_showcase_media"


def test_showcase_status_values() -> None:
    assert CasePublicShowcaseStatus.PENDING_CUSTOMER.value == "pending_customer"
    assert CasePublicShowcaseStatus.PUBLISHED.value == "published"
    assert CasePublicShowcaseStatus.REVOKED.value == "revoked"


def test_public_profile_has_case_showcases() -> None:
    assert "case_showcases" in TechnicianPublicView.model_fields


def test_public_showcase_preview_no_pii_fields() -> None:
    fields = set(PublicCaseShowcasePreview.model_fields.keys())
    forbidden = {
        "customer_user_id",
        "technician_user_id",
        "plate",
        "vin",
        "phone",
        "email",
        "amount",
        "total_amount",
        "exact_km",
    }
    assert not (fields & forbidden)


def test_public_showcase_preview_construct() -> None:
    item = PublicCaseShowcasePreview(
        id=uuid4(),
        kind=ServiceRequestKind.MAINTENANCE,
        kind_label="Bakım işlemi",
        title="Bakım işlemi",
        summary="Periyodik bakım tamamlandı.",
        month_label="Nisan 2026",
        location_label="Kadıköy, İstanbul",
        rating=5,
        review_body="Temiz çalışıldı.",
    )
    assert item.kind == ServiceRequestKind.MAINTENANCE
    assert item.rating == 5
