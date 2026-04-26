from app.models.case import ServiceRequestKind
from app.models.technician import ProviderType
from app.services.case_matching import (
    _extract_location_strings,
    _matches_any_location_candidate,
    _normalize_text,
    _reason_label,
    technician_matches_case_kind,
)


def test_turkish_location_normalization_supports_city_matching() -> None:
    assert _normalize_text("İstanbul / Kocasinan") == "istanbul / kocasinan"
    assert _matches_any_location_candidate("kayseri kocasinan", ["Kayseri"])
    assert not _matches_any_location_candidate("kayseri kocasinan", ["38"])


def test_location_dict_extraction_keeps_nested_labels() -> None:
    value = {
        "label": "Kayseri",
        "district": {"label": "Kocasinan"},
        "coords": {"lat": 38.7, "lng": 35.4},
    }
    assert _extract_location_strings(value) == ["Kayseri", "Kocasinan"]


def test_reason_label_prefers_specific_location_match() -> None:
    assert (
        _reason_label(["provider_type", "district_match"])
        == "Bu vaka türüne ve ilçeye uygun"
    )
    assert (
        _reason_label(["provider_type", "city_match"])
        == "Bu vaka türüne ve şehre uygun"
    )


def test_towing_is_never_normal_pool_match_kind() -> None:
    assert not technician_matches_case_kind(
        ServiceRequestKind.TOWING, ProviderType.CEKICI
    )
