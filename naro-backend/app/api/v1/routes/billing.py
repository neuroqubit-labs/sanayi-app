"""Billing router (Faz B-3) — customer + technician + admin endpoints.

Brief §10 matrisi — 13 endpoint (webhook 2 ayrı dosyada `webhooks.py`).

Customer (3):
- POST /cases/{id}/payment/initiate
- GET  /cases/{id}/billing/summary
- POST /cases/{id}/cancel-billing (pre-auth void)

Technician (1):
- GET /technicians/me/payouts

Admin (9):
- GET  /admin/billing/pending-payouts
- POST /admin/billing/payouts/mark-completed (batch)
- GET  /admin/billing/kasko-pending
- POST /admin/cases/{id}/kasko-reimburse
- POST /admin/cases/{id}/refund (dispute / admin_override)
- POST /admin/cases/{id}/capture-override
- GET  /admin/billing/commission-report
- GET  /admin/billing/settlements (list)

Idempotency decorator + PSP abstraction (Mock V1 / Iyzico V1.1 env ile).
"""

from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import and_, func, select

from app.api.pagination import (
    CursorQuery,
    LimitQuery,
    PaginatedResponse,
    build_paginated,
    decode_cursor,
    encode_cursor,
)
from app.api.v1.deps import (
    AdminDep,
    CurrentUserDep,
    CustomerDep,
    DbDep,
    TechnicianDep,
)
from app.core.config import get_settings
from app.integrations.psp.iyzico import IyzicoConfigurationError, IyzicoPsp
from app.integrations.psp.mock import MockPsp
from app.integrations.psp.protocol import Psp
from app.models.auth_event import AuthEvent, AuthEventType
from app.models.billing import (
    CaseCommissionSettlement,
    CaseKaskoSettlement,
    CaseKaskoState,
    CaseRefund,
    CaseRefundReason,
    PaymentProvider,
)
from app.models.case import ServiceCase
from app.models.user import UserRole
from app.observability.metrics import admin_action_total
from app.repositories import billing as billing_repo
from app.repositories import case as case_repo
from app.schemas.billing import (
    BillingSummary,
    CaptureOverrideRequest,
    CommissionSettlementOut,
    KaskoReimburseRequest,
    KaskoSummary,
    MarkPayoutCompletedRequest,
    PaymentInitiateRequest,
    PaymentInitiateResponse,
    RefundOut,
    RefundRequest,
    TechnicianPayoutItem,
)
from app.services import case_billing
from app.services.case_billing_state import BillingState

customer_router = APIRouter(prefix="/cases", tags=["billing"])
technician_router = APIRouter(
    prefix="/technicians/me", tags=["billing-technician"]
)
admin_router = APIRouter(prefix="/admin/billing", tags=["billing-admin"])
admin_case_router = APIRouter(prefix="/admin/cases", tags=["billing-admin"])


# ─── PSP factory ──────────────────────────────────────────────────────────


def _get_psp() -> tuple[Psp, PaymentProvider]:
    """Config'e göre PSP döner. V1 mock; V1.1 sandbox credentials varsa Iyzico."""
    settings = get_settings()
    if settings.psp_provider == "iyzico" and settings.iyzico_api_key:
        try:
            return (
                IyzicoPsp(
                    base_url=settings.iyzico_base_url,
                    api_key=settings.iyzico_api_key,
                    secret_key=settings.iyzico_secret_key,
                ),
                PaymentProvider.IYZICO,
            )
        except IyzicoConfigurationError:
            pass
    return MockPsp(), PaymentProvider.MOCK


# ─── Helpers ──────────────────────────────────────────────────────────────


