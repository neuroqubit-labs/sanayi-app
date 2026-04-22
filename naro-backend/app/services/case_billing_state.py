"""Billing state machine (Faz B-1).

Case-level finansal yaşam döngüsü. Brief §3.1'deki 10-step diagram.
Tow ayrı (tow_fare_settlements.state); bu generic billing state.

Terminal:
- SETTLED (tüm taraflar ödenmiş)
- CANCELLED (pre-auth release + cancellation)

Transitions brief §3.1 + §3.2 (parts delta) + §3.3 (invoice capture)
+ §3.4 (müşteri red) + §6 (kasko branching) + §7 (refund paths).
"""

from __future__ import annotations

from enum import StrEnum


class BillingState(StrEnum):
    """Case financial lifecycle state (non-tow kind'lar için).

    Tow için tow_fare_settlements.state ayrı — bu generic billing.
    """

    ESTIMATE = "estimate"
    PREAUTH_REQUESTED = "preauth_requested"
    PREAUTH_HELD = "preauth_held"
    PREAUTH_FAILED = "preauth_failed"
    ADDITIONAL_HOLD_REQUESTED = "additional_hold_requested"
    ADDITIONAL_HELD = "additional_held"
    CAPTURED = "captured"
    KASKO_PENDING = "kasko_pending"
    KASKO_REIMBURSED = "kasko_reimbursed"
    KASKO_REJECTED = "kasko_rejected"
    PARTIAL_REFUNDED = "partial_refunded"
    FULL_REFUNDED = "full_refunded"
    SETTLED = "settled"  # terminal
    CANCELLED = "cancelled"  # terminal


TERMINAL_BILLING_STATES: frozenset[BillingState] = frozenset(
    {BillingState.SETTLED, BillingState.CANCELLED}
)


# Brief §3.1 + §6 + §7'den türetildi. Her geçiş service katmanında
# _transition guard ile doğrulanır.
BILLING_TRANSITIONS: dict[BillingState, frozenset[BillingState]] = {
    BillingState.ESTIMATE: frozenset(
        {BillingState.PREAUTH_REQUESTED, BillingState.CANCELLED}
    ),
    BillingState.PREAUTH_REQUESTED: frozenset(
        {BillingState.PREAUTH_HELD, BillingState.PREAUTH_FAILED}
    ),
    BillingState.PREAUTH_HELD: frozenset(
        {
            BillingState.CAPTURED,
            BillingState.ADDITIONAL_HOLD_REQUESTED,
            BillingState.CANCELLED,
            BillingState.FULL_REFUNDED,
        }
    ),
    BillingState.PREAUTH_FAILED: frozenset({BillingState.CANCELLED}),
    BillingState.ADDITIONAL_HOLD_REQUESTED: frozenset(
        {BillingState.ADDITIONAL_HELD, BillingState.PREAUTH_HELD}
    ),
    BillingState.ADDITIONAL_HELD: frozenset(
        {
            BillingState.CAPTURED,
            BillingState.CANCELLED,
            BillingState.ADDITIONAL_HOLD_REQUESTED,
        }
    ),
    BillingState.CAPTURED: frozenset(
        {
            BillingState.SETTLED,
            BillingState.KASKO_PENDING,
            BillingState.PARTIAL_REFUNDED,
            BillingState.FULL_REFUNDED,
        }
    ),
    BillingState.KASKO_PENDING: frozenset(
        {BillingState.KASKO_REIMBURSED, BillingState.KASKO_REJECTED}
    ),
    BillingState.KASKO_REIMBURSED: frozenset({BillingState.SETTLED}),
    BillingState.KASKO_REJECTED: frozenset({BillingState.SETTLED}),
    BillingState.PARTIAL_REFUNDED: frozenset(
        {BillingState.SETTLED, BillingState.FULL_REFUNDED}
    ),
    BillingState.FULL_REFUNDED: frozenset(
        {BillingState.SETTLED, BillingState.CANCELLED}
    ),
    BillingState.SETTLED: frozenset(),  # terminal
    BillingState.CANCELLED: frozenset(),  # terminal
}


class InvalidBillingTransitionError(ValueError):
    def __init__(
        self, current: BillingState, new: BillingState
    ) -> None:
        super().__init__(
            f"Invalid billing transition: {current.value} -> {new.value}"
        )
        self.current = current
        self.new = new


def assert_transition_allowed(
    current: BillingState, new: BillingState
) -> None:
    """Guard — service katmanı invariant I-BILL-2/I-BILL-7 enforcement."""
    if new not in BILLING_TRANSITIONS[current]:
        raise InvalidBillingTransitionError(current, new)
