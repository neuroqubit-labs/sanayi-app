"""Pure route/schema checks for service-app live case migration."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.v1.router import api_router
from app.api.v1.routes.cases import CaseEvidencePayload, StatusUpdatePayload
from app.api.v1.routes import technicians
from app.models.case_artifact import CaseAttachmentKind
from app.models.case import ServiceRequestKind
from app.models.insurance_claim import InsuranceClaimStatus, InsuranceCoverageKind
from app.schemas.insurance_claim import InsuranceClaimSubmit


def test_service_live_case_routes_are_registered() -> None:
    paths = {route.path for route in api_router.routes}
    assert "/technicians/me/cases" in paths
    assert "/technicians/me/insurance-claims" in paths
    assert "/cases/{case_id}/status-updates" in paths
    assert "/cases/{case_id}/evidence" in paths


def test_status_update_payload_rejects_empty_note() -> None:
    with pytest.raises(ValidationError):
        StatusUpdatePayload(note="")


def test_evidence_payload_defaults_are_technician_friendly() -> None:
    payload = CaseEvidencePayload(
        title="Teslim öncesi fotoğraf",
        kind=CaseAttachmentKind.PHOTO,
    )
    assert payload.source_label == "Usta uygulaması"
    assert payload.status_label == "Yüklendi"
    assert payload.media_asset_id is None


def test_evidence_payload_rejects_extra_fields() -> None:
    with pytest.raises(ValidationError):
        CaseEvidencePayload(
            title="Fotoğraf",
            kind=CaseAttachmentKind.PHOTO,
            private_note="leak",  # type: ignore[call-arg]
        )


def _claim_payload(case_id):
    return InsuranceClaimSubmit(
        case_id=case_id,
        policy_number="AX-42",
        insurer="Axa",
        coverage_kind=InsuranceCoverageKind.KASKO,
        estimate_amount=Decimal("12000"),
    )


def _fake_case(*, case_id, technician_id, kind=ServiceRequestKind.ACCIDENT):
    return SimpleNamespace(
        id=case_id,
        deleted_at=None,
        assigned_technician_id=technician_id,
        kind=kind,
    )


@pytest.mark.asyncio
async def test_technician_insurance_claim_rejects_unassigned_case(monkeypatch) -> None:
    case_id = uuid4()
    technician_id = uuid4()
    other_technician_id = uuid4()

    async def fake_get_case(_db, _case_id):
        return _fake_case(case_id=case_id, technician_id=other_technician_id)

    monkeypatch.setattr(technicians.case_repo, "get_case", fake_get_case)

    with pytest.raises(HTTPException) as exc:
        await technicians.submit_me_insurance_claim(
            _claim_payload(case_id),
            SimpleNamespace(id=technician_id),
            SimpleNamespace(),
        )

    assert exc.value.status_code == 403
    assert exc.value.detail == {"type": "not_assigned_technician"}


@pytest.mark.asyncio
async def test_technician_insurance_claim_rejects_non_accident(monkeypatch) -> None:
    case_id = uuid4()
    technician_id = uuid4()

    async def fake_get_case(_db, _case_id):
        return _fake_case(
            case_id=case_id,
            technician_id=technician_id,
            kind=ServiceRequestKind.MAINTENANCE,
        )

    monkeypatch.setattr(technicians.case_repo, "get_case", fake_get_case)

    with pytest.raises(HTTPException) as exc:
        await technicians.submit_me_insurance_claim(
            _claim_payload(case_id),
            SimpleNamespace(id=technician_id),
            SimpleNamespace(),
        )

    assert exc.value.status_code == 422
    assert exc.value.detail == {"type": "case_kind_not_accident"}


@pytest.mark.asyncio
async def test_technician_insurance_claim_maps_duplicate_to_409(monkeypatch) -> None:
    case_id = uuid4()
    technician_id = uuid4()

    async def fake_get_case(_db, _case_id):
        return _fake_case(case_id=case_id, technician_id=technician_id)

    async def fake_profile(_db, _user_id):
        return SimpleNamespace(display_name="Volkan Usta")

    async def fake_submit_claim(*_args, **_kwargs):
        raise technicians.claim_flow.ClaimAlreadyActiveError("duplicate")

    monkeypatch.setattr(technicians.case_repo, "get_case", fake_get_case)
    monkeypatch.setattr(technicians, "_get_profile_for_user", fake_profile)
    monkeypatch.setattr(technicians.claim_flow, "submit_claim", fake_submit_claim)

    with pytest.raises(HTTPException) as exc:
        await technicians.submit_me_insurance_claim(
            _claim_payload(case_id),
            SimpleNamespace(id=technician_id),
            SimpleNamespace(commit=AsyncMock(), refresh=AsyncMock()),
        )

    assert exc.value.status_code == 409
    assert exc.value.detail == {"type": "claim_already_active"}


@pytest.mark.asyncio
async def test_technician_insurance_claim_happy_path(monkeypatch) -> None:
    case_id = uuid4()
    claim_id = uuid4()
    technician_id = uuid4()
    now = datetime.now(UTC)

    async def fake_get_case(_db, _case_id):
        return _fake_case(case_id=case_id, technician_id=technician_id)

    async def fake_profile(_db, _user_id):
        return SimpleNamespace(display_name="Volkan Usta")

    async def fake_submit_claim(*_args, **_kwargs):
        return SimpleNamespace(
            id=claim_id,
            case_id=case_id,
            policy_number="AX-42",
            insurer="Axa",
            coverage_kind=InsuranceCoverageKind.KASKO,
            insurer_claim_reference=None,
            status=InsuranceClaimStatus.SUBMITTED,
            estimate_amount=Decimal("12000"),
            accepted_amount=None,
            paid_amount=None,
            currency="TRY",
            policy_holder_name=None,
            policy_holder_phone=None,
            submitted_at=now,
            accepted_at=None,
            paid_at=None,
            rejected_at=None,
            rejection_reason=None,
            created_by_user_id=technician_id,
            created_by_snapshot_name="Volkan Usta",
            notes=None,
            created_at=now,
            updated_at=now,
        )

    db = SimpleNamespace(commit=AsyncMock(), refresh=AsyncMock())
    monkeypatch.setattr(technicians.case_repo, "get_case", fake_get_case)
    monkeypatch.setattr(technicians, "_get_profile_for_user", fake_profile)
    monkeypatch.setattr(technicians.claim_flow, "submit_claim", fake_submit_claim)

    response = await technicians.submit_me_insurance_claim(
        _claim_payload(case_id),
        SimpleNamespace(id=technician_id),
        db,
    )

    assert response.id == claim_id
    assert response.case_id == case_id
    assert response.status == InsuranceClaimStatus.SUBMITTED
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once()
