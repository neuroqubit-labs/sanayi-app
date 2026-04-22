"""PR 4 Gün 3 — mutation schema + value object pure tests."""

from __future__ import annotations

from datetime import datetime, time
from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.api.v1.routes.technicians import (
    BrandBindingPayload,
    CapacityPayload,
    CertResubmitPayload,
    CertSubmitPayload,
    CoveragePayload,
    ProcedureBindingPayload,
    ProviderModePayload,
    SchedulePayload,
    ScheduleSlotPayload,
    ServiceAreaPayload,
    SwitchActiveRolePayload,
)
from app.models.technician import (
    ProviderMode,
    ProviderType,
    TechnicianCertificateKind,
)

# ─── Coverage payload ──────────────────────────────────────────────────────


def test_coverage_payload_empty_default() -> None:
    p = CoveragePayload()
    assert p.service_domains == []
    assert p.procedures == []
    assert p.brand_coverage == []


def test_coverage_payload_happy() -> None:
    p = CoveragePayload(
        service_domains=["motor", "fren"],
        procedures=[
            ProcedureBindingPayload(
                procedure_key="yag_bakimi",
                confidence_self_declared=Decimal("0.90"),
            )
        ],
        procedure_tags=["bmw uzmanı", "turbo motor"],
        brand_coverage=[
            BrandBindingPayload(brand_key="bmw", is_authorized=True),
        ],
        drivetrain_coverage=["benzin_otomatik"],
    )
    assert len(p.service_domains) == 2
    assert p.procedures[0].confidence_self_declared == Decimal("0.90")


def test_coverage_payload_extra_forbid() -> None:
    with pytest.raises(ValidationError):
        CoveragePayload(extra_field=True)  # type: ignore[call-arg]


def test_procedure_binding_empty_key_rejected() -> None:
    with pytest.raises(ValidationError):
        ProcedureBindingPayload(procedure_key="")


# ─── Service area payload ──────────────────────────────────────────────────


def test_service_area_happy() -> None:
    p = ServiceAreaPayload(
        workshop_lat=Decimal("41.0082"),
        workshop_lng=Decimal("28.9784"),
        service_radius_km=20,
        city_code="34",
        working_districts=[uuid4(), uuid4()],
    )
    assert p.service_radius_km == 20
    assert p.city_code == "34"


def test_service_area_lat_out_of_range() -> None:
    with pytest.raises(ValidationError):
        ServiceAreaPayload(
            workshop_lat=Decimal("91"),
            workshop_lng=Decimal("0"),
            city_code="34",
        )


def test_service_area_radius_min() -> None:
    with pytest.raises(ValidationError):
        ServiceAreaPayload(
            workshop_lat=Decimal("41"),
            workshop_lng=Decimal("29"),
            service_radius_km=0,
            city_code="34",
        )


def test_service_area_radius_max() -> None:
    with pytest.raises(ValidationError):
        ServiceAreaPayload(
            workshop_lat=Decimal("41"),
            workshop_lng=Decimal("29"),
            service_radius_km=501,
            city_code="34",
        )


# ─── Schedule payload ──────────────────────────────────────────────────────


def test_schedule_slot_weekday_range() -> None:
    with pytest.raises(ValidationError):
        ScheduleSlotPayload(weekday=7)


def test_schedule_slot_happy_closed_day() -> None:
    s = ScheduleSlotPayload(weekday=6, is_closed=True)
    assert s.is_closed is True


def test_schedule_slot_happy_open_day() -> None:
    s = ScheduleSlotPayload(
        weekday=0, open_time=time(9, 0), close_time=time(18, 0)
    )
    assert s.weekday == 0


def test_schedule_payload_empty() -> None:
    p = SchedulePayload()
    assert p.slots == []


def test_schedule_payload_multi_slot_same_day() -> None:
    """Öğle molası: slot_order 0 ve 1."""
    p = SchedulePayload(
        slots=[
            ScheduleSlotPayload(
                weekday=0, open_time=time(9, 0), close_time=time(12, 0),
                slot_order=0,
            ),
            ScheduleSlotPayload(
                weekday=0, open_time=time(13, 0), close_time=time(18, 0),
                slot_order=1,
            ),
        ]
    )
    assert len(p.slots) == 2


# ─── Capacity payload ─────────────────────────────────────────────────────


def test_capacity_defaults() -> None:
    p = CapacityPayload()
    assert p.staff_count == 1
    assert p.max_concurrent_jobs == 3
    assert p.night_service is False


def test_capacity_staff_max() -> None:
    with pytest.raises(ValidationError):
        CapacityPayload(staff_count=51)


def test_capacity_concurrent_max() -> None:
    with pytest.raises(ValidationError):
        CapacityPayload(max_concurrent_jobs=101)


# ─── Provider mode payload ────────────────────────────────────────────────


def test_provider_mode_accepts_business() -> None:
    p = ProviderModePayload(mode=ProviderMode.BUSINESS)
    assert p.mode == ProviderMode.BUSINESS


def test_provider_mode_rejects_side_gig() -> None:
    """I-PR4-11 — side_gig V1 scope dışı, enum değeri yok."""
    with pytest.raises(ValidationError):
        ProviderModePayload(mode="side_gig")  # type: ignore[arg-type]


def test_provider_mode_extra_forbid() -> None:
    with pytest.raises(ValidationError):
        ProviderModePayload(mode=ProviderMode.INDIVIDUAL, extra=True)  # type: ignore[call-arg]


# ─── Switch active role ───────────────────────────────────────────────────


def test_switch_active_role_happy() -> None:
    p = SwitchActiveRolePayload(target_provider_type=ProviderType.CEKICI)
    assert p.target_provider_type == ProviderType.CEKICI


def test_switch_active_role_invalid_enum() -> None:
    with pytest.raises(ValidationError):
        SwitchActiveRolePayload(target_provider_type="ghost")  # type: ignore[arg-type]


# ─── Cert submit + resubmit ────────────────────────────────────────────────


def test_cert_submit_happy() -> None:
    p = CertSubmitPayload(
        kind=TechnicianCertificateKind.TOW_OPERATOR,
        title="SRC-5 Belgesi",
        media_asset_id=uuid4(),
    )
    assert p.kind == TechnicianCertificateKind.TOW_OPERATOR


def test_cert_submit_with_expiry() -> None:
    p = CertSubmitPayload(
        kind=TechnicianCertificateKind.INSURANCE,
        title="Sigorta",
        expires_at=datetime(2027, 1, 1),
    )
    assert p.expires_at == datetime(2027, 1, 1)


def test_cert_submit_empty_title_rejected() -> None:
    with pytest.raises(ValidationError):
        CertSubmitPayload(
            kind=TechnicianCertificateKind.IDENTITY, title=""
        )


def test_cert_resubmit_requires_media_asset() -> None:
    with pytest.raises(ValidationError):
        CertResubmitPayload()  # type: ignore[call-arg]


def test_cert_resubmit_title_optional() -> None:
    p = CertResubmitPayload(media_asset_id=uuid4())
    assert p.title is None
