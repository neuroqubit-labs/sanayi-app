"""Billing domain repository (Faz B-3).

Commission settlement + refund + kasko ledger. Service katmanı
(case_billing.py) bu helper'ları atomik transaction içinde çağırır.

Brief §4.3 + §7.3 + §6.3 invariant:
- gross = commission + net (DB CHECK + service'te quantize)
- refund.idempotency_key UNIQUE (replay safe)
- kasko 1:1 case (UNIQUE)
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import (
    CaseCommissionSettlement,
    CaseKaskoSettlement,
    CaseKaskoState,
    CaseRefund,
    CaseRefundReason,
    CaseRefundState,
    PaymentIdempotency,
    PaymentIdempotencyState,
    PaymentOperation,
)

# ─── Commission settlement ────────────────────────────────────────────────


async def get_settlement_by_case(
    session: AsyncSession, case_id: UUID
) -> CaseCommissionSettlement | None:
    stmt = select(CaseCommissionSettlement).where(
        CaseCommissionSettlement.case_id == case_id
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def insert_settlement(
    session: AsyncSession,
    *,
    case_id: UUID,
    gross_amount: Decimal,
    commission_amount: Decimal,
    commission_rate: Decimal,
    net_to_technician_amount: Decimal,
    captured_at: datetime,
    invoice_url: str | None = None,
) -> CaseCommissionSettlement:
    row = CaseCommissionSettlement(
        case_id=case_id,
        gross_amount=gross_amount,
        commission_amount=commission_amount,
        commission_rate=commission_rate,
        net_to_technician_amount=net_to_technician_amount,
        captured_at=captured_at,
        invoice_url=invoice_url,
    )
    session.add(row)
    await session.flush()
    return row


async def list_pending_payouts(
    session: AsyncSession, *, limit: int = 100
) -> list[CaseCommissionSettlement]:
    """payout_scheduled_at IS NULL + henüz completed olmayan."""
    stmt = (
        select(CaseCommissionSettlement)
        .where(CaseCommissionSettlement.payout_scheduled_at.is_(None))
        .order_by(CaseCommissionSettlement.captured_at.asc())
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars().all())


async def mark_payout_scheduled(
    session: AsyncSession, *, settlement_id: UUID
) -> None:
    await session.execute(
        update(CaseCommissionSettlement)
        .where(CaseCommissionSettlement.id == settlement_id)
        .values(payout_scheduled_at=datetime.now(UTC))
    )


async def mark_payout_completed(
    session: AsyncSession,
    *,
    settlement_id: UUID,
    payout_reference: str,
) -> None:
    await session.execute(
        update(CaseCommissionSettlement)
        .where(CaseCommissionSettlement.id == settlement_id)
        .values(
            payout_completed_at=datetime.now(UTC),
            payout_reference=payout_reference,
        )
    )


async def list_payouts_for_technician(
    session: AsyncSession,
    *,
    technician_user_id: UUID,
    limit: int = 100,
) -> list[CaseCommissionSettlement]:
    """Usta kendi net_to_technician kayıtları.

    service_cases JOIN assigned_technician_id üzerinden. Faz B-3'te
    direct JOIN query.
    """
    from app.models.case import ServiceCase

    stmt = (
        select(CaseCommissionSettlement)
        .join(
            ServiceCase,
            ServiceCase.id == CaseCommissionSettlement.case_id,
        )
        .where(ServiceCase.assigned_technician_id == technician_user_id)
        .order_by(CaseCommissionSettlement.captured_at.desc())
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars().all())


# ─── Refund ledger ────────────────────────────────────────────────────────


async def insert_refund(
    session: AsyncSession,
    *,
    case_id: UUID,
    amount: Decimal,
    reason: CaseRefundReason,
    idempotency_key: str,
    initiated_by_user_id: UUID | None,
    state: CaseRefundState = CaseRefundState.PENDING,
) -> CaseRefund:
    row = CaseRefund(
        case_id=case_id,
        amount=amount,
        reason=reason,
        idempotency_key=idempotency_key,
        initiated_by_user_id=initiated_by_user_id,
        state=state,
    )
    session.add(row)
    await session.flush()
    return row


async def mark_refund_success(
    session: AsyncSession,
    *,
    refund_id: UUID,
    psp_ref: str,
) -> None:
    await session.execute(
        update(CaseRefund)
        .where(CaseRefund.id == refund_id)
        .values(
            state=CaseRefundState.SUCCESS,
            psp_ref=psp_ref,
            completed_at=datetime.now(UTC),
        )
    )


async def list_refunds_for_case(
    session: AsyncSession, case_id: UUID
) -> list[CaseRefund]:
    stmt = (
        select(CaseRefund)
        .where(CaseRefund.case_id == case_id)
        .order_by(CaseRefund.created_at.asc())
    )
    return list((await session.execute(stmt)).scalars().all())


async def sum_refunds_for_case(
    session: AsyncSession,
    case_id: UUID,
    *,
    success_only: bool = True,
) -> Decimal:
    conds = [CaseRefund.case_id == case_id]
    if success_only:
        conds.append(CaseRefund.state == CaseRefundState.SUCCESS)
    stmt = select(func.coalesce(func.sum(CaseRefund.amount), 0)).where(
        and_(*conds)
    )
    result = (await session.execute(stmt)).scalar_one()
    return Decimal(str(result))


# ─── Kasko settlement ─────────────────────────────────────────────────────


async def get_kasko_by_case(
    session: AsyncSession, case_id: UUID
) -> CaseKaskoSettlement | None:
    stmt = select(CaseKaskoSettlement).where(
        CaseKaskoSettlement.case_id == case_id
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def insert_kasko(
    session: AsyncSession,
    *,
    case_id: UUID,
    insurer_name: str,
    policy_number: str | None = None,
    state: CaseKaskoState = CaseKaskoState.PENDING,
) -> CaseKaskoSettlement:
    row = CaseKaskoSettlement(
        case_id=case_id,
        insurer_name=insurer_name,
        policy_number=policy_number,
        state=state,
    )
    session.add(row)
    await session.flush()
    return row


async def update_kasko_reimbursement(
    session: AsyncSession,
    *,
    kasko_id: UUID,
    reimbursement_amount: Decimal,
    refund_psp_ref: str | None,
    new_state: CaseKaskoState,
) -> None:
    values: dict[str, object] = {
        "reimbursement_amount": reimbursement_amount,
        "state": new_state,
        "updated_at": datetime.now(UTC),
    }
    if new_state in (
        CaseKaskoState.REIMBURSED,
        CaseKaskoState.PARTIALLY_REIMBURSED,
    ):
        values["reimbursed_at"] = datetime.now(UTC)
        if refund_psp_ref is not None:
            values["refund_to_customer_psp_ref"] = refund_psp_ref
    await session.execute(
        update(CaseKaskoSettlement)
        .where(CaseKaskoSettlement.id == kasko_id)
        .values(**values)
    )


async def list_pending_kasko(
    session: AsyncSession, *, limit: int = 100
) -> list[CaseKaskoSettlement]:
    """Admin queue — pending/submitted/approved state'ler."""
    stmt = (
        select(CaseKaskoSettlement)
        .where(
            CaseKaskoSettlement.state.in_(
                [
                    CaseKaskoState.PENDING,
                    CaseKaskoState.SUBMITTED,
                    CaseKaskoState.APPROVED,
                ]
            )
        )
        .order_by(CaseKaskoSettlement.created_at.asc())
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars().all())


# ─── Preauth aggregate (payment_idempotency'den) ──────────────────────────


async def sum_successful_preauth(
    session: AsyncSession, case_id: UUID
) -> Decimal:
    """I-BILL-1 guard için — başarılı authorize'lar toplamı.

    payment_idempotency'den request_payload.amount'u okur. Brief §3.2'de
    parts approval delta için kullanılır.
    """
    stmt = select(PaymentIdempotency).where(
        and_(
            PaymentIdempotency.case_id == case_id,
            PaymentIdempotency.operation == PaymentOperation.AUTHORIZE,
            PaymentIdempotency.state == PaymentIdempotencyState.SUCCESS,
        )
    )
    rows = list((await session.execute(stmt)).scalars().all())
    total = Decimal("0.00")
    for row in rows:
        payload = row.request_payload or {}
        amount_str = payload.get("amount") if isinstance(payload, dict) else None
        if isinstance(amount_str, str):
            total += Decimal(amount_str)
    return total
