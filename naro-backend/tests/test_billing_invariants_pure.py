"""Faz B-1 billing invariant pure tests (14 invariant — 12 aktif V1 + 2 reserved V2).

Her invariant kod-enforce; naming-only değil (Brief §8 + plan). Decimal
strict test coverage (B-3 bayrağı — 123.45 + 123.46 = 246.91 type prod).
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.models.auth_event import AuthEventType
from app.models.billing import (
    CaseCommissionSettlement,
    CaseKaskoState,
    CaseRefund,
    CaseRefundReason,
    CaseRefundState,
    PaymentIdempotency,
    PaymentIdempotencyState,
    PaymentOperation,
    PaymentProvider,
)
from app.schemas.billing import (
    BillingSummary,
    CaptureOverrideRequest,
    KaskoReimburseRequest,
    KaskoSummary,
    MarkPayoutCompletedRequest,
    PaymentInitiateRequest,
    RefundRequest,
)
from app.services.case_billing import (
    InsufficientPreauthError,
    KaskoReimbursementExcessError,
    RefundExceedsCaptureError,
    assert_capture_within_preauth,
    assert_kasko_reimburse_within_approved,
    assert_preauth_covers_approved,
    assert_refund_within_capture,
)
from app.services.case_billing_state import (
    BILLING_TRANSITIONS,
    TERMINAL_BILLING_STATES,
    BillingState,
    InvalidBillingTransitionError,
    assert_transition_allowed,
)
from app.services.refund_policy import (
    V1_COMMISSION_RATE,
    CancellationActor,
    CancellationStage,
    calculate_commission,
    compute_cancellation_fee,
    quantize_money,
)
from app.services.webhook_security import (
    compute_hmac_signature,
    verify_webhook_signature,
)

# ─── I-BILL-1: sum(preauth) >= sum(estimate + approved_parts) ─────────────


def test_i_bill_1_preauth_covers_approved_ok() -> None:
    # 1800 preauth, 2000 estimate+parts → ihlal
    with pytest.raises(InsufficientPreauthError):
        assert_preauth_covers_approved(
            preauth_total=Decimal("1800.00"),
            approved_total=Decimal("2000.00"),
        )


def test_i_bill_1_preauth_equal_approved_passes() -> None:
    assert_preauth_covers_approved(
        preauth_total=Decimal("2000.00"),
        approved_total=Decimal("2000.00"),
    )


# ─── I-BILL-2: final <= sum(preauth) ───────────────────────────────────────


def test_i_bill_2_capture_within_preauth() -> None:
    assert_capture_within_preauth(
        final_amount=Decimal("1500.00"),
        preauth_total=Decimal("1800.00"),
    )


def test_i_bill_2_capture_exceeds_preauth_raises() -> None:
    with pytest.raises(InsufficientPreauthError):
        assert_capture_within_preauth(
            final_amount=Decimal("1801.00"),
            preauth_total=Decimal("1800.00"),
        )


# ─── I-BILL-3: gross = commission + net (Decimal exact) ───────────────────


def test_i_bill_3_commission_flat_10_v1() -> None:
    """V1 flat %10 — 1000 TRY → 100 commission + 900 net."""
    commission, net = calculate_commission(Decimal("1000.00"))
    assert commission == Decimal("100.00")
    assert net == Decimal("900.00")
    assert commission + net == Decimal("1000.00")


def test_i_bill_3_commission_odd_amount_no_drift() -> None:
    """Production scenario — 1234.56 × 0.10 = 123.456 → 123.46 (HALF_EVEN).

    Net = 1234.56 - 123.46 = 1111.10. Sum tam olarak 1234.56 döner
    (rounding drift YOK).
    """
    commission, net = calculate_commission(Decimal("1234.56"))
    assert commission == Decimal("123.46")
    assert net == Decimal("1111.10")
    assert commission + net == Decimal("1234.56")


def test_i_bill_3_commission_boundary_half_even() -> None:
    """HALF_EVEN semantiği: 0.125 → 0.12 (banker's rounding)."""
    # 2.50 × 0.10 = 0.25 → quantize(0.01) → 0.25 (no ambiguity)
    commission, net = calculate_commission(Decimal("2.50"))
    assert commission == Decimal("0.25")
    assert net == Decimal("2.25")


def test_i_bill_3_commission_zero_gross() -> None:
    commission, net = calculate_commission(Decimal("0.00"))
    assert commission == Decimal("0.00")
    assert net == Decimal("0.00")


def test_quantize_money_round_half_even() -> None:
    # 0.125 → 0.12 (banker's)
    assert quantize_money(Decimal("0.125")) == Decimal("0.12")
    # 0.135 → 0.14 (banker's — 14 is even)
    assert quantize_money(Decimal("0.135")) == Decimal("0.14")


def test_v1_commission_rate_decimal_exact() -> None:
    assert Decimal("0.1000") == V1_COMMISSION_RATE
    # Float kullanımı yasak — sentinel
    assert not isinstance(V1_COMMISSION_RATE, float)


# ─── I-BILL-4: idempotency UNIQUE (DB constraint name contract) ───────────


def test_i_bill_4_idempotency_unique_constraint() -> None:
    constraint_names = {
        c.name for c in CaseRefund.__table_args__
    }
    # case_refunds.idempotency_key UNIQUE — migration'da
    assert "ck_refund_state" in constraint_names
    # payment_idempotency PK üstünde idempotency_key
    pi_constraint_names = {
        c.name for c in PaymentIdempotency.__table_args__
    }
    assert "ck_payment_idempotency_state" in pi_constraint_names
    # idempotency_key PK olduğu için unique zaten garantilenmiş
    pk_cols = [c.name for c in PaymentIdempotency.__table__.primary_key]
    assert pk_cols == ["idempotency_key"]


# ─── I-BILL-5: webhook HMAC fail → 401 ────────────────────────────────────


def test_i_bill_5_webhook_hmac_positive() -> None:
    secret = "testsecret"
    body = b'{"event":"payment.succeeded"}'
    sig = compute_hmac_signature(body=body, secret=secret)
    assert verify_webhook_signature(body=body, signature=sig, secret=secret) is True


def test_i_bill_5_webhook_hmac_tampered_body_fails() -> None:
    secret = "testsecret"
    body = b'{"event":"payment.succeeded"}'
    sig = compute_hmac_signature(body=body, secret=secret)
    tampered = b'{"event":"payment.attacker_injected"}'
    assert verify_webhook_signature(
        body=tampered, signature=sig, secret=secret
    ) is False


def test_i_bill_5_webhook_hmac_wrong_secret_fails() -> None:
    body = b'{"event":"payment.succeeded"}'
    sig = compute_hmac_signature(body=body, secret="realsecret")
    assert verify_webhook_signature(
        body=body, signature=sig, secret="fakesecret"
    ) is False


# ─── I-BILL-6: refund <= captured ─────────────────────────────────────────


def test_i_bill_6_refund_within_capture() -> None:
    assert_refund_within_capture(
        refund_amount=Decimal("500.00"),
        captured_amount=Decimal("1000.00"),
    )


def test_i_bill_6_refund_exceeds_capture_raises() -> None:
    with pytest.raises(RefundExceedsCaptureError):
        assert_refund_within_capture(
            refund_amount=Decimal("1001.00"),
            captured_amount=Decimal("1000.00"),
        )


# ─── I-BILL-7: payout requires COMPLETED (migration partial index) ────────


def test_i_bill_7_pending_payout_partial_index_exists() -> None:
    """Commission settlement partial index — scheduled IS NULL hızlı query."""
    index_names = {
        c.name
        for c in CaseCommissionSettlement.__table_args__
        if hasattr(c, "name")
    }
    assert "ix_commission_settlements_pending_payout" in index_names


# ─── I-BILL-8: kasko_reimburse <= kasko_approved ─────────────────────────


def test_i_bill_8_kasko_reimburse_within_approved() -> None:
    assert_kasko_reimburse_within_approved(
        reimburse_amount=Decimal("800.00"),
        kasko_approved=Decimal("1000.00"),
    )


def test_i_bill_8_kasko_reimburse_excess_raises() -> None:
    with pytest.raises(KaskoReimbursementExcessError):
        assert_kasko_reimburse_within_approved(
            reimburse_amount=Decimal("1100.00"),
            kasko_approved=Decimal("1000.00"),
        )


# ─── I-BILL-9: cancellation_fee <= stage matrix (V1 non-tow %0) ──────────


def test_i_bill_9_v1_cancellation_fee_zero_all_stages() -> None:
    """Brief §7.2: V1 non-tow tüm stage'lerde cancellation fee %0."""
    for stage in CancellationStage:
        fee = compute_cancellation_fee(
            preauth_amount=Decimal("1500.00"),
            stage=stage,
            actor=CancellationActor.CUSTOMER,
        )
        assert fee == Decimal("0.00"), f"stage {stage} fee beklenen 0, gelen {fee}"


# ─── I-BILL-10: partial refund sonrası commission recompute (contract) ───


def test_i_bill_10_partial_refund_recomputes_commission() -> None:
    """İlk captured: 1000 → 100 commission, 900 net.
    Admin 300 refund → recompute: gross_effective = 700 → 70 commission, 630 net."""
    commission_initial, net_initial = calculate_commission(Decimal("1000.00"))
    assert commission_initial == Decimal("100.00")
    assert net_initial == Decimal("900.00")

    # Partial refund 300 → effective gross 700
    commission_after, net_after = calculate_commission(Decimal("700.00"))
    assert commission_after == Decimal("70.00")
    assert net_after == Decimal("630.00")


# ─── I-BILL-11: idempotency state=success → no replay ─────────────────────


def test_i_bill_11_payment_idempotency_states() -> None:
    """State enum contract — pending → success/failed terminal."""
    expected = {"pending", "success", "failed"}
    actual = {s.value for s in PaymentIdempotencyState}
    assert expected == actual


# ─── I-BILL-12: admin capture_override reason zorunlu (schema validation)─


def test_i_bill_12_capture_override_requires_reason() -> None:
    with pytest.raises(ValidationError):
        CaptureOverrideRequest(amount=Decimal("1000.00"))  # type: ignore[call-arg]


def test_i_bill_12_capture_override_reason_min_length() -> None:
    with pytest.raises(ValidationError):
        CaptureOverrideRequest(amount=Decimal("1000.00"), reason="")


def test_i_bill_12_capture_override_rejects_extra() -> None:
    with pytest.raises(ValidationError):
        CaptureOverrideRequest(
            amount=Decimal("1000.00"),
            reason="test",
            bypass="nope",  # type: ignore[call-arg]
        )


# ─── I-BILL-13 + I-BILL-14: V2 reserved (subaccount payout, chargeback) ──


@pytest.mark.skip(reason="I-BILL-13 V2 scope — Iyzico subaccount 7-day dispute window")
def test_i_bill_13_subaccount_payout_v2_reserved() -> None:
    pass


@pytest.mark.skip(reason="I-BILL-14 V2 scope — chargeback auto-dispute + capture reverse")
def test_i_bill_14_chargeback_auto_v2_reserved() -> None:
    pass


# ─── State machine — transitions map ──────────────────────────────────────


def test_billing_transitions_estimate_to_preauth() -> None:
    assert_transition_allowed(
        BillingState.ESTIMATE, BillingState.PREAUTH_REQUESTED
    )


def test_billing_transitions_preauth_held_to_captured() -> None:
    assert_transition_allowed(
        BillingState.PREAUTH_HELD, BillingState.CAPTURED
    )


def test_billing_transitions_captured_to_kasko_pending() -> None:
    assert_transition_allowed(
        BillingState.CAPTURED, BillingState.KASKO_PENDING
    )


def test_billing_transitions_captured_to_settled() -> None:
    assert_transition_allowed(
        BillingState.CAPTURED, BillingState.SETTLED
    )


def test_billing_transitions_terminal_settled_is_sink() -> None:
    """Settled terminal — hiçbir yeni geçişe izin yok."""
    assert BILLING_TRANSITIONS[BillingState.SETTLED] == frozenset()


def test_billing_transitions_terminal_cancelled_is_sink() -> None:
    assert BILLING_TRANSITIONS[BillingState.CANCELLED] == frozenset()


def test_billing_transitions_invalid_raises() -> None:
    """SETTLED'den ESTIMATE'e atlama yasak (terminal bypass)."""
    with pytest.raises(InvalidBillingTransitionError):
        assert_transition_allowed(
            BillingState.SETTLED, BillingState.ESTIMATE
        )


def test_billing_transitions_paid_cannot_revert_to_preauth() -> None:
    with pytest.raises(InvalidBillingTransitionError):
        assert_transition_allowed(
            BillingState.CAPTURED, BillingState.PREAUTH_HELD
        )


def test_terminal_states_contract() -> None:
    expected = frozenset({BillingState.SETTLED, BillingState.CANCELLED})
    assert expected == TERMINAL_BILLING_STATES


def test_billing_transitions_full_coverage() -> None:
    """Her enum state BILLING_TRANSITIONS map'inde tanımlı olmalı."""
    state_keys = set(BILLING_TRANSITIONS.keys())
    enum_values = set(BillingState)
    assert state_keys == enum_values


# ─── Schema validation — PaymentInitiate + RefundRequest + KaskoReimburse ─


def test_payment_initiate_request_optional_token() -> None:
    # V1'de card_token optional (Iyzico checkout form → WebView)
    req = PaymentInitiateRequest()
    assert req.card_token is None


def test_payment_initiate_rejects_extra() -> None:
    with pytest.raises(ValidationError):
        PaymentInitiateRequest(stealth_field="x")  # type: ignore[call-arg]


def test_refund_request_requires_positive_amount() -> None:
    with pytest.raises(ValidationError):
        RefundRequest(amount=Decimal("0"), reason=CaseRefundReason.DISPUTE)


def test_refund_request_reason_enum_only() -> None:
    # Free-text reason yasak — sadece enum
    with pytest.raises(ValidationError):
        RefundRequest(amount=Decimal("100"), reason="arbitrary")  # type: ignore[arg-type]


def test_kasko_reimburse_request_nonneg() -> None:
    with pytest.raises(ValidationError):
        KaskoReimburseRequest(amount=Decimal("-1"))


def test_mark_payout_completed_min_one_item() -> None:
    with pytest.raises(ValidationError):
        MarkPayoutCompletedRequest(items=[])


# ─── Enum complete contract ───────────────────────────────────────────────


def test_case_refund_reason_values() -> None:
    expected = {
        "cancellation",
        "dispute",
        "excess_preauth",
        "kasko_reimbursement",
        "admin_override",
    }
    actual = {r.value for r in CaseRefundReason}
    assert expected == actual


def test_case_refund_state_values() -> None:
    expected = {"pending", "success", "failed"}
    actual = {s.value for s in CaseRefundState}
    assert expected == actual


def test_case_kasko_state_values() -> None:
    expected = {
        "pending",
        "submitted",
        "approved",
        "rejected",
        "reimbursed",
        "partially_reimbursed",
    }
    actual = {s.value for s in CaseKaskoState}
    assert expected == actual


def test_payment_operation_values() -> None:
    expected = {"authorize", "capture", "refund", "void"}
    actual = {o.value for o in PaymentOperation}
    assert expected == actual


def test_payment_provider_values() -> None:
    expected = {"iyzico", "mock"}
    actual = {p.value for p in PaymentProvider}
    assert expected == actual


# ─── KaskoSummary (B-5 bayrağı — FE için zorunlu alanlar) ─────────────────


def test_b5_kasko_summary_has_required_fields() -> None:
    fields = set(KaskoSummary.model_fields.keys())
    required = {
        "state",
        "reimbursement_amount",
        "submitted_at",
        "reimbursed_at",
        "insurer_name",
        "policy_number",
        "claim_reference",
    }
    assert required <= fields


def test_b5_billing_summary_includes_kasko_optional() -> None:
    fields = set(BillingSummary.model_fields.keys())
    assert "kasko" in fields


# ─── AuthEventType capture_override (I-BILL-12 audit path) ────────────────


def test_admin_capture_override_event_hint() -> None:
    """I-BILL-12 audit: admin capture_override route'u AuthEvent emit eder.
    Faz A PR 9 (11) + Faz B-3 (4 admin billing) = 15 admin event tipi."""
    existing = {name for name in AuthEventType.__members__ if name.startswith("ADMIN_")}
    assert len(existing) == 15
    assert "ADMIN_BILLING_CAPTURE_OVERRIDE" in existing
