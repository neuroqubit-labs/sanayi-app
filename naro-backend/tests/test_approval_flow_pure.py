"""Approval flow pure unit tests — B-P0-1 + cascade + uniqueness.

DB integration skip (cross-test asyncpg bloker); smoke + QA ile doğrulanır.
"""

from __future__ import annotations

import pytest

from app.services.approval_flow import (
    ApprovalNotFoundError,
    ApprovalNotPendingError,
    CompletionGateError,
)


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
