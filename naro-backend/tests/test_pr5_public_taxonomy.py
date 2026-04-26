"""PR 5 pure tests — taxonomy cache + PII mask.

Cache key format + TTL constants + response modellerin PII içermediği.
"""

from __future__ import annotations

import json
from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.taxonomy import BrandTier
from app.models.technician import (
    ProviderMode,
    ProviderType,
    TechnicianVerifiedLevel,
)
from app.schemas.taxonomy import (
    BrandOut,
    CityOut,
    DistrictOut,
    DrivetrainOut,
    ProcedureOut,
    ServiceDomainOut,
)
from app.schemas.technician_public import (
    LocationSummary,
    TechnicianFeedItem,
    TechnicianPublicView,
)
from app.services.taxonomy_cache import (
    PUBLIC_FEED_TTL_SECONDS,
    PUBLIC_PROFILE_TTL_SECONDS,
    TAXONOMY_TTL_SECONDS,
    public_feed_key,
    public_profile_key,
    taxonomy_key,
)

# ─── Cache TTL constants ───────────────────────────────────────────────────


def test_ttl_constants_match_brief() -> None:
    """Brief §6.2: taxonomy 3600s; public profile 300s; feed 60s."""
    assert TAXONOMY_TTL_SECONDS == 3600
    assert PUBLIC_PROFILE_TTL_SECONDS == 300
    assert PUBLIC_FEED_TTL_SECONDS == 60


# ─── Cache key format ──────────────────────────────────────────────────────


def test_taxonomy_key_unfiltered() -> None:
    assert taxonomy_key("service_domains") == "taxonomy:service_domains::v1"


def test_taxonomy_key_with_filter() -> None:
    assert taxonomy_key("procedures", "motor") == "taxonomy:procedures:motor:v1"


def test_taxonomy_key_district_scoped_by_city() -> None:
    assert taxonomy_key("districts", "34") == "taxonomy:districts:34:v1"


def test_public_profile_key_includes_version() -> None:
    tech_id = uuid4()
    assert public_profile_key(tech_id, 5) == f"tech_public:{tech_id}:5"


def test_public_profile_version_bump_changes_key() -> None:
    tech_id = uuid4()
    assert public_profile_key(tech_id, 1) != public_profile_key(tech_id, 2)


def test_public_feed_key_format() -> None:
    assert public_feed_key(cursor=None, limit=20) == "tech_feed::20:v1"
    assert (
        public_feed_key(cursor="abc123", limit=50)
        == "tech_feed:abc123:50:v1"
    )


# ─── Taxonomy response models ─────────────────────────────────────────────


def test_brand_out_valid() -> None:
    b = BrandOut(
        brand_key="bmw",
        label="BMW",
        tier=BrandTier.PREMIUM,
        country_code="DE",
        display_order=200,
    )
    assert b.tier == BrandTier.PREMIUM


def test_brand_out_rejects_invalid_tier() -> None:
    with pytest.raises(ValidationError):
        BrandOut(
            brand_key="x",
            label="X",
            tier="ghost_tier",  # type: ignore[arg-type]
            display_order=0,
        )


def test_procedure_out_all_optionals() -> None:
    p = ProcedureOut(
        procedure_key="yag",
        domain_key="motor",
        label="Yağ Bakımı",
        is_popular=True,
        display_order=0,
    )
    assert p.description is None
    assert p.typical_labor_hours_min is None


def test_service_domain_out_minimal() -> None:
    d = ServiceDomainOut(domain_key="motor", label="Motor", display_order=10)
    assert d.description is None
    assert d.icon is None


def test_city_out_district_out_drivetrain_out_basic() -> None:
    c = CityOut(city_code="34", label="İstanbul", region="Marmara")
    assert c.region == "Marmara"

    d = DistrictOut(
        district_id=uuid4(),
        city_code="34",
        label="Kadıköy",
    )
    assert d.center_lat is None

    dt = DrivetrainOut(
        drivetrain_key="benzin_otomatik",
        label="Benzin Otomatik",
        fuel_type="benzin",
        transmission="otomatik",
        display_order=10,
    )
    assert dt.fuel_type == "benzin"


