from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy.dialects.postgresql import dialect as pg_dialect

from app.models.case import ServiceRequestKind
from app.models.case_matching import CaseTechnicianNotificationStatus
from app.models.case_subtypes import TowCase
from app.models.technician import ProviderType
from app.models.vehicle import Vehicle, VehicleKind
from app.services.case_matching import (
    MAX_CUSTOMER_NOTIFICATIONS_PER_CASE,
    _breakdown_domain_keys,
    _case_location_text,
    _maintenance_category_domain_keys,
    _matches_any_location_candidate,
    _normalize_text,
    _reason_label,
    _vehicle_kind_matches_profile,
    notify_case_to_technician,
    service_tag_keys_for_draft,
    technician_matches_case_kind,
)


def test_turkish_location_normalization_supports_city_matching() -> None:
    assert _normalize_text("İstanbul / Kocasinan") == "istanbul / kocasinan"
    assert _matches_any_location_candidate("kayseri kocasinan", ["Kayseri"])
    assert not _matches_any_location_candidate("kayseri kocasinan", ["38"])


def test_case_location_text_uses_typed_fields_not_request_draft() -> None:
    case = SimpleNamespace(
        location_label="Kayseri, Kocasinan",
        request_draft={"location": {"label": "Ankara, Cankaya"}},
    )

    assert _case_location_text(case) == "kayseri, kocasinan"
    assert "ankara" not in _case_location_text(case)


def test_case_location_text_includes_tow_typed_addresses() -> None:
    case = SimpleNamespace(location_label=None, request_draft={})
    tow_case = TowCase(
        pickup_address="Kayseri, Kocasinan, Sahabiye",
        dropoff_address="Kayseri, Melikgazi, Sanayi",
    )

    text = _case_location_text(case, subtype=tow_case)

    assert "kocasinan" in text
    assert "melikgazi" in text


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


def test_maintenance_category_domain_keys_are_specific() -> None:
    assert _maintenance_category_domain_keys("glass_film") == {"cam"}
    assert _maintenance_category_domain_keys("climate") == {
        "klima",
        "elektrik",
    }
    assert "elektrik" not in _maintenance_category_domain_keys("glass_film")
    assert _maintenance_category_domain_keys("package_summer") == set()
    assert _maintenance_category_domain_keys("package_summer", ["glass_film"]) == {
        "cam"
    }


def test_service_tag_keys_for_draft_use_typed_maintenance_items() -> None:
    draft = SimpleNamespace(
        kind=ServiceRequestKind.MAINTENANCE,
        maintenance_category="package_summer",
        maintenance_items=["glass_film"],
        maintenance_detail={"selected_items": ["tire"]},
    )

    assert service_tag_keys_for_draft(draft) == {"cam", "lastik"}


def test_breakdown_tags_use_category_and_symptoms() -> None:
    assert _breakdown_domain_keys("electric", ["Akü bitmiş gibi"]) == {
        "aku",
        "elektrik",
    }


