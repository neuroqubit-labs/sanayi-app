"""Case billing orchestrator (Faz B-1 skeleton — Faz B-3'te concrete impl).

5 public fn — şu an stub'lar. Faz B-1'de state machine + guard'lar
test'lenebilir; Faz B-2'de Iyzico PSP eklenir; Faz B-3'te concrete flow.

Invariant guard'lar (I-BILL-1, I-BILL-2, I-BILL-6, I-BILL-8) burada
tek tanımlı — route + service test'lerinden çağrılır.
"""

from __future__ import annotations

from decimal import Decimal


class InsufficientPreauthError(ValueError):
    """I-BILL-1 / I-BILL-2 ihlali — pre-auth yetersiz."""


class RefundExceedsCaptureError(ValueError):
    """I-BILL-6 ihlali — refund > captured amount."""


class KaskoReimbursementExcessError(ValueError):
    """I-BILL-8 ihlali — reimburse > approved amount."""


# ─── Invariant guard'ları (pure — test'lenebilir) ──────────────────────────


def assert_preauth_covers_approved(
    *, preauth_total: Decimal, approved_total: Decimal
) -> None:
    """I-BILL-1: sum(preauth) >= sum(estimate + approved_parts).

    Parts approval sonrası pre-auth'un onaylanmış tutardan düşük olmaması
    şart. `approved_total` = estimate + approved parts add'lar toplamı.
    """
    if preauth_total < approved_total:
        raise InsufficientPreauthError(
            f"preauth {preauth_total} < approved {approved_total}"
        )


def assert_capture_within_preauth(
    *, final_amount: Decimal, preauth_total: Decimal
) -> None:
    """I-BILL-2: final_amount <= sum(preauth holds).

    Capture anında final tutarın pre-auth cap'inden fazla olamayacağını
    garanti eder. Aşarsa ek authorize gerekli (flow değişir).
    """
    if final_amount > preauth_total:
        raise InsufficientPreauthError(
            f"final {final_amount} > preauth {preauth_total}"
        )


def assert_refund_within_capture(
    *, refund_amount: Decimal, captured_amount: Decimal
) -> None:
    """I-BILL-6: refund_amount <= captured_amount.

    Over-refund engel. Cumulative refund'lar için çağıran tarafta toplam
    hesaplanır — bu guard single-step.
    """
    if refund_amount > captured_amount:
        raise RefundExceedsCaptureError(
            f"refund {refund_amount} > captured {captured_amount}"
        )


def assert_kasko_reimburse_within_approved(
    *, reimburse_amount: Decimal, kasko_approved: Decimal
) -> None:
    """I-BILL-8: kasko_reimbursement_amount <= kasko_approved_amount."""
    if reimburse_amount > kasko_approved:
        raise KaskoReimbursementExcessError(
            f"reimburse {reimburse_amount} > approved {kasko_approved}"
        )


# ─── Orchestrator stubs (Faz B-3'te concrete impl) ─────────────────────────


async def initiate_payment(*_args: object, **_kwargs: object) -> None:
    """3DS form URL + pre-auth hold. Faz B-3'te concrete."""
    raise NotImplementedError("initiate_payment ships in Faz B-3")


async def process_3ds_callback(*_args: object, **_kwargs: object) -> None:
    """Iyzico 3DS success → authorize finalize. Faz B-3."""
    raise NotImplementedError("process_3ds_callback ships in Faz B-3")


async def handle_parts_approval(*_args: object, **_kwargs: object) -> None:
    """Delta authorize (parts approval sonrası). Faz B-3."""
    raise NotImplementedError("handle_parts_approval ships in Faz B-3")


async def handle_invoice_approval(*_args: object, **_kwargs: object) -> None:
    """Capture + commission + kasko branch. Faz B-3."""
    raise NotImplementedError("handle_invoice_approval ships in Faz B-3")


async def cancel_case(*_args: object, **_kwargs: object) -> None:
    """Release + cancellation fee (V1 %0 non-tow). Faz B-3."""
    raise NotImplementedError("cancel_case ships in Faz B-3")