# ─── PII mask — TechnicianPublicView (canonical I-9) ──────────────────────


_PII_FORBIDDEN_FIELDS = {
    "phone",
    "email",
    "legal_name",
    "tax_number",
    "iban",
    "address",
    "business_info",
}


def _sample_public_view() -> TechnicianPublicView:
    return TechnicianPublicView(
        id=uuid4(),
        user_id=uuid4(),
        display_name="Autopro İstanbul",
        tagline="BMW uzmanı",
        biography="15 yıl deneyim",
        avatar_asset_id=uuid4(),
        verified_level=TechnicianVerifiedLevel.VERIFIED,
        provider_type=ProviderType.USTA,
        secondary_provider_types=[ProviderType.CEKICI],
        active_provider_type=ProviderType.USTA,
        provider_mode=ProviderMode.BUSINESS,
        accepting_new_jobs=True,
        rating_bayesian=Decimal("4.85"),
        rating_count=142,
        completed_jobs_30d=38,
        response_time_p50_minutes=12,
        location_summary=LocationSummary(
            city_code="34",
            city_label="İstanbul",
            primary_district_label="Kadıköy",
            service_radius_km=15,
        ),
    )


def test_public_view_no_pii_fields() -> None:
    """I-9: PII alanları response şemasında tanımlı OLMAMALI."""
    _sample_public_view()
    fields = set(TechnicianPublicView.model_fields.keys())
    leaked = _PII_FORBIDDEN_FIELDS & fields
    assert not leaked, f"PII fields leaked in TechnicianPublicView: {leaked}"


def test_public_view_json_no_pii_keys() -> None:
    """Serialize sonrası da PII yok — double check."""
    view = _sample_public_view()
    payload = json.loads(view.model_dump_json())
    leaked = _PII_FORBIDDEN_FIELDS & set(payload.keys())
    assert not leaked, f"PII fields in JSON: {leaked}"


def test_public_view_accepting_new_jobs_not_raw_enum() -> None:
    """Raw availability enum sızmamalı — sadece bool accepting_new_jobs."""
    view = _sample_public_view()
    assert "availability" not in TechnicianPublicView.model_fields
    assert isinstance(view.accepting_new_jobs, bool)


def test_public_view_location_summary_no_latlng() -> None:
    """LocationSummary lat/lng alanı DIMANENDİR (fizik koordinat dışı)."""
    fields = set(LocationSummary.model_fields.keys())
    assert "workshop_lat" not in fields
    assert "workshop_lng" not in fields
    assert "lat" not in fields
    assert "lng" not in fields


def test_public_view_extra_forbid_on_location_summary() -> None:
    """extra='forbid' — client PII enjekte edemez LocationSummary'e."""
    with pytest.raises(ValidationError):
        LocationSummary(
            city_code="34",
            workshop_lat="41.0",  # type: ignore[call-arg]
        )


# ─── TechnicianFeedItem ────────────────────────────────────────────────────


def _sample_feed_item() -> TechnicianFeedItem:
    return TechnicianFeedItem(
        id=uuid4(),
        display_name="Otopar",
        tagline="Yan sanayi",
        avatar_asset_id=None,
        verified_level=TechnicianVerifiedLevel.BASIC,
        provider_type=ProviderType.USTA,
        secondary_provider_types=[],
        active_provider_type=None,
        accepting_new_jobs=False,
        rating_bayesian=None,
        rating_count=0,
        completed_jobs_30d=0,
    )


def test_feed_item_no_pii_fields() -> None:
    _sample_feed_item()
    fields = set(TechnicianFeedItem.model_fields.keys())
    leaked = _PII_FORBIDDEN_FIELDS & fields
    # biography feed'de yok (light variant) — cross-check
    assert "biography" not in fields
    assert not leaked


def test_feed_item_json_roundtrip() -> None:
    item = _sample_feed_item()
    payload = item.model_dump_json()
    rebuilt = TechnicianFeedItem.model_validate_json(payload)
    assert rebuilt.id == item.id
    assert rebuilt.accepting_new_jobs == item.accepting_new_jobs
