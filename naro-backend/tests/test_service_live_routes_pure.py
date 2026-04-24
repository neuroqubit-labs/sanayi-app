"""Pure route/schema checks for service-app live case migration."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.api.v1.router import api_router
from app.api.v1.routes.cases import CaseEvidencePayload, StatusUpdatePayload
from app.models.case_artifact import CaseAttachmentKind


def test_service_live_case_routes_are_registered() -> None:
    paths = {route.path for route in api_router.routes}
    assert "/technicians/me/cases" in paths
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
