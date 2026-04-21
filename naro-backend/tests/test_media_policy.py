"""Tow-style policy smoke — 18-purpose matrix mime + size + dim + duration.

Pure helper tests (no DB). Her purpose için doğru mime/size kabul + yanlışlar
reject; visibility + antivirus_required invariants.
"""

from __future__ import annotations

import pytest

from app.models.media import MediaPurpose, MediaVisibility
from app.services import media_policy
from app.services.media_policy import (
    POLICY,
    PolicyViolationError,
    UnknownPurposeError,
    canonicalize,
    enforce,
    get,
)


def test_policy_covers_all_purposes() -> None:
    """Her MediaPurpose enum değeri için policy entry var."""
    for purpose in MediaPurpose:
        rule = get(purpose)
        assert rule.owner_kind, f"empty owner_kind for {purpose.value}"
        assert rule.mime_whitelist, f"empty mime_whitelist for {purpose.value}"
        assert rule.max_size_bytes > 0


def test_policy_owner_kinds_are_canonical() -> None:
    """owner_kind string'leri sabit setten seçilir."""
    valid = {
        "user",
        "vehicle",
        "service_case",
        "technician_profile",
        "technician_certificate",
        "insurance_claim",
        "campaign",
    }
    for purpose in MediaPurpose:
        rule = get(purpose)
        assert rule.owner_kind in valid


def test_enforce_accepts_valid_avatar() -> None:
    rule = enforce(
        MediaPurpose.USER_AVATAR,
        mime="image/jpeg",
        size_bytes=2 * 1024 * 1024,
        dimensions=(800, 800),
    )
    assert rule.visibility == MediaVisibility.PUBLIC


def test_enforce_rejects_oversize_avatar() -> None:
    with pytest.raises(PolicyViolationError, match="size"):
        enforce(
            MediaPurpose.USER_AVATAR,
            mime="image/jpeg",
            size_bytes=10 * 1024 * 1024,
        )


def test_enforce_rejects_wrong_mime_avatar() -> None:
    with pytest.raises(PolicyViolationError, match="mime"):
        enforce(
            MediaPurpose.USER_AVATAR,
            mime="video/mp4",
            size_bytes=100,
        )


def test_enforce_rejects_oversize_dimensions() -> None:
    with pytest.raises(PolicyViolationError, match="dimensions"):
        enforce(
            MediaPurpose.USER_AVATAR,
            mime="image/jpeg",
            size_bytes=1024,
            dimensions=(4000, 4000),
        )


def test_enforce_video_duration_limit() -> None:
    with pytest.raises(PolicyViolationError, match="duration"):
        enforce(
            MediaPurpose.CASE_EVIDENCE_VIDEO,
            mime="video/mp4",
            size_bytes=100,
            duration_sec=300,  # 120 max
        )


def test_enforce_positive_size() -> None:
    with pytest.raises(PolicyViolationError, match="positive"):
        enforce(MediaPurpose.USER_AVATAR, mime="image/jpeg", size_bytes=0)


def test_insurance_doc_antivirus_required() -> None:
    assert get(MediaPurpose.INSURANCE_DOC).antivirus_required is True
    assert get(MediaPurpose.VEHICLE_LICENSE_PHOTO).antivirus_required is True
    assert get(MediaPurpose.TECHNICIAN_CERTIFICATE).antivirus_required is True


def test_user_content_antivirus_not_required() -> None:
    """Kullanıcı yüklemelerinin büyük çoğunluğu AV gerekmez (perf)."""
    assert get(MediaPurpose.USER_AVATAR).antivirus_required is False
    assert get(MediaPurpose.CASE_DAMAGE_PHOTO).antivirus_required is False
    assert get(MediaPurpose.TOW_ARRIVAL_PHOTO).antivirus_required is False


def test_retention_specified_for_kvkk_purposes() -> None:
    """KVKK/hukuki retention 10 yıl olmalı."""
    assert get(MediaPurpose.INSURANCE_DOC).retention_days == 3650
    assert get(MediaPurpose.ACCIDENT_PROOF).retention_days == 3650


def test_public_assets_visibility() -> None:
    public_purposes = {
        MediaPurpose.USER_AVATAR,
        MediaPurpose.TECHNICIAN_AVATAR,
        MediaPurpose.TECHNICIAN_GALLERY_PHOTO,
        MediaPurpose.TECHNICIAN_GALLERY_VIDEO,
        MediaPurpose.TECHNICIAN_PROMO_VIDEO,
        MediaPurpose.CAMPAIGN_ASSET,
    }
    for purpose in public_purposes:
        assert get(purpose).visibility == MediaVisibility.PUBLIC, purpose.value


def test_canonicalize_legacy_purposes() -> None:
    assert canonicalize(MediaPurpose.CASE_ATTACHMENT) == MediaPurpose.CASE_DAMAGE_PHOTO
    assert (
        canonicalize(MediaPurpose.TECHNICIAN_GALLERY)
        == MediaPurpose.TECHNICIAN_GALLERY_PHOTO
    )
    assert (
        canonicalize(MediaPurpose.TECHNICIAN_PROMO)
        == MediaPurpose.TECHNICIAN_PROMO_VIDEO
    )
    # New purpose pass-through
    assert canonicalize(MediaPurpose.VEHICLE_PHOTO) == MediaPurpose.VEHICLE_PHOTO


def test_unknown_purpose_raises() -> None:
    """POLICY'de eksik entry → UnknownPurposeError."""
    # Simulated missing key
    original = POLICY.pop(MediaPurpose.CAMPAIGN_ASSET)
    try:
        with pytest.raises(UnknownPurposeError):
            get(MediaPurpose.CAMPAIGN_ASSET)
    finally:
        POLICY[MediaPurpose.CAMPAIGN_ASSET] = original
