from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.v1.routes import approvals
from app.models.case import ServiceCaseStatus
from app.models.case_process import CaseApprovalKind


def _approval_payload() -> approvals.ApprovalRequestPayload:
    return approvals.ApprovalRequestPayload(
        kind=CaseApprovalKind.PARTS_REQUEST,
        title="Parça onayı",
        description="Ön takım parçası değişmeli.",
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "case_status",
    (
        ServiceCaseStatus.COMPLETED,
        ServiceCaseStatus.CANCELLED,
        ServiceCaseStatus.ARCHIVED,
    ),
)
async def test_approval_request_rejects_terminal_case(
    monkeypatch: pytest.MonkeyPatch,
    case_status: ServiceCaseStatus,
) -> None:
    technician_id = uuid4()
    case = SimpleNamespace(
        id=uuid4(),
        assigned_technician_id=technician_id,
        status=case_status,
    )
    monkeypatch.setattr(
        approvals, "_load_case_or_404", AsyncMock(return_value=case)
    )
    request_approval = AsyncMock()
    monkeypatch.setattr(
        approvals.approval_flow, "request_approval", request_approval
    )

    with pytest.raises(HTTPException) as exc_info:
        await approvals.request_approval_endpoint(
            case.id,
            _approval_payload(),
            SimpleNamespace(id=technician_id, full_name="Volkan Usta"),
            SimpleNamespace(),
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == {
        "type": "case_terminal",
        "status": case_status.value,
    }
    request_approval.assert_not_awaited()


@pytest.mark.asyncio
async def test_approval_request_allows_service_in_progress(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    technician_id = uuid4()
    case = SimpleNamespace(
        id=uuid4(),
        assigned_technician_id=technician_id,
        status=ServiceCaseStatus.SERVICE_IN_PROGRESS,
    )
    approval = SimpleNamespace(id=uuid4())
    response = SimpleNamespace(id=approval.id)
    db = SimpleNamespace(commit=AsyncMock(), rollback=AsyncMock())
    monkeypatch.setattr(
        approvals, "_load_case_or_404", AsyncMock(return_value=case)
    )
    monkeypatch.setattr(
        approvals.approval_flow,
        "request_approval",
        AsyncMock(return_value=approval),
    )
    monkeypatch.setattr(
        approvals, "_build_response", AsyncMock(return_value=response)
    )

    result = await approvals.request_approval_endpoint(
        case.id,
        _approval_payload(),
        SimpleNamespace(id=technician_id, full_name="Volkan Usta"),
        db,
    )

    assert result == response
    db.commit.assert_awaited_once()
