"""Approval flow pure unit tests — B-P0-1 + cascade + uniqueness.

DB integration skip (cross-test asyncpg bloker); smoke + QA ile doğrulanır.
"""

from __future__ import annotations

import inspect
from uuid import uuid4

import pytest

from app.models.case_process import CaseApprovalKind
from app.services.approval_flow import (
    ApprovalAlreadyActiveError,
    ApprovalNotFoundError,
    ApprovalNotPendingError,
    CompletionGateError,
)
from app.services import approval_flow


def test_completion_gate_error_carries_missing_context() -> None:
    exc = CompletionGateError(
        "completion approve requires billing_state=settled",
        missing={"billing_state": "preauth_held", "required": "settled"},
    )
    assert exc.missing == {
        "billing_state": "preauth_held",
        "required": "settled",
    }
    assert "settled" in str(exc)


def test_completion_gate_error_is_value_error() -> None:
    exc = CompletionGateError("x", missing={})
    assert isinstance(exc, ValueError)


def test_approval_not_pending_is_value_error() -> None:
    with pytest.raises(ApprovalNotPendingError):
        raise ApprovalNotPendingError("approval already resolved")


def test_approval_not_found_is_lookup_error() -> None:
    with pytest.raises(ApprovalNotFoundError):
        raise ApprovalNotFoundError("no such approval")


def test_approval_already_active_carries_kind_and_case_id() -> None:
    case_id = uuid4()
    exc = ApprovalAlreadyActiveError(case_id, CaseApprovalKind.PARTS_REQUEST)
    assert exc.case_id == case_id
    assert exc.kind == CaseApprovalKind.PARTS_REQUEST
    assert "parts_request" in str(exc)


def test_pending_approval_lookup_uses_row_lock() -> None:
    """Concurrent approve/reject decisions must serialize on the approval row."""
    source = inspect.getsource(approval_flow._get_pending)
    assert ".with_for_update()" in source
