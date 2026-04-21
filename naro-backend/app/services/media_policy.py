"""Media purpose canonical policy matrix — brief §2 single source of truth.

Her purpose için:
- max_size_bytes
- dim_max (foto/video width/height; None = irrelevant — PDF/audio)
- mime_whitelist
- duration_max_sec (video/audio only; None = irrelevant)
- retention_days (owner state + N gün hard delete; None = sürekli kullanıcı silmedikçe)
- retention_owner_state (closed/deleted/deactivated; owner lifecycle trigger)
- antivirus_required
- visibility (public/private)
- owner_kind (user | vehicle | service_case | technician_profile | technician_certificate | insurance_claim | campaign)

Service layer `MediaPolicy.enforce()` ile 422 reject yapar. Retention cron
`retention_days` + `retention_owner_state` kullanır.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.models.media import MediaPurpose, MediaVisibility


@dataclass(slots=True, frozen=True)
class PolicyRule:
    max_size_bytes: int
    dim_max: int | None
    mime_whitelist: frozenset[str]
    duration_max_sec: int | None
    retention_days: int | None
    retention_owner_state: str | None  # "closed" | "deleted" | "deactivated" | None
    antivirus_required: bool
    visibility: MediaVisibility
    owner_kind: str


MB = 1024 * 1024

_IMAGE_MIME = frozenset({"image/jpeg", "image/png", "image/webp", "image/heic"})
_PDF_MIME = frozenset({"application/pdf"})
_PDF_IMAGE_MIME = _IMAGE_MIME | _PDF_MIME
_VIDEO_MIME = frozenset({"video/mp4", "video/quicktime"})
_AUDIO_MIME = frozenset({"audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav"})


POLICY: dict[MediaPurpose, PolicyRule] = {
    # Legacy 5 purposes — backward compat; retention/visibility korunur
    MediaPurpose.USER_AVATAR: PolicyRule(
        max_size_bytes=5 * MB,
        dim_max=1024,
        mime_whitelist=_IMAGE_MIME,
        duration_max_sec=None,
        retention_days=None,
        retention_owner_state="deleted",
        antivirus_required=False,
        visibility=MediaVisibility.PUBLIC,
        owner_kind="user",
    ),
    MediaPurpose.CASE_ATTACHMENT: PolicyRule(  # deprecated alias for case_damage_photo
        max_size_bytes=15 * MB,
        dim_max=4096,
        mime_whitelist=_PDF_IMAGE_MIME,
        duration_max_sec=None,
        retention_days=730,
        retention_owner_state="closed",
        antivirus_required=False,
        visibility=MediaVisibility.PRIVATE,
        owner_kind="service_case",
    ),
    MediaPurpose.TECHNICIAN_CERTIFICATE: PolicyRule(
        max_size_bytes=20 * MB,
        dim_max=2048,
        mime_whitelist=_PDF_IMAGE_MIME,
        duration_max_sec=None,
        retention_days=1825,  # 5 yıl
        retention_owner_state="deactivated",
        antivirus_required=True,
        visibility=MediaVisibility.PRIVATE,
        owner_kind="technician_certificate",
    ),
    MediaPurpose.TECHNICIAN_GALLERY: PolicyRule(  # legacy
        max_size_bytes=10 * MB,
        dim_max=1920,
        mime_whitelist=_IMAGE_MIME,
        duration_max_sec=None,
        retention_days=30,
        retention_owner_state="deactivated",
        antivirus_required=False,
        visibility=MediaVisibility.PUBLIC,
        owner_kind="technician_profile",
    ),
    MediaPurpose.TECHNICIAN_PROMO: PolicyRule(  # legacy
        max_size_bytes=150 * MB,
        dim_max=1080,
        mime_whitelist=_VIDEO_MIME,
        duration_max_sec=120,
        retention_days=30,
        retention_owner_state="deactivated",
        antivirus_required=False,
        visibility=MediaVisibility.PUBLIC,
        owner_kind="technician_profile",
    ),
    # ─── Faz 11 yeni purposes ──────────────────────────────────────────────
    MediaPurpose.VEHICLE_LICENSE_PHOTO: PolicyRule(
        max_size_bytes=10 * MB,
        dim_max=2048,
        mime_whitelist=_IMAGE_MIME,
        duration_max_sec=None,
        retention_days=730,
        retention_owner_state="deleted",
        antivirus_required=True,
        visibility=MediaVisibility.PRIVATE,
        owner_kind="vehicle",
    ),
    MediaPurpose.VEHICLE_PHOTO: PolicyRule(
        max_size_bytes=10 * MB,
        dim_max=2048,
        mime_whitelist=_IMAGE_MIME,
        duration_max_sec=None,
        retention_days=730,
        retention_owner_state="deleted",
        antivirus_required=False,
        visibility=MediaVisibility.PRIVATE,
        owner_kind="vehicle",
    ),
    MediaPurpose.CASE_DAMAGE_PHOTO: PolicyRule(
        max_size_bytes=15 * MB,
        dim_max=4096,
        mime_whitelist=_IMAGE_MIME,
        duration_max_sec=None,
        retention_days=730,
        retention_owner_state="closed",
        antivirus_required=False,
        visibility=MediaVisibility.PRIVATE,
        owner_kind="service_case",
    ),
    MediaPurpose.CASE_EVIDENCE_PHOTO: PolicyRule(
        max_size_bytes=15 * MB,
        dim_max=4096,
        mime_whitelist=_IMAGE_MIME,
        duration_max_sec=None,
        retention_days=730,
        retention_owner_state="closed",
        antivirus_required=False,
        visibility=MediaVisibility.PRIVATE,
        owner_kind="service_case",
    ),
    MediaPurpose.CASE_EVIDENCE_VIDEO: PolicyRule(
        max_size_bytes=200 * MB,
        dim_max=1080,
        mime_whitelist=_VIDEO_MIME,
        duration_max_sec=120,
        retention_days=730,
        retention_owner_state="closed",
        antivirus_required=False,
        visibility=MediaVisibility.PRIVATE,
        owner_kind="service_case",
    ),
    MediaPurpose.CASE_EVIDENCE_AUDIO: PolicyRule(
        max_size_bytes=20 * MB,
        dim_max=None,
        mime_whitelist=_AUDIO_MIME,
        duration_max_sec=120,
        retention_days=730,
        retention_owner_state="closed",
        antivirus_required=False,
        visibility=MediaVisibility.PRIVATE,
        owner_kind="service_case",
    ),
    MediaPurpose.ACCIDENT_PROOF: PolicyRule(
        max_size_bytes=15 * MB,
        dim_max=4096,
        mime_whitelist=_IMAGE_MIME,
        duration_max_sec=None,
        retention_days=3650,  # 10 yıl hukuki
        retention_owner_state="closed",
        antivirus_required=False,
        visibility=MediaVisibility.PRIVATE,
        owner_kind="service_case",
    ),
    MediaPurpose.INSURANCE_DOC: PolicyRule(
        max_size_bytes=20 * MB,
        dim_max=4096,
        mime_whitelist=_PDF_IMAGE_MIME,
        duration_max_sec=None,
        retention_days=3650,  # 10 yıl VUK
        retention_owner_state=None,
        antivirus_required=True,
        visibility=MediaVisibility.PRIVATE,
        owner_kind="insurance_claim",
    ),
    MediaPurpose.TECHNICIAN_AVATAR: PolicyRule(
        max_size_bytes=5 * MB,
        dim_max=1024,
        mime_whitelist=_IMAGE_MIME,
        duration_max_sec=None,
        retention_days=30,
        retention_owner_state="deactivated",
        antivirus_required=False,
        visibility=MediaVisibility.PUBLIC,
        owner_kind="technician_profile",
    ),
    MediaPurpose.TECHNICIAN_GALLERY_PHOTO: PolicyRule(
        max_size_bytes=10 * MB,
        dim_max=1920,
        mime_whitelist=_IMAGE_MIME,
        duration_max_sec=None,
        retention_days=30,
        retention_owner_state="deactivated",
        antivirus_required=False,
        visibility=MediaVisibility.PUBLIC,
        owner_kind="technician_profile",
    ),
    MediaPurpose.TECHNICIAN_GALLERY_VIDEO: PolicyRule(
        max_size_bytes=100 * MB,
        dim_max=1080,
        mime_whitelist=_VIDEO_MIME,
        duration_max_sec=60,
        retention_days=30,
        retention_owner_state="deactivated",
        antivirus_required=False,
        visibility=MediaVisibility.PUBLIC,
        owner_kind="technician_profile",
    ),
    MediaPurpose.TECHNICIAN_PROMO_VIDEO: PolicyRule(
        max_size_bytes=150 * MB,
        dim_max=1080,
        mime_whitelist=_VIDEO_MIME,
        duration_max_sec=120,
        retention_days=30,
        retention_owner_state="deactivated",
        antivirus_required=False,
        visibility=MediaVisibility.PUBLIC,
        owner_kind="technician_profile",
    ),
    MediaPurpose.TOW_ARRIVAL_PHOTO: PolicyRule(
        max_size_bytes=10 * MB,
        dim_max=2048,
        mime_whitelist=_IMAGE_MIME,
        duration_max_sec=None,
        retention_days=365,
        retention_owner_state="closed",
        antivirus_required=False,
        visibility=MediaVisibility.PRIVATE,
        owner_kind="service_case",
    ),
    MediaPurpose.TOW_LOADING_PHOTO: PolicyRule(
        max_size_bytes=10 * MB,
        dim_max=2048,
        mime_whitelist=_IMAGE_MIME,
        duration_max_sec=None,
        retention_days=365,
        retention_owner_state="closed",
        antivirus_required=False,
        visibility=MediaVisibility.PRIVATE,
        owner_kind="service_case",
    ),
    MediaPurpose.TOW_DELIVERY_PHOTO: PolicyRule(
        max_size_bytes=10 * MB,
        dim_max=2048,
        mime_whitelist=_IMAGE_MIME,
        duration_max_sec=None,
        retention_days=365,
        retention_owner_state="closed",
        antivirus_required=False,
        visibility=MediaVisibility.PRIVATE,
        owner_kind="service_case",
    ),
    MediaPurpose.CAMPAIGN_ASSET: PolicyRule(
        max_size_bytes=15 * MB,
        dim_max=1920,
        mime_whitelist=_IMAGE_MIME,
        duration_max_sec=None,
        retention_days=30,
        retention_owner_state="deactivated",
        antivirus_required=False,
        visibility=MediaVisibility.PUBLIC,
        owner_kind="campaign",
    ),
}


class PolicyViolationError(Exception):
    """422 — policy mime/size/dim/duration enforcement fail."""


class UnknownPurposeError(Exception):
    """400 — purpose master list'te yok."""


