"""Case documents + events pure unit tests — İş 5 (FE engine blocker).

Mapping ve yardımcı fonksiyonların birim testleri. DB integration skip
(asyncpg bloker) — happy path ve auth kontrolü çalışan routes smoke ile
e2e doğrulanır.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.models.media import MediaPurpose
from app.models.user import UserRole
from app.schemas.case_document import CaseDocumentKind
from app.services.case_documents import (
    _actor_role_from_db_role,
    _decode_cursor,
    _encode_cursor,
    _uploader_role_from_db_role,
    antivirus_verdict,
    classify_document_kind,
)

# ─── Purpose → kind mapping ────────────────────────────────────────────


@pytest.mark.parametrize(
    "purpose,expected",
    [
        (MediaPurpose.CASE_DAMAGE_PHOTO, CaseDocumentKind.DAMAGE_PHOTO),
        (MediaPurpose.ACCIDENT_PROOF, CaseDocumentKind.DAMAGE_PHOTO),
        (MediaPurpose.CASE_EVIDENCE_PHOTO, CaseDocumentKind.DAMAGE_PHOTO),
        (MediaPurpose.CASE_EVIDENCE_VIDEO, CaseDocumentKind.DAMAGE_PHOTO),
        (MediaPurpose.TOW_ARRIVAL_PHOTO, CaseDocumentKind.DAMAGE_PHOTO),
        (MediaPurpose.TOW_LOADING_PHOTO, CaseDocumentKind.DAMAGE_PHOTO),
        (MediaPurpose.TOW_DELIVERY_PHOTO, CaseDocumentKind.DAMAGE_PHOTO),
        (MediaPurpose.INSURANCE_DOC, CaseDocumentKind.KASKO_FORM),
    ],
)
def test_document_kind_mapping_hits(
    purpose: MediaPurpose, expected: CaseDocumentKind
) -> None:
    assert classify_document_kind(purpose) == expected


@pytest.mark.parametrize(
    "purpose",
    [
        MediaPurpose.USER_AVATAR,
        MediaPurpose.CAMPAIGN_ASSET,
        MediaPurpose.TECHNICIAN_GALLERY,
        MediaPurpose.TECHNICIAN_CERTIFICATE,
    ],
)
def test_document_kind_mapping_fallback_other(
    purpose: MediaPurpose,
) -> None:
    assert classify_document_kind(purpose) == CaseDocumentKind.OTHER


# ─── Antivirus verdict ────────────────────────────────────────────────


@pytest.mark.parametrize(
    "value,expected",
    [
        ("clean", "clean"),
        ("infected", "infected"),
        ("pending", "pending"),
        (None, "pending"),
        ("unknown", "pending"),
        ("", "pending"),
    ],
)
def test_antivirus_verdict_mapping(value: str | None, expected: str) -> None:
    assert antivirus_verdict(value) == expected


# ─── Role mapping ─────────────────────────────────────────────────────


def test_uploader_role_mapping() -> None:
    assert _uploader_role_from_db_role(UserRole.CUSTOMER) == "customer"
    assert _uploader_role_from_db_role(UserRole.TECHNICIAN) == "technician"
    assert _uploader_role_from_db_role(UserRole.ADMIN) == "admin"
    assert _uploader_role_from_db_role(None) is None


def test_actor_role_mapping_mirrors_uploader() -> None:
    assert _actor_role_from_db_role(UserRole.CUSTOMER) == "customer"
    assert _actor_role_from_db_role(UserRole.ADMIN) == "admin"
    assert _actor_role_from_db_role(None) is None


# ─── Cursor encode/decode ─────────────────────────────────────────────


def test_cursor_roundtrip() -> None:
    ts = datetime(2026, 4, 23, 15, 30, 45, tzinfo=UTC)
    eid = uuid4()
    cursor = _encode_cursor(ts, eid)
    decoded_ts, decoded_id = _decode_cursor(cursor)
    assert decoded_ts == ts
    assert decoded_id == eid


def test_cursor_invalid_raises() -> None:
    with pytest.raises(ValueError):
        _decode_cursor("not-a-real-cursor")
