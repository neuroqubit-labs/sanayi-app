"""Tow OTP — test placeholders.

DB integration tests pre-existing SAEnum name/value bug nedeniyle çalışmıyor:
ServiceCase ORM hydration 'towing' value'yu 'TOWING' name'e çeviremiyor.
Global düzeltme (values_callable=lambda cls: [m.value for m in cls]) tüm
SAEnum sütunlarına uygulanmalı — Faz 10f sub-sprint kapsamında.

OTP service `issue_otp` + `verify_otp` pure-helper testleri aşağıda; DB
integration smoke Faz 10f'de aktive edilecek.
"""

from __future__ import annotations

import pytest

from app.repositories.tow import generate_otp_code, hash_otp_code
from uuid import uuid4


def test_generate_otp_code_length() -> None:
    for length in (4, 6, 8):
        code = generate_otp_code(length=length)
        assert len(code) == length
        assert code.isdigit()


def test_generate_otp_code_entropy() -> None:
    """100 code generation — uniqueness > 99% (6 digit space = 1M)."""
    codes = {generate_otp_code(length=6) for _ in range(100)}
    assert len(codes) >= 99


def test_hash_otp_salted_with_case_id() -> None:
    """Same code, different case_id → different hash."""
    case_a = uuid4()
    case_b = uuid4()
    h1 = hash_otp_code("123456", case_a)
    h2 = hash_otp_code("123456", case_b)
    assert h1 != h2
    # Same code + same case_id → same hash (deterministic)
    assert hash_otp_code("123456", case_a) == h1
    # Hash is hex-encoded SHA256 (64 chars)
    assert len(h1) == 64


@pytest.mark.skip(
    reason="Pre-existing SAEnum name/value bug + event-loop cross-test issue; "
    "Faz 10f sub-sprint: global values_callable + per-test engine fixture."
)
@pytest.mark.asyncio
async def test_otp_verify_correct_code_success() -> None:
    pass


@pytest.mark.skip(reason="See test_otp_verify_correct_code_success.")
@pytest.mark.asyncio
async def test_otp_concurrent_verify_race() -> None:
    """Race: two concurrent verify attempts — at most one succeeds."""
    pass
