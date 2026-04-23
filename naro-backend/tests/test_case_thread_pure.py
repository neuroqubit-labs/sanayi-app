"""Case thread pure unit tests — disintermediation regex + schema validation.

İş 3 (2026-04-23) — PO brief.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.case_thread import (
    CaseNotesPayload,
    ThreadMessageCreatePayload,
)
from app.services.case_thread import detect_disintermediation


# ─── Disintermediation regex: telefon + email ────────────────────────────


@pytest.mark.parametrize(
    "content",
    [
        "0532 123 45 67",
        "+905321234567",
        "05321234567",
        "Arayın: 0532-123-45-67 acele",
        "(0532)1234567",
    ],
)
def test_disintermediation_rejects_turkish_mobile(content: str) -> None:
    assert detect_disintermediation(content) == "phone_number"


@pytest.mark.parametrize(
    "content",
    [
        "usta@example.com",
        "Bana mail at info@servis.com.tr",
        "john.doe+shop@sub.example.co.uk",
    ],
)
def test_disintermediation_rejects_email(content: str) -> None:
    assert detect_disintermediation(content) == "email"


@pytest.mark.parametrize(
    "content",
    [
        "Araç geldi mi?",
        "50 TL ekstra lazım",
        "Plakası 34 TR 1234",
        "Saat 3'te gelirim",
    ],
)
def test_disintermediation_accepts_benign(content: str) -> None:
    assert detect_disintermediation(content) is None


# ─── Schema validation ──────────────────────────────────────────────────


def test_message_payload_min_length() -> None:
    with pytest.raises(ValidationError):
        ThreadMessageCreatePayload(content="")


def test_message_payload_max_length() -> None:
    with pytest.raises(ValidationError):
        ThreadMessageCreatePayload(content="a" * 2001)


def test_message_payload_accepts_2000_chars() -> None:
    payload = ThreadMessageCreatePayload(content="a" * 2000)
    assert len(payload.content) == 2000


def test_notes_payload_accepts_null() -> None:
    payload = CaseNotesPayload(content=None)
    assert payload.content is None


def test_notes_payload_max_length() -> None:
    with pytest.raises(ValidationError):
        CaseNotesPayload(content="x" * 2001)
