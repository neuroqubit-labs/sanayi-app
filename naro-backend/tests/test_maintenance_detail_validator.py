"""maintenance_detail kategori × payload çapraz validator testleri (§4.1)."""

from __future__ import annotations

import pytest

from app.schemas.service_request import MaintenanceCategory
from app.services.maintenance_detail_validator import (
    GlassFilmDetail,
    MaintenanceDetailValidationError,
    PeriodicDetail,
    TireDetail,
    validate_maintenance_detail,
)


def test_glass_film_valid() -> None:
    result = validate_maintenance_detail(
        MaintenanceCategory.GLASS_FILM,
        {"scope": "yan", "transmittance": "35", "tier": "premium"},
    )
    assert isinstance(result, GlassFilmDetail)
    assert result.scope == "yan"
    assert result.transmittance == "35"


def test_glass_film_missing_scope_rejected() -> None:
    with pytest.raises(MaintenanceDetailValidationError, match="scope"):
        validate_maintenance_detail(
            MaintenanceCategory.GLASS_FILM,
            {"transmittance": "35"},
        )


def test_glass_film_invalid_transmittance_rejected() -> None:
    with pytest.raises(MaintenanceDetailValidationError, match="transmittance"):
        validate_maintenance_detail(
            MaintenanceCategory.GLASS_FILM,
            {"scope": "yan", "transmittance": "80"},  # 80 enum dışı
        )


def test_tire_valid() -> None:
    result = validate_maintenance_detail(
        MaintenanceCategory.TIRE,
        {"season": "summer", "count": 4, "rot_balans": True},
    )
    assert isinstance(result, TireDetail)
    assert result.count == 4


def test_tire_count_out_of_range() -> None:
    with pytest.raises(MaintenanceDetailValidationError, match="count"):
        validate_maintenance_detail(
            MaintenanceCategory.TIRE, {"season": "summer", "count": 5}
        )


def test_periodic_optional_payload_accepted() -> None:
    """Periodic için detail zorunlu değil; boş gönderildiğinde None döner."""
    assert validate_maintenance_detail(MaintenanceCategory.PERIODIC, None) is None
    assert validate_maintenance_detail(MaintenanceCategory.PERIODIC, {}) is None
    result = validate_maintenance_detail(
        MaintenanceCategory.PERIODIC, {"oil_type": "5W-30"}
    )
    assert isinstance(result, PeriodicDetail)


def test_headlight_polish_empty_ok() -> None:
    assert (
        validate_maintenance_detail(MaintenanceCategory.HEADLIGHT_POLISH, None)
        is None
    )


def test_tire_required_payload_missing() -> None:
    """TIRE _REQUIRED_CATEGORIES içinde — detail None → raise."""
    with pytest.raises(MaintenanceDetailValidationError, match="zorunlu"):
        validate_maintenance_detail(MaintenanceCategory.TIRE, None)


def test_category_none_with_detail_rejected() -> None:
    with pytest.raises(MaintenanceDetailValidationError, match="maintenance_category"):
        validate_maintenance_detail(None, {"foo": "bar"})


def test_glass_film_extra_field_rejected() -> None:
    """extra='forbid' — beklenmeyen alan gelirse reddedilir."""
    with pytest.raises(MaintenanceDetailValidationError):
        validate_maintenance_detail(
            MaintenanceCategory.GLASS_FILM,
            {"scope": "yan", "transmittance": "35", "unknown_field": True},
        )
