"""ServiceRequestDraftCreate kind-bazlı Pydantic validator testleri (§6.2).

Pure helper — DB yok. Happy path + sad path per kind.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.case import (
    ServiceRequestKind,
    ServiceRequestUrgency,
    TowEquipment,
    TowIncidentReason,
    TowMode,
)
from app.schemas.service_request import (
    AccidentReportMethod,
    BreakdownCategory,
    DamageSeverity,
    LatLng,
    MaintenanceCategory,
    ServicePickupPreference,
    ServiceRequestDraftCreate,
)


def _base(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "kind": ServiceRequestKind.MAINTENANCE,
        "vehicle_id": uuid4(),
        "urgency": ServiceRequestUrgency.PLANNED,
        "summary": "Periyodik bakım",
        "location_label": "İstanbul, Kadıköy",
        "maintenance_category": MaintenanceCategory.PERIODIC,
    }
    base.update(overrides)
    return base


# ─── Accident ─────────────────────────────────────────────────────────────


def test_accident_happy_path() -> None:
    draft = ServiceRequestDraftCreate(
        kind=ServiceRequestKind.ACCIDENT,
        vehicle_id=uuid4(),
        urgency=ServiceRequestUrgency.URGENT,
        summary="Ön arabaya çarptım",
        location_label="Bağdat Cd.",
        location_lat_lng=LatLng(lat=40.98, lng=29.05),
        counterparty_vehicle_count=1,
        counterparty_note="1 araç",
        damage_area="ön sağ",
        damage_severity=DamageSeverity.MODERATE,
        report_method=AccidentReportMethod.PAPER,
        emergency_acknowledged=True,
    )
    assert draft.damage_severity == DamageSeverity.MODERATE


def test_accident_missing_damage_severity_rejected() -> None:
    with pytest.raises(ValidationError, match="damage_severity"):
        ServiceRequestDraftCreate(
            kind=ServiceRequestKind.ACCIDENT,
            vehicle_id=uuid4(),
            urgency=ServiceRequestUrgency.URGENT,
            summary="Kaza",
            location_label="Yer",
            counterparty_vehicle_count=0,
            damage_area="ön",
            report_method=AccidentReportMethod.PAPER,
            emergency_acknowledged=True,
        )


def test_accident_counterparty_requires_note() -> None:
    with pytest.raises(ValidationError, match="counterparty_note"):
        ServiceRequestDraftCreate(
            kind=ServiceRequestKind.ACCIDENT,
            vehicle_id=uuid4(),
            urgency=ServiceRequestUrgency.URGENT,
            summary="Kaza",
            location_label="Yer",
            counterparty_vehicle_count=2,  # >=1
            # counterparty_note yok
            damage_area="ön",
            damage_severity=DamageSeverity.MINOR,
            report_method=AccidentReportMethod.PAPER,
            emergency_acknowledged=True,
        )


def test_accident_kasko_requires_brand() -> None:
    with pytest.raises(ValidationError, match="kasko_brand"):
        ServiceRequestDraftCreate(
            kind=ServiceRequestKind.ACCIDENT,
            vehicle_id=uuid4(),
            urgency=ServiceRequestUrgency.URGENT,
            summary="Kaza",
            location_label="Yer",
            counterparty_vehicle_count=0,
            damage_area="ön",
            damage_severity=DamageSeverity.MINOR,
            report_method=AccidentReportMethod.PAPER,
            emergency_acknowledged=True,
            kasko_selected=True,
            # kasko_brand yok
        )


def test_accident_forbidden_fields_rejected() -> None:
    with pytest.raises(ValidationError, match="breakdown_category"):
        ServiceRequestDraftCreate(
            kind=ServiceRequestKind.ACCIDENT,
            vehicle_id=uuid4(),
            urgency=ServiceRequestUrgency.URGENT,
            summary="Kaza",
            location_label="Yer",
            counterparty_vehicle_count=0,
            damage_area="ön",
            damage_severity=DamageSeverity.MINOR,
            report_method=AccidentReportMethod.PAPER,
            emergency_acknowledged=True,
            breakdown_category=BreakdownCategory.ENGINE,  # YASAK
        )


# ─── Breakdown ────────────────────────────────────────────────────────────


def test_breakdown_happy_path() -> None:
    draft = ServiceRequestDraftCreate(
        kind=ServiceRequestKind.BREAKDOWN,
        vehicle_id=uuid4(),
        urgency=ServiceRequestUrgency.TODAY,
        summary="Motor çalışmıyor",
        location_label="İstanbul",
        breakdown_category=BreakdownCategory.ENGINE,
        symptoms=["motor sesi", "uyarı ışığı"],
        on_site_repair=True,
    )
    assert draft.breakdown_category == BreakdownCategory.ENGINE


def test_breakdown_missing_symptoms_rejected() -> None:
    with pytest.raises(ValidationError, match="symptoms"):
        ServiceRequestDraftCreate(
            kind=ServiceRequestKind.BREAKDOWN,
            vehicle_id=uuid4(),
            urgency=ServiceRequestUrgency.TODAY,
            summary="Arıza",
            location_label="İstanbul",
            breakdown_category=BreakdownCategory.ENGINE,
            symptoms=[],
        )


def test_breakdown_kasko_field_rejected() -> None:
    with pytest.raises(ValidationError, match="kasko_selected"):
        ServiceRequestDraftCreate(
            kind=ServiceRequestKind.BREAKDOWN,
            vehicle_id=uuid4(),
            urgency=ServiceRequestUrgency.TODAY,
            summary="Arıza",
            location_label="İstanbul",
            breakdown_category=BreakdownCategory.ENGINE,
            symptoms=["motor"],
            kasko_selected=True,  # YASAK
            kasko_brand="Allianz",
        )


# ─── Maintenance ──────────────────────────────────────────────────────────


def test_maintenance_happy_path() -> None:
    draft = ServiceRequestDraftCreate(**_base())
    assert draft.maintenance_category == MaintenanceCategory.PERIODIC


def test_maintenance_missing_category_rejected() -> None:
    with pytest.raises(ValidationError, match="maintenance_category"):
        ServiceRequestDraftCreate(
            kind=ServiceRequestKind.MAINTENANCE,
            vehicle_id=uuid4(),
            urgency=ServiceRequestUrgency.PLANNED,
            summary="Bakım",
            location_label="Yer",
            # maintenance_category yok
        )


def test_maintenance_damage_area_rejected() -> None:
    with pytest.raises(ValidationError, match="damage_area"):
        ServiceRequestDraftCreate(**_base(damage_area="ön sağ"))


# ─── Towing ───────────────────────────────────────────────────────────────


def test_towing_happy_path() -> None:
    draft = ServiceRequestDraftCreate(
        kind=ServiceRequestKind.TOWING,
        vehicle_id=uuid4(),
        urgency=ServiceRequestUrgency.URGENT,
        summary="Aracım arızalı",
        location_label="E5",
        location_lat_lng=LatLng(lat=41.0, lng=29.0),
        dropoff_label="Kadıköy Servisi",
        vehicle_drivable=False,
        tow_mode=TowMode.IMMEDIATE,
        tow_incident_reason=TowIncidentReason.NOT_RUNNING,
        tow_required_equipment=[TowEquipment.FLATBED],
        tow_fare_quote={"cap_amount": "1800.00"},
    )
    assert draft.tow_mode == TowMode.IMMEDIATE


def test_towing_missing_dropoff_rejected() -> None:
    with pytest.raises(ValidationError, match="dropoff_label"):
        ServiceRequestDraftCreate(
            kind=ServiceRequestKind.TOWING,
            vehicle_id=uuid4(),
            urgency=ServiceRequestUrgency.URGENT,
            summary="Çekici",
            location_label="Yol",
            location_lat_lng=LatLng(lat=41, lng=29),
            vehicle_drivable=False,
            tow_mode=TowMode.IMMEDIATE,
            tow_incident_reason=TowIncidentReason.NOT_RUNNING,
            tow_fare_quote={"cap_amount": "1800.00"},
        )


def test_towing_pickup_preference_rejected() -> None:
    with pytest.raises(ValidationError, match=r"pickup_preference|valet_requested|on_site_repair"):
        ServiceRequestDraftCreate(
            kind=ServiceRequestKind.TOWING,
            vehicle_id=uuid4(),
            urgency=ServiceRequestUrgency.URGENT,
            summary="Çekici",
            location_label="Yol",
            vehicle_drivable=False,
            dropoff_label="Servis",
            tow_mode=TowMode.IMMEDIATE,
            tow_incident_reason=TowIncidentReason.NOT_RUNNING,
            pickup_preference=ServicePickupPreference.VALET,  # YASAK
        )


def test_towing_scheduled_requires_scheduled_at() -> None:
    with pytest.raises(ValidationError, match="tow_scheduled_at"):
        ServiceRequestDraftCreate(
            kind=ServiceRequestKind.TOWING,
            vehicle_id=uuid4(),
            urgency=ServiceRequestUrgency.PLANNED,
            summary="Çekici",
            location_label="Yol",
            vehicle_drivable=False,
            dropoff_label="Servis",
            tow_mode=TowMode.SCHEDULED,
            tow_incident_reason=TowIncidentReason.NOT_RUNNING,
        )


# ─── LatLng validator ─────────────────────────────────────────────────────


def test_latlng_out_of_range_rejected() -> None:
    with pytest.raises(ValidationError, match="lat"):
        LatLng(lat=91.0, lng=0.0)
    with pytest.raises(ValidationError, match="lng"):
        LatLng(lat=0.0, lng=181.0)
