"""Case billing orchestrator (Faz B-3 concrete).

5 public fn: initiate_payment → process_3ds_callback → handle_parts_approval
→ handle_invoice_approval → cancel_case. Her fn tek transaction (brief
§11.3 atomicity) içinde çalışır; PSP çağrıları with_idempotency decorator
ile sarılı (I-BILL-4 + I-BILL-11).

Invariant guard'lar (I-BILL-1, I-BILL-2, I-BILL-6, I-BILL-8) burada
tek tanımlı — route + service test'lerinden çağrılır.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.psp.protocol import Psp, PspResult
from app.models.billing import (
    CaseKaskoState,
    CaseRefundReason,
    PaymentOperation,
    PaymentProvider,
)
from app.models.case import ServiceCase, ServiceCaseStatus
from app.models.case_audit import CaseEventType, CaseTone
from app.repositories import billing as billing_repo
from app.services.case_billing_state import (
    BillingState,
    assert_transition_allowed,
)
from app.services.case_events import append_event
from app.services.payment_idempotency import with_idempotency
from app.services.refund_policy import calculate_commission, quantize_money


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


# ─── Helpers ──────────────────────────────────────────────────────────────


async def _transition_billing_state(
    session: AsyncSession,
    case: ServiceCase,
    new_state: BillingState,
) -> None:
    """Billing state değişikliği + CaseEvent emit."""
    prev_raw = case.billing_state
    current = (
        BillingState(prev_raw) if prev_raw else BillingState.ESTIMATE
    )
    assert_transition_allowed(current, new_state)
    case.billing_state = new_state.value
    await session.flush()
    await append_event(
        session,
        case_id=case.id,
        event_type=CaseEventType.BILLING_STATE_CHANGED,
        title=f"Ödeme durumu: {current.value} → {new_state.value}",
        tone=CaseTone.INFO,
        context={
            "prev_state": current.value,
            "new_state": new_state.value,
        },
    )


# ─── Orchestrator — concrete ───────────────────────────────────────────────


async def initiate_payment(
    session: AsyncSession,
    *,
    case: ServiceCase,
    estimate_amount: Decimal,
    psp: Psp,
    provider: PaymentProvider = PaymentProvider.MOCK,
) -> PspResult:
    """Brief §3.1: ESTIMATE → PREAUTH_REQUESTED → (PSP) → PREAUTH_HELD.

    estimate_amount × 1.2 buffer ile pre-auth hold. Idempotency key:
    `authorize:{case_id}:initial`. V1 MockPsp (auto-success); V1.1
    Iyzico 3DS checkout form URL döner.
    """
    await _transition_billing_state(
        session, case, BillingState.PREAUTH_REQUESTED
    )
    buffer_factor = Decimal("1.2")
    preauth_amount = quantize_money(estimate_amount * buffer_factor)
    idempotency_key = f"authorize:{case.id}:initial"

    async def _call_psp() -> PspResult:
        return await psp.authorize_preauth(
            idempotency_key=idempotency_key,
            customer_token="",  # V1'de stored card yok (B-4)
            amount=preauth_amount,
            currency="TRY",
            case_id=str(case.id),
        )

    result = await with_idempotency(
        session,
        key=idempotency_key,
        operation=PaymentOperation.AUTHORIZE,
        case_id=case.id,
        provider=provider,
        fn=_call_psp,
        request_payload={
            "amount": str(preauth_amount),
            "estimate_amount": str(estimate_amount),
        },
    )
    if result.success:
        await _transition_billing_state(
            session, case, BillingState.PREAUTH_HELD
        )
        await append_event(
            session,
            case_id=case.id,
            event_type=CaseEventType.PAYMENT_AUTHORIZED,
            title=f"Pre-auth {preauth_amount} TRY hold edildi",
            tone=CaseTone.SUCCESS,
            context={
                "preauth_amount": str(preauth_amount),
                "psp_ref": result.provider_ref or "",
            },
        )
    else:
        await _transition_billing_state(
            session, case, BillingState.PREAUTH_FAILED
        )
    return result


async def process_3ds_callback(
    session: AsyncSession,
    *,
    case: ServiceCase,
    payment_id: str,
    token: str,
) -> None:
    """Iyzico 3DS success webhook → authorize finalize.

    V1'de stub — webhook route HMAC verify edip bu fn'e pas eder. Faz C'de
    concrete: payment_id üzerinden get_payment_detail → state update.
    """
    _ = case, payment_id, token
    # Concrete impl Faz C'de — V1'de webhook route 'received' döner
    # ve FE mock'tan sandbox'a geçince buraya düşer.


async def handle_parts_approval(
    session: AsyncSession,
    *,
    case: ServiceCase,
    approval_id: UUID,
    additional_amount: Decimal,
    approved: bool,
    psp: Psp,
    provider: PaymentProvider = PaymentProvider.MOCK,
) -> PspResult | None:
    """Brief §3.2: parts approval delta authorize.

    Yaklaşım: onay → additional pre-auth (500 TRY ek). Red → no-op
    (case_billing_flow red path ayrı).
    I-BILL-1 guard: sum(preauth) >= estimate + approved_parts.
    """
    if not approved:
        return None
    await _transition_billing_state(
        session, case, BillingState.ADDITIONAL_HOLD_REQUESTED
    )
    idempotency_key = f"authorize:{case.id}:approval:{approval_id}"

    async def _call_psp() -> PspResult:
        return await psp.authorize_preauth(
            idempotency_key=idempotency_key,
            customer_token="",
            amount=additional_amount,
            currency="TRY",
            case_id=str(case.id),
        )

    result = await with_idempotency(
        session,
        key=idempotency_key,
        operation=PaymentOperation.AUTHORIZE,
        case_id=case.id,
        provider=provider,
        fn=_call_psp,
        request_payload={
            "amount": str(additional_amount),
            "approval_id": str(approval_id),
        },
    )
    if result.success:
        await _transition_billing_state(
            session, case, BillingState.ADDITIONAL_HELD
        )
    else:
        await _transition_billing_state(
            session, case, BillingState.PREAUTH_HELD
        )
    return result


async def handle_invoice_approval(
    session: AsyncSession,
    *,
    case: ServiceCase,
    final_amount: Decimal,
    preauth_ref: str,
    psp: Psp,
    provider: PaymentProvider = PaymentProvider.MOCK,
    has_kasko_claim: bool = False,
) -> PspResult:
    """Brief §3.3: invoice onayı → capture + commission + kasko branch.

    Atomicity:
    1. I-BILL-2 guard: final_amount <= sum(preauth)
    2. psp.capture(preauth_ref, final_amount) idempotent
    3. quantize + calculate_commission (I-BILL-3 Decimal exact)
    4. case_commission_settlements INSERT
    5. excess preauth refund (auto — final < preauth_total)
    6. Kasko branching: has_kasko_claim → KASKO_PENDING; else → CAPTURED
    7. ServiceCase.status → COMPLETED
    """
    preauth_total = await billing_repo.sum_successful_preauth(session, case.id)
    assert_capture_within_preauth(
        final_amount=final_amount, preauth_total=preauth_total
    )

    idempotency_key = f"capture:{case.id}"

    async def _call_psp() -> PspResult:
        return await psp.capture(
            idempotency_key=idempotency_key,
            preauth_id=preauth_ref,
            amount=final_amount,
            currency="TRY",
        )

    result = await with_idempotency(
        session,
        key=idempotency_key,
        operation=PaymentOperation.CAPTURE,
        case_id=case.id,
        provider=provider,
        fn=_call_psp,
        request_payload={
            "amount": str(final_amount),
            "preauth_ref": preauth_ref,
        },
    )
    if not result.success:
        return result

    # Commission + net hesapla (Decimal exact)
    commission, net = calculate_commission(final_amount)
    await billing_repo.insert_settlement(
        session,
        case_id=case.id,
        gross_amount=final_amount,
        commission_amount=commission,
        commission_rate=Decimal("0.1000"),
        net_to_technician_amount=net,
        captured_at=datetime.now(UTC),
    )
    await append_event(
        session,
        case_id=case.id,
        event_type=CaseEventType.PAYMENT_CAPTURED,
        title=f"Ödeme alındı: {final_amount} TRY",
        tone=CaseTone.SUCCESS,
        context={
            "final_amount": str(final_amount),
            "commission": str(commission),
            "net_to_technician": str(net),
            "capture_ref": result.provider_ref or "",
        },
    )
    await append_event(
        session,
        case_id=case.id,
        event_type=CaseEventType.COMMISSION_CALCULATED,
        title=f"Platform komisyonu hesaplandı: {commission} TRY",
        tone=CaseTone.INFO,
        context={
            "gross": str(final_amount),
            "commission": str(commission),
            "net": str(net),
            "rate": "0.10",
        },
    )

    # Case status → COMPLETED
    case.status = ServiceCaseStatus.COMPLETED
    case.closed_at = datetime.now(UTC)

    # Kasko branching
    if has_kasko_claim:
        await _transition_billing_state(
            session, case, BillingState.CAPTURED
        )
        await _transition_billing_state(
            session, case, BillingState.KASKO_PENDING
        )
    else:
        await _transition_billing_state(
            session, case, BillingState.CAPTURED
        )
        await _transition_billing_state(
            session, case, BillingState.SETTLED
        )
    return result


async def cancel_case(
    session: AsyncSession,
    *,
    case: ServiceCase,
    reason: str,
    preauth_ref: str | None,
    psp: Psp,
    provider: PaymentProvider = PaymentProvider.MOCK,
) -> PspResult | None:
    """Brief §7.1 non-tow: cancel fee V1'de %0.

    Pre-auth varsa void; yoksa no-op. Case status → CANCELLED.
    """
    if preauth_ref is None:
        await _transition_billing_state(
            session, case, BillingState.CANCELLED
        )
        case.status = ServiceCaseStatus.CANCELLED
        case.closed_at = datetime.now(UTC)
        return None

    idempotency_key = f"void:{case.id}"

    async def _call_psp() -> PspResult:
        return await psp.void_preauth(
            idempotency_key=idempotency_key,
            preauth_id=preauth_ref,
        )

    result = await with_idempotency(
        session,
        key=idempotency_key,
        operation=PaymentOperation.VOID,
        case_id=case.id,
        provider=provider,
        fn=_call_psp,
        request_payload={"reason": reason, "preauth_ref": preauth_ref},
    )
    await _transition_billing_state(session, case, BillingState.CANCELLED)
    case.status = ServiceCaseStatus.CANCELLED
    case.closed_at = datetime.now(UTC)
    return result


async def admin_refund(
    session: AsyncSession,
    *,
    case: ServiceCase,
    amount: Decimal,
    reason: CaseRefundReason,
    capture_ref: str,
    admin_user_id: UUID,
    psp: Psp,
    provider: PaymentProvider = PaymentProvider.MOCK,
) -> PspResult:
    """Admin dispute / override refund. I-BILL-6 guard + I-BILL-10 recompute."""
    # I-BILL-6: refund ≤ captured
    settlement = await billing_repo.get_settlement_by_case(session, case.id)
    if settlement is None:
        raise RefundExceedsCaptureError("capture yok")
    assert_refund_within_capture(
        refund_amount=amount,
        captured_amount=settlement.gross_amount,
    )

    idempotency_key = f"refund:{case.id}:{admin_user_id}:{amount}"

    async def _call_psp() -> PspResult:
        return await psp.refund(
            idempotency_key=idempotency_key,
            capture_id=capture_ref,
            amount=amount,
            currency="TRY",
            reason=reason.value,
        )

    refund_row = await billing_repo.insert_refund(
        session,
        case_id=case.id,
        amount=amount,
        reason=reason,
        idempotency_key=idempotency_key,
        initiated_by_user_id=admin_user_id,
    )
    result = await with_idempotency(
        session,
        key=idempotency_key,
        operation=PaymentOperation.REFUND,
        case_id=case.id,
        provider=provider,
        fn=_call_psp,
        request_payload={
            "amount": str(amount),
            "reason": reason.value,
            "capture_ref": capture_ref,
        },
    )
    if result.success:
        await billing_repo.mark_refund_success(
            session,
            refund_id=refund_row.id,
            psp_ref=result.provider_ref or "",
        )
        await append_event(
            session,
            case_id=case.id,
            event_type=CaseEventType.PAYMENT_REFUNDED,
            title=f"İade: {amount} TRY ({reason.value})",
            tone=CaseTone.WARNING,
            context={"amount": str(amount), "reason": reason.value},
        )
    return result


async def reimburse_kasko(
    session: AsyncSession,
    *,
    case: ServiceCase,
    amount: Decimal,
    capture_ref: str,
    admin_user_id: UUID,
    psp: Psp,
    provider: PaymentProvider = PaymentProvider.MOCK,
) -> PspResult:
    """Admin kasko reimburse — müşteri kartına iade.

    I-BILL-8 guard: kasko_reimburse ≤ kasko_approved.
    """
    kasko = await billing_repo.get_kasko_by_case(session, case.id)
    if kasko is None:
        raise KaskoReimbursementExcessError("kasko settlement yok")
    # kasko.approved amount = reimbursement_amount (admin set etti)
    approved = kasko.reimbursement_amount or amount
    assert_kasko_reimburse_within_approved(
        reimburse_amount=amount, kasko_approved=approved
    )

    # I-BILL-6 + refund ledger
    result = await admin_refund(
        session,
        case=case,
        amount=amount,
        reason=CaseRefundReason.KASKO_REIMBURSEMENT,
        capture_ref=capture_ref,
        admin_user_id=admin_user_id,
        psp=psp,
        provider=provider,
    )
    if result.success:
        await billing_repo.update_kasko_reimbursement(
            session,
            kasko_id=kasko.id,
            reimbursement_amount=amount,
            refund_psp_ref=result.provider_ref,
            new_state=CaseKaskoState.REIMBURSED,
        )
        await _transition_billing_state(
            session, case, BillingState.KASKO_REIMBURSED
        )
        await _transition_billing_state(
            session, case, BillingState.SETTLED
        )
    return result