def get(purpose: MediaPurpose) -> PolicyRule:
    rule = POLICY.get(purpose)
    if rule is None:
        raise UnknownPurposeError(f"no policy defined for purpose={purpose!r}")
    return rule


def enforce(
    purpose: MediaPurpose,
    *,
    mime: str,
    size_bytes: int,
    dimensions: tuple[int, int] | None = None,
    duration_sec: int | None = None,
) -> PolicyRule:
    """Policy enforce — violation → `PolicyViolationError` raise (422)."""
    rule = get(purpose)
    if mime not in rule.mime_whitelist:
        raise PolicyViolationError(
            f"mime {mime!r} not allowed for purpose={purpose.value!r}; "
            f"allowed={sorted(rule.mime_whitelist)}"
        )
    if size_bytes <= 0:
        raise PolicyViolationError("size_bytes must be positive")
    if size_bytes > rule.max_size_bytes:
        raise PolicyViolationError(
            f"size {size_bytes} > max {rule.max_size_bytes} "
            f"for purpose={purpose.value!r}"
        )
    if dimensions is not None and rule.dim_max is not None:
        width, height = dimensions
        if width > rule.dim_max or height > rule.dim_max:
            raise PolicyViolationError(
                f"dimensions {width}x{height} exceed max {rule.dim_max} "
                f"for purpose={purpose.value!r}"
            )
    if (
        duration_sec is not None
        and rule.duration_max_sec is not None
        and duration_sec > rule.duration_max_sec
    ):
        raise PolicyViolationError(
            f"duration {duration_sec}s > max {rule.duration_max_sec}s "
            f"for purpose={purpose.value!r}"
        )
    return rule


# Legacy purpose → canonical normalize (service layer accept backward compat)
_LEGACY_TO_CANONICAL: dict[MediaPurpose, MediaPurpose] = {
    MediaPurpose.CASE_ATTACHMENT: MediaPurpose.CASE_DAMAGE_PHOTO,
    MediaPurpose.TECHNICIAN_GALLERY: MediaPurpose.TECHNICIAN_GALLERY_PHOTO,
    MediaPurpose.TECHNICIAN_PROMO: MediaPurpose.TECHNICIAN_PROMO_VIDEO,
}


def canonicalize(purpose: MediaPurpose) -> MediaPurpose:
    """Legacy purpose normalize (opt-in; service yazım tarafı kullanır)."""
    return _LEGACY_TO_CANONICAL.get(purpose, purpose)