@pytest.mark.asyncio
async def test_notify_case_to_technician_allows_notification_without_match(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import case_matching

    profile_id = uuid4()
    technician_user_id = uuid4()
    case_id = uuid4()
    captured: dict[str, object] = {}

    class ExecuteResult:
        def scalar_one(self):
            return SimpleNamespace(
                id=uuid4(),
                case_id=case_id,
                technician_user_id=technician_user_id,
                match_id=captured["match_id"],
                status=CaseTechnicianNotificationStatus.SENT,
            )

    class FakeSession:
        async def scalar(self, *_args, **_kwargs):
            return 0

        async def execute(self, stmt):
            compiled = stmt.compile(dialect=pg_dialect())
            captured["match_id"] = compiled.params["match_id"]
            return ExecuteResult()

    async def fake_get_profile_for_user(*_args, **_kwargs):
        return SimpleNamespace(
            id=profile_id,
            user_id=technician_user_id,
            provider_type=ProviderType.USTA,
            secondary_provider_types=[],
        )

    monkeypatch.setattr(
        case_matching,
        "_get_profile_for_user",
        fake_get_profile_for_user,
    )

    async def fake_get_match_for_technician(*_args, **_kwargs):
        return None

    monkeypatch.setattr(
        case_matching,
        "get_match_for_technician",
        fake_get_match_for_technician,
    )

    async def fake_get_notification_for_technician(*_args, **_kwargs):
        return None

    monkeypatch.setattr(
        case_matching,
        "get_notification_for_technician",
        fake_get_notification_for_technician,
    )

    async def fake_profile_matches_case_scope(*_args, **_kwargs):
        return True

    monkeypatch.setattr(
        case_matching,
        "profile_matches_case_scope",
        fake_profile_matches_case_scope,
    )

    notification = await notify_case_to_technician(
        FakeSession(),
        case=SimpleNamespace(id=case_id, kind=ServiceRequestKind.BREAKDOWN),
        customer_user_id=uuid4(),
        technician_user_id=technician_user_id,
    )

    assert notification.match_id is None
    assert notification.status == CaseTechnicianNotificationStatus.SENT


@pytest.mark.asyncio
async def test_vehicle_kind_coverage_blocks_motorcycle_for_auto_only_profile() -> None:
    profile_id = uuid4()
    case_id = uuid4()

    class ExecuteResult:
        def scalars(self):
            return self

        def all(self):
            return [VehicleKind.OTOMOBIL]

    class FakeSession:
        async def get(self, model, _id):
            if model is Vehicle:
                return SimpleNamespace(vehicle_kind=VehicleKind.MOTOSIKLET)
            return None

        async def execute(self, _stmt):
            return ExecuteResult()

    matches = await _vehicle_kind_matches_profile(
        FakeSession(),
        case=SimpleNamespace(id=case_id, vehicle_id=uuid4()),
        profile=SimpleNamespace(id=profile_id),
    )

    assert matches is False


@pytest.mark.asyncio
async def test_notify_case_to_technician_rejects_scope_mismatch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import case_matching

    async def fake_get_profile_for_user(*_args, **_kwargs):
        return SimpleNamespace(
            id=uuid4(),
            user_id=uuid4(),
            provider_type=ProviderType.OTO_ELEKTRIK,
            secondary_provider_types=[],
        )

    async def fake_profile_matches_case_scope(*_args, **_kwargs):
        return False

    monkeypatch.setattr(
        case_matching,
        "_get_profile_for_user",
        fake_get_profile_for_user,
    )
    monkeypatch.setattr(
        case_matching,
        "profile_matches_case_scope",
        fake_profile_matches_case_scope,
    )

    with pytest.raises(ValueError, match="technician_case_kind_mismatch"):
        await notify_case_to_technician(
            SimpleNamespace(),
            case=SimpleNamespace(id=uuid4(), kind=ServiceRequestKind.MAINTENANCE),
            customer_user_id=uuid4(),
            technician_user_id=uuid4(),
        )


@pytest.mark.asyncio
async def test_notify_case_to_technician_rejects_when_notification_limit_reached(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import case_matching

    async def fake_get_profile_for_user(*_args, **_kwargs):
        return SimpleNamespace(
            id=uuid4(),
            user_id=uuid4(),
            provider_type=ProviderType.USTA,
            secondary_provider_types=[],
        )

    async def fake_profile_matches_case_scope(*_args, **_kwargs):
        return True

    async def fake_get_notification_for_technician(*_args, **_kwargs):
        return None

    class FakeSession:
        async def scalar(self, *_args, **_kwargs):
            return MAX_CUSTOMER_NOTIFICATIONS_PER_CASE

    monkeypatch.setattr(
        case_matching,
        "_get_profile_for_user",
        fake_get_profile_for_user,
    )
    monkeypatch.setattr(
        case_matching,
        "profile_matches_case_scope",
        fake_profile_matches_case_scope,
    )
    monkeypatch.setattr(
        case_matching,
        "get_notification_for_technician",
        fake_get_notification_for_technician,
    )

    with pytest.raises(ValueError, match="case_notification_limit_reached"):
        await notify_case_to_technician(
            FakeSession(),
            case=SimpleNamespace(id=uuid4(), kind=ServiceRequestKind.MAINTENANCE),
            customer_user_id=uuid4(),
            technician_user_id=uuid4(),
        )
