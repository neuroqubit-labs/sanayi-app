"""PR 8 pure tests — /pool + /reviews schema + PII mask + state machine.

DB-bağımsız: schema, mask helper, migration pointer, model alan kontratı.
Integration testler (create + unique) ayrı job'a; burada pure.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from app.models.case import ServiceCaseStatus, ServiceRequestKind, ServiceRequestUrgency
from app.models.review import Review
from app.schemas.pool import PoolCaseDetail, PoolCaseItem
from app.schemas.review import (
    ReviewCreate,
    ReviewResponse,
    TechnicianReviewItem,
    mask_reviewer_name,
)

# ─── ReviewCreate schema ───────────────────────────────────────────────────


def test_review_create_minimal() -> None:
    r = ReviewCreate(case_id=uuid4(), rating=5)
    assert r.body is None


def test_review_create_with_body() -> None:
    r = ReviewCreate(case_id=uuid4(), rating=4, body="Harika iş")
    assert r.body == "Harika iş"


def test_review_create_rejects_rating_below_1() -> None:
    with pytest.raises(ValidationError):
        ReviewCreate(case_id=uuid4(), rating=0)


def test_review_create_rejects_rating_above_5() -> None:
    with pytest.raises(ValidationError):
        ReviewCreate(case_id=uuid4(), rating=6)


def test_review_create_rejects_extra_field() -> None:
    with pytest.raises(ValidationError):
        ReviewCreate(
            case_id=uuid4(),
            rating=5,
            reviewer_user_id=uuid4(),  # type: ignore[call-arg] — spoof
        )


# ─── Reviewer name masking helper ──────────────────────────────────────────


def test_mask_reviewer_two_words() -> None:
    assert mask_reviewer_name("Ahmet Yılmaz") == "A.Y."


def test_mask_reviewer_single_word() -> None:
    assert mask_reviewer_name("Ali") == "A."


def test_mask_reviewer_three_plus_takes_first_two() -> None:
    """Üç kelime → sadece ilk iki baş harf."""
    assert mask_reviewer_name("Ahmet Veli Yılmaz") == "A.V."


def test_mask_reviewer_none() -> None:
    assert mask_reviewer_name(None) == "Anonim"


def test_mask_reviewer_empty_string() -> None:
    assert mask_reviewer_name("") == "Anonim"


def test_mask_reviewer_whitespace_only() -> None:
    assert mask_reviewer_name("   ") == "Anonim"


def test_mask_reviewer_lowercase_uppercased() -> None:
    assert mask_reviewer_name("ayşe demir") == "A.D."


# ─── TechnicianReviewItem — PII absence ───────────────────────────────────


_PII_FORBIDDEN_FIELDS = {
    "reviewer_user_id",
    "reviewee_user_id",
    "phone",
    "email",
    "full_name",
    "case_id",
}


def test_technician_review_item_no_pii_fields() -> None:
    """Public listing response'unda reviewer_user_id + case_id yasak."""
    fields = set(TechnicianReviewItem.model_fields.keys())
    leaked = _PII_FORBIDDEN_FIELDS & fields
    assert not leaked, f"PII leak in TechnicianReviewItem: {leaked}"


def test_technician_review_item_has_masked_name() -> None:
    assert "reviewer_masked_name" in TechnicianReviewItem.model_fields


def test_technician_review_item_construct() -> None:
    item = TechnicianReviewItem(
        id=uuid4(),
        rating=4,
        body="İyiydi",
        reviewer_masked_name="A.Y.",
        response_body=None,
        responded_at=None,
        created_at=datetime(2026, 4, 22, 10, 0, tzinfo=UTC),
    )
    assert item.reviewer_masked_name == "A.Y."


# ─── ReviewResponse — sahip (reviewer/reviewee kullanımı) ─────────────────


def test_review_response_includes_all_ids() -> None:
    """/reviews/me endpoint'i full shape döner (owner context)."""
    fields = set(ReviewResponse.model_fields.keys())
    assert "reviewer_user_id" in fields
    assert "reviewee_user_id" in fields
    assert "case_id" in fields


# ─── PoolCaseItem + PoolCaseDetail — customer PII absence ─────────────────


def test_pool_case_item_no_customer_pii() -> None:
    fields = set(PoolCaseItem.model_fields.keys())
    forbidden = {"customer_user_id", "phone", "email", "customer_name"}
    assert not (forbidden & fields), f"Customer PII in PoolCaseItem: {forbidden & fields}"


def test_pool_case_detail_only_masked_customer() -> None:
    """Detail'de customer_masked_name var; raw user bilgisi yok."""
    fields = set(PoolCaseDetail.model_fields.keys())
    assert "customer_masked_name" in fields
    forbidden = {"customer_user_id", "phone", "email", "full_name"}
    assert not (forbidden & fields)


def test_pool_case_item_construct() -> None:
    item = PoolCaseItem(
        id=uuid4(),
        kind=ServiceRequestKind.BREAKDOWN,
        urgency=ServiceRequestUrgency.TODAY,
        status=ServiceCaseStatus.MATCHING,
        workflow_blueprint="breakdown_standard",
        title="Motor arızası",
        subtitle=None,
        location_label="Kadıköy",
        created_at=datetime(2026, 4, 22, 11, 0, tzinfo=UTC),
        estimate_amount=None,
    )
    assert item.kind == ServiceRequestKind.BREAKDOWN


# ─── Review model — table name + constraint name contract ─────────────────


def test_review_model_table_name() -> None:
    assert Review.__tablename__ == "reviews"


def test_review_model_constraints_exist() -> None:
    """UNIQUE + CHECK constraint isimleri migration ile uyumlu."""
    constraint_names = {c.name for c in Review.__table_args__}
    assert "uq_reviews_case_reviewer" in constraint_names
    assert "ck_reviews_rating_range" in constraint_names


# ─── Migration 0026 revision pointer ──────────────────────────────────────


def test_migration_0026_revision_pointer() -> None:
    import importlib.util
    from pathlib import Path

    path = (
        Path(__file__).parent.parent
        / "alembic"
        / "versions"
        / "20260422_0026_reviews.py"
    )
    assert path.exists(), f"Migration file not found: {path}"
    spec = importlib.util.spec_from_file_location("migration_0026", path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert mod.revision == "20260422_0026"
    assert mod.down_revision == "20260422_0025"


# ─── ServiceCaseStatus smoke — COMPLETED varlığı (guard için) ─────────────


def test_service_case_status_completed_exists() -> None:
    assert ServiceCaseStatus.COMPLETED.value == "completed"


# ─── UUID helpers ─────────────────────────────────────────────────────────


def test_review_create_valid_uuid() -> None:
    r = ReviewCreate(case_id=UUID("00000000-0000-0000-0000-000000000001"), rating=3)
    assert str(r.case_id) == "00000000-0000-0000-0000-000000000001"
