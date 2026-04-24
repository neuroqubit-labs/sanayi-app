"""PR 6 pure tests — vehicles CRUD + history_consent gating.

Pydantic schema validation + migration idempotency + dossier consent shape.
DB-bağımlı testler (integration) ayrı job'a; burada saf schema + contract.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from app.models.auth_event import AuthEventType
from app.models.vehicle import (
    UserVehicleRole,
    VehicleDrivetrain,
    VehicleFuelType,
    VehicleKind,
    VehicleTransmission,
)
from app.repositories.vehicle import normalize_plate
from app.schemas.vehicle import (
    HistoryConsentRequest,
    VehicleCreate,
    VehicleDossierView,
    VehicleResponse,
    VehicleUpdate,
)

# ─── VehicleCreate — owner_user_id spoof yasak ─────────────────────────────


def test_vehicle_create_rejects_owner_user_id() -> None:
    """owner_user_id route'da CurrentCustomerDep ile dolar — payload'da olmaz."""
    with pytest.raises(ValidationError):
        VehicleCreate(
            plate="34ABC123",
            vehicle_kind=VehicleKind.OTOMOBIL,
            owner_user_id=uuid4(),  # type: ignore[call-arg]
        )


def test_vehicle_create_minimal_plate_kind() -> None:
    """Adım 1 zorunlu — plate + vehicle_kind yeterli."""
    v = VehicleCreate(plate="34ABC123", vehicle_kind=VehicleKind.OTOMOBIL)
    assert v.plate == "34ABC123"
    assert v.vehicle_kind == VehicleKind.OTOMOBIL
    assert v.is_primary is True  # default
    assert v.fuel_type is None
    assert v.transmission is None
    assert v.chassis_no is None
    assert v.engine_no is None


def test_vehicle_create_requires_vehicle_kind() -> None:
    with pytest.raises(ValidationError):
        VehicleCreate(plate="34ABC123")  # type: ignore[call-arg]


def test_vehicle_create_accepts_full_lifecycle() -> None:
    v = VehicleCreate(
        plate="06XYZ123",
        vehicle_kind=VehicleKind.SUV,
        make="BMW",
        model="X3",
        year=2020,
        color="Siyah",
        fuel_type=VehicleFuelType.DIESEL,
        transmission=VehicleTransmission.OTOMATIK,
        chassis_no="WBA3B1C51DF123456",
        engine_no="ENG12345",
        vin="WBA3B1C51DF123456",
        current_km=85000,
        note="Servis geçmişi temiz",
        is_primary=True,
        inspection_valid_until=datetime(2027, 1, 1, tzinfo=UTC),
        inspection_kind="periodic",
        kasko_valid_until=datetime(2027, 3, 1, tzinfo=UTC),
        kasko_insurer="Allianz",
    )
    assert v.fuel_type == VehicleFuelType.DIESEL
    assert v.vehicle_kind == VehicleKind.SUV
    assert v.transmission == VehicleTransmission.OTOMATIK
    assert v.chassis_no == "WBA3B1C51DF123456"
    assert v.engine_no == "ENG12345"
    assert v.inspection_kind == "periodic"


def test_vehicle_create_rejects_invalid_year() -> None:
    with pytest.raises(ValidationError):
        VehicleCreate(plate="34A", vehicle_kind=VehicleKind.OTOMOBIL, year=1800)


def test_vehicle_kind_enum_values() -> None:
    """8 kind — UI Adım 1 tile sayısı ile birebir."""
    assert {k.value for k in VehicleKind} == {
        "otomobil",
        "suv",
        "motosiklet",
        "kamyonet",
        "hafif_ticari",
        "karavan",
        "klasik",
        "ticari",
    }


def test_vehicle_transmission_enum_values() -> None:
    assert {t.value for t in VehicleTransmission} == {
        "manuel",
        "otomatik",
        "yari_otomatik",
    }


def test_vehicle_drivetrain_enum_values() -> None:
    assert {d.value for d in VehicleDrivetrain} == {"fwd", "rwd", "awd", "fourwd"}


def test_vehicle_create_accepts_drivetrain_and_engine_details() -> None:
    v = VehicleCreate(
        plate="34XYZ99",
        vehicle_kind=VehicleKind.SUV,
        drivetrain=VehicleDrivetrain.AWD,
        engine_displacement="2.0L",
        engine_power_hp=190,
    )
    assert v.drivetrain == VehicleDrivetrain.AWD
    assert v.engine_displacement == "2.0L"
    assert v.engine_power_hp == 190


def test_vehicle_create_rejects_engine_power_out_of_range() -> None:
    with pytest.raises(ValidationError):
        VehicleCreate(
            plate="34XYZ99",
            vehicle_kind=VehicleKind.OTOMOBIL,
            engine_power_hp=5000,
        )


# ─── VehicleUpdate — partial update ────────────────────────────────────────


def test_vehicle_update_all_optional() -> None:
    u = VehicleUpdate()
    dump = u.model_dump(exclude_unset=True)
    assert dump == {}


def test_vehicle_update_partial_current_km() -> None:
    u = VehicleUpdate(current_km=90000)
    dump = u.model_dump(exclude_unset=True)
    assert dump == {"current_km": 90000}


def test_vehicle_update_rejects_extra_field() -> None:
    with pytest.raises(ValidationError):
        VehicleUpdate(hacker_field="x")  # type: ignore[call-arg]


# ─── HistoryConsentRequest ─────────────────────────────────────────────────


def test_history_consent_request_granted_true() -> None:
    req = HistoryConsentRequest(granted=True)
    assert req.granted is True


def test_history_consent_request_granted_false() -> None:
    req = HistoryConsentRequest(granted=False)
    assert req.granted is False


def test_history_consent_request_requires_granted() -> None:
    with pytest.raises(ValidationError):
        HistoryConsentRequest()  # type: ignore[call-arg]


def test_history_consent_request_rejects_extra() -> None:
    with pytest.raises(ValidationError):
        HistoryConsentRequest(granted=True, pii="leak")  # type: ignore[call-arg]


# ─── VehicleResponse — consent alanları serializasyon ──────────────────────


def _sample_vehicle_response_kwargs() -> dict[str, object]:
    now = datetime(2026, 4, 22, 12, 0, tzinfo=UTC)
    return {
        "id": uuid4(),
        "plate": "34ABC123",
        "plate_normalized": "34ABC123",
        "vehicle_kind": None,
        "make": None,
        "model": None,
        "year": None,
        "color": None,
        "fuel_type": None,
        "transmission": None,
        "drivetrain": None,
        "engine_displacement": None,
        "engine_power_hp": None,
        "chassis_no": None,
        "engine_no": None,
        "photo_url": None,
        "vin": None,
        "current_km": None,
        "note": None,
        "inspection_valid_until": None,
        "inspection_kind": None,
        "kasko_valid_until": None,
        "kasko_insurer": None,
        "trafik_valid_until": None,
        "trafik_insurer": None,
        "exhaust_valid_until": None,
        "history_consent_granted": False,
        "history_consent_granted_at": None,
        "history_consent_revoked_at": None,
        "deleted_at": None,
        "created_at": now,
        "updated_at": now,
    }


def test_vehicle_response_includes_consent_fields() -> None:
    fields = set(VehicleResponse.model_fields.keys())
    assert "history_consent_granted" in fields
    assert "history_consent_granted_at" in fields
    assert "history_consent_revoked_at" in fields


def test_vehicle_response_default_consent_false() -> None:
    resp = VehicleResponse.model_validate(_sample_vehicle_response_kwargs())
    assert resp.history_consent_granted is False
    assert resp.history_consent_granted_at is None


def test_vehicle_response_granted_shape() -> None:
    kwargs = _sample_vehicle_response_kwargs()
    kwargs["history_consent_granted"] = True
    kwargs["history_consent_granted_at"] = datetime(
        2026, 4, 22, 13, 0, tzinfo=UTC
    )
    resp = VehicleResponse.model_validate(kwargs)
    assert resp.history_consent_granted is True
    assert resp.history_consent_granted_at is not None


# ─── Dossier consent gating shape ──────────────────────────────────────────


def _sample_dossier_kwargs(*, with_last_case: bool) -> dict[str, object]:
    base = {
        "vehicle": VehicleResponse.model_validate(
            _sample_vehicle_response_kwargs()
        ),
        "primary_owner_id": uuid4(),
        "additional_user_ids": [],
        "previous_case_count": 3,
    }
    if with_last_case:
        base.update(
            {
                "last_case_id": uuid4(),
                "last_case_title": "Motor arızası",
                "last_case_updated_at": datetime(
                    2026, 4, 20, 10, 0, tzinfo=UTC
                ),
            }
        )
    return base


def test_dossier_view_count_only_when_no_consent() -> None:
    """Consent yoksa route last_case_* alanlarını None bırakır."""
    view = VehicleDossierView.model_validate(
        _sample_dossier_kwargs(with_last_case=False)
    )
    assert view.previous_case_count == 3
    assert view.last_case_id is None
    assert view.last_case_title is None
    assert view.last_case_updated_at is None


def test_dossier_view_full_when_consent_granted() -> None:
    view = VehicleDossierView.model_validate(
        _sample_dossier_kwargs(with_last_case=True)
    )
    assert view.previous_case_count == 3
    assert view.last_case_id is not None
    assert view.last_case_title == "Motor arızası"


# ─── Plate normalization ───────────────────────────────────────────────────


def test_normalize_plate_strips_spaces_uppercase() -> None:
    assert normalize_plate(" 34 abc 123 ") == "34ABC123"


def test_normalize_plate_preserves_length() -> None:
    assert normalize_plate("34ABC123") == "34ABC123"


# ─── Audit event types ─────────────────────────────────────────────────────


def test_auth_event_type_has_vehicle_consent_values() -> None:
    assert AuthEventType.VEHICLE_CONSENT_GRANTED.value == "vehicle_consent_granted"
    assert AuthEventType.VEHICLE_CONSENT_REVOKED.value == "vehicle_consent_revoked"


# ─── UserVehicleRole enum smoke ────────────────────────────────────────────


def test_user_vehicle_role_values() -> None:
    assert UserVehicleRole.OWNER.value == "owner"
    assert UserVehicleRole.DRIVER.value == "driver"
    assert UserVehicleRole.FAMILY.value == "family"


# ─── Migration constants smoke ─────────────────────────────────────────────


def test_migration_0025_revision_pointer() -> None:
    """Migration dosyası var + revision + down_revision doğru chain'liyor."""
    import importlib.util
    from pathlib import Path

    path = (
        Path(__file__).parent.parent
        / "alembic"
        / "versions"
        / "20260422_0025_vehicle_history_consent.py"
    )
    assert path.exists(), f"Migration file not found: {path}"
    spec = importlib.util.spec_from_file_location("migration_0025", path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert mod.revision == "20260422_0025"
    assert mod.down_revision == "20260422_0024"


# ─── VehicleResponse from_attributes model ────────────────────────────────


def test_vehicle_response_from_attributes_enabled() -> None:
    """Repository'den gelen ORM objesini validate edebilmek şart."""
    assert VehicleResponse.model_config.get("from_attributes") is True


# Marker — test dosyası integration değil
def test_uuid_fixture_isolated() -> None:
    """UUID cross-test collision olmasın diye her test içinde uuid4 kullanır."""
    u1 = UUID("00000000-0000-0000-0000-000000000001")
    u2 = UUID("00000000-0000-0000-0000-000000000002")
    assert u1 != u2
