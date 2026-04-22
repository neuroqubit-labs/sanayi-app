"""PR 7 pure tests — insurance_claims router contract + error mapping.

Schema validation + state machine contract + exception class wiring.
DB-bağımlı integration testler ayrı job'a; burada pure.
"""

from __future__ import annotations

from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.case_audit import CaseEventType
from app.models.insurance_claim import (
    ACTIVE_CLAIM_STATUSES,
    TERMINAL_CLAIM_STATUSES,
    InsuranceClaimStatus,
    InsuranceCoverageKind,
)
from app.schemas.insurance_claim import (
    InsuranceClaimAcceptRequest,
    InsuranceClaimPayOutRequest,
    InsuranceClaimRejectRequest,
    InsuranceClaimSubmit,
)
from app.services import insurance_claim_flow as claim_flow

# ─── InsuranceClaimSubmit ──────────────────────────────────────────────────


def test_submit_minimal_required() -> None:
    payload = InsuranceClaimSubmit(
        case_id=uuid4(),
        policy_number="POL-123",
        insurer="Allianz",
        coverage_kind=InsuranceCoverageKind.KASKO,
    )
    assert payload.currency == "TRY"
    assert payload.estimate_amount is None


def test_submit_full_fields() -> None:
    payload = InsuranceClaimSubmit(
        case_id=uuid4(),
        policy_number="POL-X",
        insurer="Axa",
        coverage_kind=InsuranceCoverageKind.TRAFIK,
        estimate_amount=Decimal("12500.50"),
        policy_holder_name="Ali Veli",
        policy_holder_phone="+905551234567",
        currency="EUR",
        notes="ikinci kaza",
        insurer_claim_reference="AXA-42",
    )
    assert payload.coverage_kind == InsuranceCoverageKind.TRAFIK
    assert payload.currency == "EUR"


def test_submit_rejects_negative_estimate() -> None:
    with pytest.raises(ValidationError):
        InsuranceClaimSubmit(
            case_id=uuid4(),
            policy_number="X",
            insurer="Y",
            coverage_kind=InsuranceCoverageKind.KASKO,
            estimate_amount=Decimal("-1"),
        )


def test_submit_rejects_extra_field() -> None:
    with pytest.raises(ValidationError):
        InsuranceClaimSubmit(
            case_id=uuid4(),
            policy_number="X",
            insurer="Y",
            coverage_kind=InsuranceCoverageKind.KASKO,
            hacker="leak",  # type: ignore[call-arg]
        )


# ─── Accept / Reject / PayOut request schemas ─────────────────────────────


def test_accept_request_minimal() -> None:
    req = InsuranceClaimAcceptRequest(accepted_amount=Decimal("10000"))
    assert req.insurer_claim_reference is None


def test_accept_request_rejects_negative() -> None:
    with pytest.raises(ValidationError):
        InsuranceClaimAcceptRequest(accepted_amount=Decimal("-1"))


def test_reject_request_requires_reason() -> None:
    with pytest.raises(ValidationError):
        InsuranceClaimRejectRequest()  # type: ignore[call-arg]


def test_reject_request_min_length() -> None:
    with pytest.raises(ValidationError):
        InsuranceClaimRejectRequest(reason="")


def test_payout_request_optional_amount() -> None:
    req = InsuranceClaimPayOutRequest()
    assert req.paid_amount is None


def test_payout_request_rejects_negative() -> None:
    with pytest.raises(ValidationError):
        InsuranceClaimPayOutRequest(paid_amount=Decimal("-5"))


# ─── State machine contract ───────────────────────────────────────────────


def test_active_claim_statuses_match_brief() -> None:
    """Brief §8.3 [K3]: aktif = submitted, accepted, paid."""
    expected = frozenset(
        {
            InsuranceClaimStatus.SUBMITTED,
            InsuranceClaimStatus.ACCEPTED,
            InsuranceClaimStatus.PAID,
        }
    )
    assert expected == ACTIVE_CLAIM_STATUSES


def test_terminal_claim_statuses() -> None:
    expected = frozenset(
        {InsuranceClaimStatus.PAID, InsuranceClaimStatus.REJECTED}
    )
    assert expected == TERMINAL_CLAIM_STATUSES


def test_allowed_transitions_shape() -> None:
    """submitted→{accepted,rejected}; accepted→{paid,rejected}; paid/rejected terminal."""
    t = claim_flow.ALLOWED_TRANSITIONS
    assert t[InsuranceClaimStatus.SUBMITTED] == {
        InsuranceClaimStatus.ACCEPTED,
        InsuranceClaimStatus.REJECTED,
    }
    assert t[InsuranceClaimStatus.ACCEPTED] == {
        InsuranceClaimStatus.PAID,
        InsuranceClaimStatus.REJECTED,
    }
    assert t[InsuranceClaimStatus.PAID] == set()
    assert t[InsuranceClaimStatus.REJECTED] == set()


# ─── Service exception class wiring ───────────────────────────────────────


def test_exceptions_exported() -> None:
    """Router error mapping service exception class'larını bekliyor."""
    assert issubclass(claim_flow.ClaimNotFoundError, LookupError)
    assert issubclass(claim_flow.ClaimAlreadyActiveError, ValueError)
    assert issubclass(claim_flow.InvalidClaimTransitionError, ValueError)


def test_invalid_transition_error_message() -> None:
    exc = claim_flow.InvalidClaimTransitionError(
        InsuranceClaimStatus.PAID, InsuranceClaimStatus.ACCEPTED
    )
    assert "paid" in str(exc)
    assert "accepted" in str(exc)


# ─── Audit event type contract ────────────────────────────────────────────


def test_case_event_types_insurance_exist() -> None:
    assert CaseEventType.INSURANCE_CLAIM_SUBMITTED.value == "insurance_claim_submitted"
    assert CaseEventType.INSURANCE_CLAIM_ACCEPTED.value == "insurance_claim_accepted"
    assert CaseEventType.INSURANCE_CLAIM_PAID.value == "insurance_claim_paid"
    assert CaseEventType.INSURANCE_CLAIM_REJECTED.value == "insurance_claim_rejected"


# ─── Coverage kind enum ───────────────────────────────────────────────────


def test_coverage_kind_values() -> None:
    assert InsuranceCoverageKind.KASKO.value == "kasko"
    assert InsuranceCoverageKind.TRAFIK.value == "trafik"


# ─── Router count smoke (deferred — integration fixture yok) ──────────────


def test_router_module_importable() -> None:
    """Router dosyası collect edilebiliyor + 2 instance tanımlı."""
    from app.api.v1.routes import insurance_claims as module

    assert hasattr(module, "customer_router")
    assert hasattr(module, "admin_router")
    assert module.customer_router.prefix == "/insurance-claims"
    assert module.admin_router.prefix == "/admin/insurance-claims"
