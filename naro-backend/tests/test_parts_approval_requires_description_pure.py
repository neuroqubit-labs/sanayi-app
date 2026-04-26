from __future__ import annotations

import inspect

import pytest
from pydantic import ValidationError

from app.api.v1.routes.approvals import ApprovalRequestPayload
from app.models.case_process import CaseApprovalKind
from app.services import case_billing


def _payload(
    *,
    kind: CaseApprovalKind,
    description: str | None,
) -> dict[str, object]:
    return {
        "kind": kind,
        "title": "Onay talebi",
        "description": description,
    }


@pytest.mark.parametrize(
    "description",
    (
        None,
        "kısa",
    ),
)
def test_parts_request_requires_description_min_10_chars(
    description: str | None,
) -> None:
    with pytest.raises(ValidationError) as exc_info:
        ApprovalRequestPayload.model_validate(
            _payload(
                kind=CaseApprovalKind.PARTS_REQUEST,
                description=description,
            )
        )

    assert "description_required_min_10_chars" in str(exc_info.value)


def test_parts_request_accepts_detailed_description() -> None:
    payload = ApprovalRequestPayload.model_validate(
        _payload(
            kind=CaseApprovalKind.PARTS_REQUEST,
            description="Detaylı kapsam değişikliği gerekçesi",
        )
    )

    assert payload.kind == CaseApprovalKind.PARTS_REQUEST


def test_invoice_requires_description() -> None:
    with pytest.raises(ValidationError) as exc_info:
        ApprovalRequestPayload.model_validate(
            _payload(kind=CaseApprovalKind.INVOICE, description=None)
        )

    assert "description_required_min_10_chars" in str(exc_info.value)


def test_completion_allows_missing_description() -> None:
    payload = ApprovalRequestPayload.model_validate(
        _payload(kind=CaseApprovalKind.COMPLETION, description=None)
    )

    assert payload.kind == CaseApprovalKind.COMPLETION
    assert payload.description is None


def test_parts_approval_billing_uses_revision_amount_name() -> None:
    params = inspect.signature(case_billing.handle_parts_approval).parameters

    assert "revision_amount" in params
    assert "additional_amount" not in params