async def _load_case_or_404(db: DbDep, case_id: UUID) -> ServiceCase:
    case = await case_repo.get_case(db, case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(
            status_code=404, detail={"type": "case_not_found"}
        )
    return case


def _assert_case_owner(case: ServiceCase, user_id: UUID) -> None:
    if case.customer_user_id != user_id:
        raise HTTPException(
            status_code=403, detail={"type": "not_case_owner"}
        )


async def _build_billing_summary(
    db: DbDep, case: ServiceCase
) -> BillingSummary:
    settlement = await billing_repo.get_settlement_by_case(db, case.id)
    refunds = await billing_repo.list_refunds_for_case(db, case.id)
    preauth_total = await billing_repo.sum_successful_preauth(db, case.id)
    kasko_row = await billing_repo.get_kasko_by_case(db, case.id)

    state_raw = case.billing_state
    billing_state = (
        BillingState(state_raw) if state_raw else BillingState.ESTIMATE
    )
    kasko_summary: KaskoSummary | None = None
    if kasko_row is not None:
        kasko_summary = KaskoSummary.model_validate(kasko_row)

    return BillingSummary(
        case_id=case.id,
        billing_state=billing_state,
        estimate_amount=case.estimate_amount,
        preauth_amount=preauth_total if preauth_total > 0 else None,
        final_amount=(
            settlement.gross_amount if settlement is not None else None
        ),
        settlement=(
            CommissionSettlementOut.model_validate(settlement)
            if settlement is not None
            else None
        ),
        refunds=[RefundOut.model_validate(r) for r in refunds],
        kasko=kasko_summary,
    )


# ─── Customer endpoints ───────────────────────────────────────────────────


@customer_router.post(
    "/{case_id}/payment/initiate",
    response_model=PaymentInitiateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ödeme başlat — pre-auth hold (case owner)",
)
async def initiate_payment_endpoint(
    case_id: UUID,
    payload: PaymentInitiateRequest,
    user: CustomerDep,
    db: DbDep,
) -> PaymentInitiateResponse:
    _ = payload  # V1'de card_token kullanılmaz (B-4)
    case = await _load_case_or_404(db, case_id)
    _assert_case_owner(case, user.id)
    if case.estimate_amount is None:
        raise HTTPException(
            status_code=422, detail={"type": "estimate_amount_missing"}
        )
    psp, provider = _get_psp()
    result = await case_billing.initiate_payment(
        db,
        case=case,
        estimate_amount=case.estimate_amount,
        psp=psp,
        provider=provider,
    )
    if not result.success:
        raise HTTPException(
            status_code=422,
            detail={
                "type": "preauth_failed",
                "error_code": result.error_code,
            },
        )
    await db.commit()
    # V1 MockPsp: provider_ref = mock_pa_*; V1.1 Iyzico checkout URL döner
    checkout_url = (
        f"mock://pa/{result.provider_ref}"
        if provider == PaymentProvider.MOCK
        else (result.raw.get("checkoutFormContent") if isinstance(result.raw, dict) else "")
        or ""
    )
    return PaymentInitiateResponse(
        checkout_url=str(checkout_url),
        idempotency_key=f"authorize:{case_id}:initial",
        preauth_amount=(
            case.estimate_amount * Decimal("1.2")
            if case.estimate_amount is not None
            else Decimal("0.00")
        ),
        case_id=case_id,
    )


@customer_router.get(
    "/{case_id}/billing/summary",
    response_model=BillingSummary,
    summary="Billing özet (case owner ya da admin)",
)
async def get_billing_summary(
    case_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
) -> BillingSummary:
    case = await _load_case_or_404(db, case_id)
    if user.role != UserRole.ADMIN and case.customer_user_id != user.id:
        raise HTTPException(
            status_code=403, detail={"type": "not_case_owner"}
        )
    return await _build_billing_summary(db, case)


@customer_router.post(
    "/{case_id}/cancel-billing",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Pre-auth void + case iptal (case owner, V1 %0 fee non-tow)",
)
async def cancel_billing_endpoint(
    case_id: UUID,
    user: CustomerDep,
    db: DbDep,
) -> None:
    case = await _load_case_or_404(db, case_id)
    _assert_case_owner(case, user.id)
    psp, provider = _get_psp()
    # V1 preauth_ref mock'ta deterministic; V1.1'de payment_idempotency'den
    # okunur. Şimdi None geç — void skip ederse no-op.
    await case_billing.cancel_case(
        db,
        case=case,
        reason="customer_cancel",
        preauth_ref=None,
        psp=psp,
        provider=provider,
    )
    await db.commit()


# ─── Technician endpoint ──────────────────────────────────────────────────


@technician_router.get(
    "/payouts",
    response_model=list[TechnicianPayoutItem],
    summary="Ustanın kendi payout kayıtları",
)
async def list_my_payouts(
    user: TechnicianDep,
    db: DbDep,
) -> list[TechnicianPayoutItem]:
    rows = await billing_repo.list_payouts_for_technician(
        db, technician_user_id=user.id
    )
    return [
        TechnicianPayoutItem(
            settlement_id=r.id,
            case_id=r.case_id,
            net_to_technician_amount=r.net_to_technician_amount,
            platform_currency=r.platform_currency,
            captured_at=r.captured_at,
            payout_scheduled_at=r.payout_scheduled_at,
            payout_completed_at=r.payout_completed_at,
            payout_reference=r.payout_reference,
        )
        for r in rows
    ]


# ─── Admin endpoints ──────────────────────────────────────────────────────


@admin_router.get(
    "/pending-payouts",
    response_model=list[CommissionSettlementOut],
    summary="Payout bekleyen commission settlement'ları (haftalık cron öncesi)",
)
async def list_pending_payouts_endpoint(
    admin: AdminDep,
    db: DbDep,
) -> list[CommissionSettlementOut]:
    _ = admin
    rows = await billing_repo.list_pending_payouts(db)
    return [CommissionSettlementOut.model_validate(r) for r in rows]


@admin_router.post(
    "/payouts/mark-completed",
    response_model=list[CommissionSettlementOut],
    summary="Batch payout complete (manuel banka transfer sonrası)",
)
async def mark_payouts_completed_endpoint(
    payload: MarkPayoutCompletedRequest,
    admin: AdminDep,
    db: DbDep,
) -> list[CommissionSettlementOut]:
    updated_ids: list[UUID] = []
    for item in payload.items:
        await billing_repo.mark_payout_completed(
            db,
            settlement_id=item.settlement_id,
            payout_reference=item.payout_reference,
        )
        db.add(
            AuthEvent(
                user_id=admin.id,
                event_type=AuthEventType.ADMIN_BILLING_PAYOUT_COMPLETED,
                actor="admin",
                target=str(item.settlement_id),
                context={"payout_reference": item.payout_reference},
            )
        )
        updated_ids.append(item.settlement_id)
    admin_action_total.labels(action="billing_payout_completed").inc(
        len(payload.items)
    )
    await db.commit()
    # Refresh + return
    stmt = select(CaseCommissionSettlement).where(
        CaseCommissionSettlement.id.in_(updated_ids)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    return [CommissionSettlementOut.model_validate(r) for r in rows]


@admin_router.get(
    "/kasko-pending",
    response_model=list[KaskoSummary],
    summary="Kasko reimbursement bekleyenler (ops queue)",
)
async def list_kasko_pending_endpoint(
    admin: AdminDep,
    db: DbDep,
) -> list[KaskoSummary]:
    _ = admin
    rows = await billing_repo.list_pending_kasko(db)
    return [KaskoSummary.model_validate(r) for r in rows]


@admin_case_router.post(
    "/{case_id}/kasko-reimburse",
    response_model=BillingSummary,
    summary="Kasko reimburse — müşteri kartına iade (I-BILL-8)",
)
async def admin_kasko_reimburse_endpoint(
    case_id: UUID,
    payload: KaskoReimburseRequest,
    admin: AdminDep,
    db: DbDep,
) -> BillingSummary:
    case = await _load_case_or_404(db, case_id)
    settlement = await billing_repo.get_settlement_by_case(db, case_id)
    if settlement is None:
        raise HTTPException(
            status_code=422, detail={"type": "capture_missing"}
        )
    psp, provider = _get_psp()
    result = await case_billing.reimburse_kasko(
        db,
        case=case,
        amount=payload.amount,
        capture_ref="mock_cap_placeholder",  # Faz C: payment_idempotency'den oku
        admin_user_id=admin.id,
        psp=psp,
        provider=provider,
    )
    if not result.success:
        raise HTTPException(
            status_code=422, detail={"type": "kasko_reimburse_failed"}
        )
    db.add(
        AuthEvent(
            user_id=admin.id,
            event_type=AuthEventType.ADMIN_BILLING_KASKO_REIMBURSE,
            actor="admin",
            target=str(case_id),
            context={"amount": str(payload.amount)},
        )
    )
    admin_action_total.labels(action="billing_kasko_reimburse").inc()
    await db.commit()
    return await _build_billing_summary(db, case)


@admin_case_router.post(
    "/{case_id}/refund",
    response_model=BillingSummary,
    summary="Admin dispute / override refund (I-BILL-6)",
)
async def admin_refund_endpoint(
    case_id: UUID,
    payload: RefundRequest,
    admin: AdminDep,
    db: DbDep,
) -> BillingSummary:
    case = await _load_case_or_404(db, case_id)
    psp, provider = _get_psp()
    result = await case_billing.admin_refund(
        db,
        case=case,
        amount=payload.amount,
        reason=payload.reason,
        capture_ref="mock_cap_placeholder",
        admin_user_id=admin.id,
        psp=psp,
        provider=provider,
    )
    if not result.success:
        raise HTTPException(
            status_code=422, detail={"type": "refund_failed"}
        )
    db.add(
        AuthEvent(
            user_id=admin.id,
            event_type=AuthEventType.ADMIN_BILLING_REFUND,
            actor="admin",
            target=str(case_id),
            context={
                "amount": str(payload.amount),
                "reason": payload.reason.value,
            },
        )
    )
    admin_action_total.labels(action="billing_refund").inc()
    await db.commit()
    return await _build_billing_summary(db, case)


@admin_case_router.post(
    "/{case_id}/capture-override",
    response_model=BillingSummary,
    summary="Acil admin capture override (I-BILL-12 audit zorunlu)",
)
async def admin_capture_override_endpoint(
    case_id: UUID,
    payload: CaptureOverrideRequest,
    admin: AdminDep,
    db: DbDep,
) -> BillingSummary:
    case = await _load_case_or_404(db, case_id)
    # I-BILL-12: reason zorunlu (schema validation zaten enforce ediyor)
    db.add(
        AuthEvent(
            user_id=admin.id,
            event_type=AuthEventType.ADMIN_BILLING_CAPTURE_OVERRIDE,
            actor="admin",
            target=str(case_id),
            context={
                "amount": str(payload.amount),
                "reason": payload.reason,
            },
        )
    )
    admin_action_total.labels(action="billing_capture_override").inc()
    # Audit-only V1 — concrete capture PSP flow Faz C
    await db.commit()
    return await _build_billing_summary(db, case)


@admin_router.get(
    "/commission-report",
    summary="Platform komisyon raporu (from/to filter)",
)
async def admin_commission_report_endpoint(
    admin: AdminDep,
    db: DbDep,
    from_: Annotated[datetime | None, Query(alias="from")] = None,
    to: datetime | None = None,
) -> dict[str, object]:
    _ = admin
    if from_ is None:
        from_ = datetime.now() - timedelta(days=30)
    if to is None:
        to = datetime.now()
    stmt = select(
        func.count(),
        func.coalesce(
            func.sum(CaseCommissionSettlement.gross_amount), 0
        ),
        func.coalesce(
            func.sum(CaseCommissionSettlement.commission_amount), 0
        ),
        func.coalesce(
            func.sum(CaseCommissionSettlement.net_to_technician_amount), 0
        ),
    ).where(
        and_(
            CaseCommissionSettlement.captured_at >= from_,
            CaseCommissionSettlement.captured_at <= to,
        )
    )
    row = (await db.execute(stmt)).one()
    return {
        "from": from_.isoformat(),
        "to": to.isoformat(),
        "count": int(row[0]),
        "gross_total": str(row[1]),
        "commission_total": str(row[2]),
        "net_to_technician_total": str(row[3]),
    }


@admin_router.get(
    "/settlements",
    response_model=PaginatedResponse[CommissionSettlementOut],
    summary="Admin settlements listesi (cursor)",
)
async def admin_list_settlements(
    admin: AdminDep,
    db: DbDep,
    cursor: CursorQuery = None,
    limit: LimitQuery = 20,
) -> PaginatedResponse[CommissionSettlementOut]:
    _ = admin
    cursor_data = decode_cursor(cursor)
    conds = []
    if cursor_data is not None:
        last_sort = cursor_data.get("sort")
        last_id = cursor_data.get("id")
        if isinstance(last_sort, str) and isinstance(last_id, str):
            last_dt = datetime.fromisoformat(last_sort)
            conds.append(
                (CaseCommissionSettlement.captured_at < last_dt)
                | (
                    (CaseCommissionSettlement.captured_at == last_dt)
                    & (CaseCommissionSettlement.id > UUID(last_id))
                )
            )
    base = select(CaseCommissionSettlement)
    if conds:
        base = base.where(and_(*conds))
    stmt = base.order_by(
        CaseCommissionSettlement.captured_at.desc(),
        CaseCommissionSettlement.id.asc(),
    ).limit(limit + 1)
    rows = list((await db.execute(stmt)).scalars().all())
    items = [CommissionSettlementOut.model_validate(r) for r in rows]
    return build_paginated(
        items,
        limit=limit,
        cursor_fn=lambda item: encode_cursor(
            id_=item.id, sort_value=item.captured_at
        ),
    )


# Unused import guards (kept for future Faz C concrete integration)
_ = CaseKaskoState, CaseKaskoSettlement, CaseRefundReason, CaseRefund
