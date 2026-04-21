"""Tow payment service — preauth, capture, refund, dual-hold renewal.

PSP Protocol injection (MockPsp V1 / Iyzico V1.1). Idempotency durable:
1. HTTP header Idempotency-Key (middleware replay)
2. `tow_payment_idempotency` DB row (PSP call replay)

Plan §5 dual-hold renewal: new_authorize(cap) → success → old_release; fail →
state='preauth_stale' + customer push.

Plan §7 multi-refund: capture_delta (cap > actual) + cancellation + kasko_reimbursement.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.psp import Psp, PspResult
from app.models.case import ServiceCase
from app.models.case_audit import CaseEventType, CaseTone
from app.models.tow import (
    TowFareSettlement,
    TowPaymentOperation,
    TowRefundReason,
    TowSettlementStatus,
)
from app.repositories import tow as tow_repo
from app.services.case_events import append_event


class PaymentDeclinedError(Exception):
    def __init__(self, message: str, error_code: str | None = None):
        self.error_code = error_code
        super().__init__(message)


class PaymentPreAuthStaleError(Exception):
    pass


@dataclass(slots=True)
class PaymentOutcome:
    settlement_id: UUID
    state: TowSettlementStatus
    provider_ref: str | None


async def authorize_preauth(
    session: AsyncSession,
    *,
    case: ServiceCase,
    cap_amount: Decimal,
    quoted_amount: Decimal,
    customer_token: str,
    psp: Psp,
) -> PaymentOutcome:
    """Pre-authorize cap amount; state → pre_auth_holding.

    Idempotency key: `preauth:{case_id}`. Replay safe (DB + PSP level).
    """
    settlement = await tow_repo.get_settlement_by_case(session, case.id)
    if settlement is None:
        settlement = await tow_repo.create_settlement(
            session,
            case_id=case.id,
            cap_amount=cap_amount,
            quoted_amount=quoted_amount,
        )
    elif settlement.state == TowSettlementStatus.PRE_AUTH_HOLDING:
        return PaymentOutcome(
            settlement_id=settlement.id,
            state=settlement.state,
            provider_ref=settlement.preauth_id,
        )

    idempotency_key = f"preauth:{case.id}"
    cached = await tow_repo.read_idempotency(session, idempotency_key)
    if cached is not None:
        return PaymentOutcome(
            settlement_id=settlement.id,
            state=settlement.state,
            provider_ref=settlement.preauth_id,
        )

    result: PspResult = await psp.authorize_preauth(
        idempotency_key=idempotency_key,
        customer_token=customer_token,
        amount=cap_amount,
        currency="TRY",
        case_id=str(case.id),
    )
    await tow_repo.write_idempotency(
        session,
        key=idempotency_key,
        settlement_id=settlement.id,
        operation=TowPaymentOperation.PREAUTH,
        request_hash=_request_hash({"amount": str(cap_amount), "case_id": str(case.id)}),
        response_status=200 if result.success else 402,
        response_body=result.raw,
    )

    if not result.success:
        await tow_repo.update_settlement_state(
            session,
            settlement.id,
            TowSettlementStatus.NONE,
            last_error=result.message or "decline",
        )
        raise PaymentDeclinedError(
            result.message or "Pre-authorization declined",
            error_code=result.error_code,
        )

    now = datetime.now(UTC)
    await tow_repo.update_settlement_state(
        session,
        settlement.id,
        TowSettlementStatus.PRE_AUTH_HOLDING,
        preauth_id=result.provider_ref,
        preauth_authorized_at=now,
        preauth_expires_at=now + timedelta(hours=24),
        psp_response=result.raw,
    )
    return PaymentOutcome(
        settlement_id=settlement.id,
        state=TowSettlementStatus.PRE_AUTH_HOLDING,
        provider_ref=result.provider_ref,
    )


async def capture_final(
    session: AsyncSession,
    *,
    case: ServiceCase,
    actual_amount: Decimal,
    psp: Psp,
    actor_user_id: UUID | None = None,
) -> PaymentOutcome:
    """Capture final_amount (≤ cap). Delta varsa otomatik refund."""
    settlement = await tow_repo.get_settlement_by_case(session, case.id)
    if settlement is None or settlement.preauth_id is None:
        raise PaymentDeclinedError("no pre-authorization to capture")
    if settlement.state != TowSettlementStatus.PRE_AUTH_HOLDING:
        raise PaymentPreAuthStaleError(f"cannot capture from state={settlement.state.value}")

    cap = settlement.cap_amount or Decimal("0")
    final = min(actual_amount, cap)
    idempotency_key = f"capture:{settlement.id}"
    cached = await tow_repo.read_idempotency(session, idempotency_key)
    # Cache exists + state already charged → return cached outcome
    if cached is not None and cached.response_status == 200:
        return PaymentOutcome(
            settlement_id=settlement.id,
            state=TowSettlementStatus.FINAL_CHARGED,
            provider_ref=settlement.capture_id,
        )

    result = await psp.capture(
        idempotency_key=idempotency_key,
        preauth_id=settlement.preauth_id,
        amount=final,
        currency=settlement.currency,
    )
    await tow_repo.write_idempotency(
        session,
        key=idempotency_key,
        settlement_id=settlement.id,
        operation=TowPaymentOperation.CAPTURE,
        request_hash=_request_hash({"amount": str(final), "preauth_id": settlement.preauth_id}),
        response_status=200 if result.success else 402,
        response_body=result.raw,
    )

    if not result.success:
        raise PaymentDeclinedError(
            result.message or "Capture failed",
            error_code=result.error_code,
        )

    now = datetime.now(UTC)
    await tow_repo.update_settlement_state(
        session,
        settlement.id,
        TowSettlementStatus.FINAL_CHARGED,
        capture_id=result.provider_ref,
        captured_at=now,
        actual_amount=actual_amount,
        final_amount=final,
        psp_response=result.raw,
    )
    await append_event(
        session,
        case_id=case.id,
        event_type=CaseEventType.TOW_FARE_CAPTURED,
        title=f"Ödeme tahsil edildi: {final} TRY",
        tone=CaseTone.SUCCESS,
        actor_user_id=actor_user_id,
        context={
            "final_amount": str(final),
            "capture_id": result.provider_ref,
        },
    )

    # Delta refund (cap − final > 0) → auto refund authorized extra
    if final < cap:
        delta = cap - final
        refund_key = f"refund:{settlement.id}:capture_delta"
        existing = await tow_repo.read_idempotency(session, refund_key)
        if existing is None:
            rf_result = await psp.refund(
                idempotency_key=refund_key,
                capture_id=result.provider_ref or "",
                amount=delta,
                currency=settlement.currency,
                reason="capture_delta",
            )
            await tow_repo.write_idempotency(
                session,
                key=refund_key,
                settlement_id=settlement.id,
                operation=TowPaymentOperation.REFUND,
                request_hash=_request_hash({"amount": str(delta), "reason": "capture_delta"}),
                response_status=200 if rf_result.success else 422,
                response_body=rf_result.raw,
            )
            if rf_result.success:
                await tow_repo.insert_refund(
                    session,
                    settlement_id=settlement.id,
                    amount=delta,
                    reason=TowRefundReason.CAPTURE_DELTA,
                    idempotency_key=refund_key,
                    psp_ref=rf_result.provider_ref,
                    psp_response=rf_result.raw,
                )

    return PaymentOutcome(
        settlement_id=settlement.id,
        state=TowSettlementStatus.FINAL_CHARGED,
        provider_ref=result.provider_ref,
    )


async def refund_cancellation(
    session: AsyncSession,
    *,
    settlement: TowFareSettlement,
    fee_amount: Decimal,
    psp: Psp,
) -> None:
    """İptal ücreti sonrası cap − fee kadar refund."""
    cap = settlement.cap_amount or Decimal("0")
    refund_amount = max(Decimal("0"), cap - fee_amount)
    if refund_amount == 0 or settlement.preauth_id is None:
        return
    refund_key = f"refund:{settlement.id}:cancellation"
    cached = await tow_repo.read_idempotency(session, refund_key)
    if cached is not None:
        return
    result = await psp.void_preauth(
        idempotency_key=refund_key,
        preauth_id=settlement.preauth_id,
    )
    await tow_repo.write_idempotency(
        session,
        key=refund_key,
        settlement_id=settlement.id,
        operation=TowPaymentOperation.VOID,
        request_hash=_request_hash({"preauth_id": settlement.preauth_id}),
        response_status=200 if result.success else 422,
        response_body=result.raw,
    )
    if result.success:
        await tow_repo.insert_refund(
            session,
            settlement_id=settlement.id,
            amount=refund_amount,
            reason=TowRefundReason.CANCELLATION,
            idempotency_key=refund_key,
            psp_ref=result.provider_ref,
            psp_response=result.raw,
        )
        await tow_repo.update_settlement_state(
            session, settlement.id, TowSettlementStatus.CANCELLED
        )


def _request_hash(payload: dict[str, object]) -> str:
    encoded = json.dumps(payload, sort_keys=True, default=str).encode()
    return hashlib.sha256(encoded).hexdigest()
