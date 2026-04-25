"""Reusable Payment Core orchestration.

Product-specific flows keep their own lifecycle state, but PSP initiation and
callback processing go through this module. Tow uses `preauth_capture`; future
campaign purchases will use the same order/attempt ledger with
`direct_capture`.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from enum import Enum
from uuid import UUID, uuid4

from redis.asyncio import Redis
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.integrations.maps import get_maps
from app.integrations.psp import Psp
from app.models.billing import PaymentProvider
from app.models.case import ServiceCase, ServiceRequestKind, TowDispatchStage, TowMode
from app.models.case_audit import CaseEventType, CaseTone
from app.models.case_process import (
    CaseApproval,
    CaseApprovalKind,
    CaseApprovalPaymentMethod,
    CaseApprovalPaymentState,
    CaseApprovalStatus,
)
from app.models.case_subtypes import TowCase
from app.models.payment import (
    PaymentAttempt,
    PaymentMode,
    PaymentOrder,
    PaymentState,
    PaymentSubjectType,
)
from app.models.tow import TowSettlementStatus
from app.repositories import tow as tow_repo
from app.schemas.payment import (
    PaymentInitiateResponse,
    PaymentModeSchema,
    PaymentSnapshot,
    PaymentStateSchema,
)
from app.services import tow_dispatch
from app.services.case_events import append_event


class PaymentCoreError(Exception):
    error_type = "payment_core_error"
    http_status = 400


class PaymentSubjectNotFoundError(PaymentCoreError):
    error_type = "payment_subject_not_found"
    http_status = 404


class PaymentNotAllowedError(PaymentCoreError):
    error_type = "payment_not_allowed"
    http_status = 409


class PaymentRouteMissingError(PaymentCoreError):
    error_type = "tow_route_missing"
    http_status = 422


class PaymentCheckoutUnavailableError(PaymentCoreError):
    error_type = "checkout_form_unavailable"
    http_status = 422


class PaymentAmountMissingError(PaymentCoreError):
    error_type = "payment_amount_missing"
    http_status = 422


class PaymentAttemptNotFoundError(PaymentCoreError):
    error_type = "payment_attempt_not_found"
    http_status = 404


def provider_from_settings(settings: Settings | None = None) -> PaymentProvider:
    active = settings or get_settings()
    return PaymentProvider.IYZICO if active.psp_provider == "iyzico" else PaymentProvider.MOCK


def _enum_value(value: object) -> str:
    if isinstance(value, Enum):
        return str(value.value)
    return str(value)


async def ensure_tow_payment_required(
    session: AsyncSession,
    *,
    case: ServiceCase,
    tow_case: TowCase,
    provider: PaymentProvider | None = None,
) -> PaymentOrder:
    quote_snapshot = await build_tow_quote_snapshot(tow_case)
    await _lock_payment_subject(
        session,
        subject_type=PaymentSubjectType.TOW_CASE,
        subject_id=case.id,
        mode=PaymentMode.PREAUTH_CAPTURE,
    )
    order = await get_payment_order(
        session,
        subject_type=PaymentSubjectType.TOW_CASE,
        subject_id=case.id,
        mode=PaymentMode.PREAUTH_CAPTURE,
    )
    amount = Decimal(str(quote_snapshot["cap_amount"]))
    if order is None:
        order = PaymentOrder(
            subject_type=PaymentSubjectType.TOW_CASE,
            subject_id=case.id,
            case_id=case.id,
            customer_user_id=case.customer_user_id,
            payment_mode=PaymentMode.PREAUTH_CAPTURE,
            state=PaymentState.PAYMENT_REQUIRED,
            amount=amount,
            provider=(provider or provider_from_settings()).value,
            quote_snapshot=quote_snapshot,
            expires_at=_parse_expires_at(quote_snapshot),
        )
        session.add(order)
    elif order.state in (PaymentState.PAYMENT_REQUIRED, PaymentState.PREAUTH_FAILED):
        order.state = PaymentState.PAYMENT_REQUIRED
        order.amount = amount
        order.provider = (provider or provider_from_settings()).value
        order.quote_snapshot = quote_snapshot
        order.expires_at = _parse_expires_at(quote_snapshot)
    await session.flush()
    return order


async def initiate_tow_preauth(
    session: AsyncSession,
    *,
    case: ServiceCase,
    tow_case: TowCase,
    psp: Psp,
    callback_url: str,
    redis: Redis | None = None,
) -> PaymentInitiateResponse:
    if case.kind != ServiceRequestKind.TOWING:
        raise PaymentSubjectNotFoundError("case is not a towing case")
    if tow_case.tow_stage not in (
        TowDispatchStage.PAYMENT_REQUIRED,
        TowDispatchStage.PREAUTH_FAILED,
        TowDispatchStage.PREAUTH_STALE,
    ):
        raise PaymentNotAllowedError(
            f"payment cannot be initiated from stage={tow_case.tow_stage.value}"
        )

    provider = provider_from_settings()
    order = await ensure_tow_payment_required(
        session, case=case, tow_case=tow_case, provider=provider
    )
    if order.state == PaymentState.PREAUTH_HELD:
        raise PaymentNotAllowedError("preauth already held")
    if order.state == PaymentState.PREAUTH_REQUESTED and order.latest_attempt_id:
        existing_attempt = await session.get(PaymentAttempt, order.latest_attempt_id)
        if (
            existing_attempt is not None
            and existing_attempt.state == PaymentState.PREAUTH_REQUESTED
            and existing_attempt.checkout_url
        ):
            return PaymentInitiateResponse(
                payment_order_id=order.id,
                payment_attempt_id=existing_attempt.id,
                checkout_url=existing_attempt.checkout_url,
                amount=order.amount,
                currency=order.currency,
                expires_at=order.expires_at,
                payment_mode=PaymentModeSchema(_enum_value(order.payment_mode)),
            )

    attempt_id = uuid4()
    attempt = PaymentAttempt(
        id=attempt_id,
        order_id=order.id,
        provider=provider.value,
        provider_conversation_id=str(attempt_id),
        amount=order.amount,
        currency=order.currency,
        state=PaymentState.PREAUTH_REQUESTED,
        raw_request={
            "subject_type": _enum_value(order.subject_type),
            "subject_id": str(order.subject_id),
            "amount": str(order.amount),
            "currency": order.currency,
            "payment_mode": _enum_value(order.payment_mode),
        },
    )
    session.add(attempt)
    await session.flush()
    checkout = await psp.create_checkout_form(
        conversation_id=attempt.provider_conversation_id,
        amount=order.amount,
        currency=order.currency,
        callback_url=callback_url,
    )
    attempt.checkout_url = checkout.checkout_url
    attempt.provider_token = checkout.provider_token
    attempt.raw_response = checkout.raw
    if not attempt.checkout_url:
        attempt.state = PaymentState.PREAUTH_FAILED
        attempt.failure_code = "CHECKOUT_UNAVAILABLE"
        attempt.failure_message = "PSP checkout form unavailable"
        order.state = PaymentState.PREAUTH_FAILED
        raise PaymentCheckoutUnavailableError("checkout form unavailable")
    order.state = PaymentState.PREAUTH_REQUESTED
    order.latest_attempt_id = attempt.id
    await append_event(
        session,
        case_id=case.id,
        event_type=CaseEventType.PAYMENT_INITIATED,
        title="Çekici ön provizyonu başlatıldı",
        tone=CaseTone.INFO,
        actor_user_id=case.customer_user_id,
        context={
            "payment_order_id": str(order.id),
            "payment_attempt_id": str(attempt.id),
            "amount": str(order.amount),
            "provider": provider.value,
        },
    )

    # Development PSP: keep the UX step, but do not strand the app on a mock://
    # URL. Production/staging cannot use mock provider (settings gate).
    if provider == PaymentProvider.MOCK:
        await process_payment_callback(
            session,
            conversation_id=attempt.provider_conversation_id,
            payment_id=f"mock_payment_{attempt.id}",
            psp=psp,
            redis=redis,
        )

    await session.flush()
    return PaymentInitiateResponse(
        payment_order_id=order.id,
        payment_attempt_id=attempt.id,
        checkout_url=attempt.checkout_url or "",
        amount=order.amount,
        currency=order.currency,
        expires_at=order.expires_at,
        payment_mode=PaymentModeSchema(_enum_value(order.payment_mode)),
    )


async def abandon_tow_payment(
    session: AsyncSession,
    *,
    case: ServiceCase,
    tow_case: TowCase,
) -> PaymentOrder:
    if case.kind != ServiceRequestKind.TOWING:
        raise PaymentSubjectNotFoundError("case is not a towing case")
    if tow_case.tow_stage not in (
        TowDispatchStage.PAYMENT_REQUIRED,
        TowDispatchStage.PREAUTH_FAILED,
        TowDispatchStage.PREAUTH_STALE,
    ):
        raise PaymentNotAllowedError(
            f"payment cannot be abandoned from stage={tow_case.tow_stage.value}"
        )
    await _lock_payment_subject(
        session,
        subject_type=PaymentSubjectType.TOW_CASE,
        subject_id=case.id,
        mode=PaymentMode.PREAUTH_CAPTURE,
    )
    order = await get_payment_order(
        session,
        subject_type=PaymentSubjectType.TOW_CASE,
        subject_id=case.id,
        mode=PaymentMode.PREAUTH_CAPTURE,
    )
    if order is None:
        raise PaymentSubjectNotFoundError("payment order not found")
    if _enum_value(order.state) == PaymentState.PREAUTH_HELD.value:
        raise PaymentNotAllowedError("preauth already held")
    attempt = (
        await session.get(PaymentAttempt, order.latest_attempt_id)
        if order.latest_attempt_id
        else None
    )
    if attempt is None:
        raise PaymentAttemptNotFoundError("payment attempt not found")
    if _enum_value(attempt.state) == PaymentState.PREAUTH_REQUESTED.value:
        attempt.state = PaymentState.CANCELLED
        attempt.completed_at = datetime.now(UTC)
        attempt.failure_code = "CUSTOMER_ABANDONED"
        attempt.failure_message = "Customer closed the 3DS payment step"
    order.state = PaymentState.PAYMENT_REQUIRED
    await append_event(
        session,
        case_id=case.id,
        event_type=CaseEventType.PAYMENT_INITIATED,
        title="Çekici ödeme adımı kapatıldı",
        tone=CaseTone.WARNING,
        actor_user_id=case.customer_user_id,
        context={
            "payment_order_id": str(order.id),
            "payment_attempt_id": str(attempt.id),
            "reason": "customer_abandoned",
        },
    )
    await session.flush()
    return order


async def initiate_case_approval_capture(
    session: AsyncSession,
    *,
    case: ServiceCase,
    approval: CaseApproval,
    psp: Psp,
    callback_url: str,
) -> PaymentInitiateResponse:
    if approval.case_id != case.id:
        raise PaymentSubjectNotFoundError("approval does not belong to case")
    if approval.kind not in (CaseApprovalKind.PARTS_REQUEST, CaseApprovalKind.INVOICE):
        raise PaymentNotAllowedError("approval kind does not require payment")
    if approval.status != CaseApprovalStatus.PENDING:
        raise PaymentNotAllowedError("approval is not pending")
    if approval.amount is None or approval.amount <= 0:
        raise PaymentAmountMissingError("approval amount is required")

    await _lock_payment_subject(
        session,
        subject_type=PaymentSubjectType.CASE_APPROVAL,
        subject_id=approval.id,
        mode=PaymentMode.DIRECT_CAPTURE,
    )
    provider = provider_from_settings()
    order = await get_payment_order(
        session,
        subject_type=PaymentSubjectType.CASE_APPROVAL,
        subject_id=approval.id,
        mode=PaymentMode.DIRECT_CAPTURE,
    )
    if order is None:
        order = PaymentOrder(
            subject_type=PaymentSubjectType.CASE_APPROVAL,
            subject_id=approval.id,
            case_id=case.id,
            customer_user_id=case.customer_user_id,
            payment_mode=PaymentMode.DIRECT_CAPTURE,
            state=PaymentState.PAYMENT_REQUIRED,
            amount=approval.amount,
            currency=approval.currency,
            provider=provider.value,
            quote_snapshot=_build_case_approval_payment_snapshot(approval),
            expires_at=datetime.now(UTC).replace(microsecond=0) + timedelta(minutes=10),
        )
        session.add(order)
        await session.flush()
    elif order.state == PaymentState.CAPTURED:
        raise PaymentNotAllowedError("approval payment already captured")
    elif order.state == PaymentState.CAPTURE_REQUESTED and order.latest_attempt_id:
        existing_attempt = await session.get(PaymentAttempt, order.latest_attempt_id)
        if (
            existing_attempt is not None
            and existing_attempt.state == PaymentState.CAPTURE_REQUESTED
            and existing_attempt.checkout_url
        ):
            return PaymentInitiateResponse(
                payment_order_id=order.id,
                payment_attempt_id=existing_attempt.id,
                checkout_url=existing_attempt.checkout_url,
                amount=order.amount,
                currency=order.currency,
                expires_at=order.expires_at,
                payment_mode=PaymentModeSchema(_enum_value(order.payment_mode)),
            )
    else:
        order.amount = approval.amount
        order.currency = approval.currency
        order.provider = provider.value
        order.quote_snapshot = _build_case_approval_payment_snapshot(approval)
        order.expires_at = datetime.now(UTC).replace(microsecond=0) + timedelta(minutes=10)

    attempt_id = uuid4()
    attempt = PaymentAttempt(
        id=attempt_id,
        order_id=order.id,
        provider=provider.value,
        provider_conversation_id=str(attempt_id),
        amount=order.amount,
        currency=order.currency,
        state=PaymentState.CAPTURE_REQUESTED,
        raw_request={
            "subject_type": _enum_value(order.subject_type),
            "subject_id": str(order.subject_id),
            "case_id": str(case.id),
            "amount": str(order.amount),
            "currency": order.currency,
            "payment_mode": _enum_value(order.payment_mode),
        },
    )
    session.add(attempt)
    await session.flush()
    checkout = await psp.create_checkout_form(
        conversation_id=attempt.provider_conversation_id,
        amount=order.amount,
        currency=order.currency,
        callback_url=callback_url,
    )
    attempt.checkout_url = checkout.checkout_url
    attempt.provider_token = checkout.provider_token
    attempt.raw_response = checkout.raw
    if not attempt.checkout_url:
        attempt.state = PaymentState.PREAUTH_FAILED
        attempt.failure_code = "CHECKOUT_UNAVAILABLE"
        attempt.failure_message = "PSP checkout form unavailable"
        order.state = PaymentState.PREAUTH_FAILED
        approval.payment_state = CaseApprovalPaymentState.FAILED
        raise PaymentCheckoutUnavailableError("checkout form unavailable")

    order.state = PaymentState.CAPTURE_REQUESTED
    order.latest_attempt_id = attempt.id
    approval.payment_method = CaseApprovalPaymentMethod.ONLINE
    approval.payment_state = CaseApprovalPaymentState.REQUESTED
    approval.payment_order_id = order.id
    await append_event(
        session,
        case_id=case.id,
        event_type=CaseEventType.PAYMENT_INITIATED,
        title="Online ödeme başlatıldı",
        tone=CaseTone.INFO,
        actor_user_id=case.customer_user_id,
        context={
            "payment_order_id": str(order.id),
            "payment_attempt_id": str(attempt.id),
            "approval_id": str(approval.id),
            "approval_kind": approval.kind.value,
            "amount": str(order.amount),
            "provider": provider.value,
        },
    )
    if provider == PaymentProvider.MOCK:
        await process_payment_callback(
            session,
            conversation_id=attempt.provider_conversation_id,
            payment_id=f"mock_payment_{attempt.id}",
            psp=psp,
        )

    await session.flush()
    return PaymentInitiateResponse(
        payment_order_id=order.id,
        payment_attempt_id=attempt.id,
        checkout_url=attempt.checkout_url or "",
        amount=order.amount,
        currency=order.currency,
        expires_at=order.expires_at,
        payment_mode=PaymentModeSchema(_enum_value(order.payment_mode)),
    )


async def process_payment_callback(
    session: AsyncSession,
    *,
    conversation_id: str,
    payment_id: str,
    psp: Psp,
    redis: Redis | None = None,
) -> bool:
    stmt = select(PaymentAttempt).where(
        PaymentAttempt.provider_conversation_id == conversation_id
    ).with_for_update()
    attempt = (await session.execute(stmt)).scalar_one_or_none()
    if attempt is None:
        return False
    order_stmt = (
        select(PaymentOrder)
        .where(PaymentOrder.id == attempt.order_id)
        .with_for_update()
    )
    order = (await session.execute(order_stmt)).scalar_one_or_none()
    if order is None:
        return False
    if _enum_value(attempt.state) == PaymentState.CANCELLED.value:
        result = await psp.get_payment_detail(payment_id=payment_id)
        attempt.provider_payment_id = payment_id
        attempt.completed_at = attempt.completed_at or datetime.now(UTC)
        attempt.raw_response = {
            "abandoned_callback": True,
            "payment_detail": result.raw,
        }
        if result.success:
            void_result = await psp.void_preauth(
                idempotency_key=f"void_abandoned:{attempt.id}",
                preauth_id=result.provider_ref or payment_id,
            )
            attempt.raw_response = {
                "abandoned_callback": True,
                "payment_detail": result.raw,
                "void_result": void_result.raw,
            }
            if _enum_value(order.state) not in (
                PaymentState.PREAUTH_HELD.value,
                PaymentState.CAPTURED.value,
            ):
                order.state = PaymentState.PAYMENT_REQUIRED
            await append_event(
                session,
                case_id=order.case_id or order.subject_id,
                event_type=CaseEventType.PAYMENT_REFUNDED,
                title="Kapatılan ödeme için ön provizyon serbest bırakıldı",
                tone=CaseTone.INFO,
                context={
                    "payment_order_id": str(order.id),
                    "payment_attempt_id": str(attempt.id),
                },
            )
        return True
    if order.state in (
        PaymentState.PREAUTH_HELD,
        PaymentState.CAPTURED,
    ):
        return True
    if attempt.state in (
        PaymentState.PREAUTH_HELD,
        PaymentState.PREAUTH_FAILED,
        PaymentState.CAPTURED,
    ):
        return True

    result = await psp.get_payment_detail(payment_id=payment_id)
    now = datetime.now(UTC)
    attempt.provider_payment_id = payment_id
    attempt.completed_at = now
    attempt.raw_response = result.raw
    if not result.success:
        attempt.state = PaymentState.PREAUTH_FAILED
        attempt.failure_code = result.error_code
        attempt.failure_message = result.message
        order.state = PaymentState.PREAUTH_FAILED
        if _enum_value(order.subject_type) == PaymentSubjectType.CASE_APPROVAL.value:
            await _mark_case_approval_payment_failed(session, order, result.message)
        else:
            await _mark_tow_payment_failed(session, order, result.message)
        return True

    if _enum_value(order.subject_type) == PaymentSubjectType.CASE_APPROVAL.value:
        attempt.state = PaymentState.CAPTURED
        order.state = PaymentState.CAPTURED
        await _mark_case_approval_capture_paid(session, order, provider_ref=result.provider_ref or payment_id)
    else:
        attempt.state = PaymentState.PREAUTH_HELD
        order.state = PaymentState.PREAUTH_HELD
        await _mark_tow_preauth_held(
            session,
            order,
            provider_ref=result.provider_ref or payment_id,
            psp_response=result.raw,
            redis=redis,
        )
    return True


async def payment_snapshot_for_case(
    session: AsyncSession, case_id: UUID
) -> PaymentSnapshot | None:
    order = await get_payment_order(
        session,
        subject_type=PaymentSubjectType.TOW_CASE,
        subject_id=case_id,
        mode=PaymentMode.PREAUTH_CAPTURE,
    )
    if order is None:
        return None
    state_value = _enum_value(order.state)
    state = PaymentStateSchema(state_value)
    retryable = order.state in (
        PaymentState.PAYMENT_REQUIRED,
        PaymentState.PREAUTH_FAILED,
    )
    next_action = None
    if state_value == PaymentState.PAYMENT_REQUIRED.value:
        next_action = "initiate_payment"
    elif state_value == PaymentState.PREAUTH_FAILED.value:
        next_action = "retry_payment"
    return PaymentSnapshot(
        state=state,
        amount_label=f"En fazla ₺{int(order.amount):,}".replace(",", "."),
        retryable=retryable,
        next_action=next_action,
        payment_order_id=order.id,
        amount=order.amount,
        currency=order.currency,
    )


async def get_payment_order(
    session: AsyncSession,
    *,
    subject_type: PaymentSubjectType,
    subject_id: UUID,
    mode: PaymentMode,
) -> PaymentOrder | None:
    stmt = (
        select(PaymentOrder)
        .where(
            PaymentOrder.subject_type == subject_type,
            PaymentOrder.subject_id == subject_id,
            PaymentOrder.payment_mode == mode,
        )
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def build_tow_quote_snapshot(tow_case: TowCase) -> dict[str, object]:
    if (
        tow_case.pickup_lat is None
        or tow_case.pickup_lng is None
        or tow_case.dropoff_lat is None
        or tow_case.dropoff_lng is None
    ):
        raise PaymentRouteMissingError("pickup and dropoff are required for payment")

    settings = get_settings()
    maps = get_maps()
    route = await maps.route_distance(
        (tow_case.pickup_lat, tow_case.pickup_lng),
        (tow_case.dropoff_lat, tow_case.dropoff_lng),
    )
    distance_km = Decimal(str(route.distance_km)).quantize(Decimal("0.01"))
    base = Decimal(settings.tow_quote_base_amount)
    per_km = Decimal(settings.tow_quote_per_km_rate)
    urgency = Decimal(settings.tow_quote_urgency_surcharge)
    buffer = Decimal(str(settings.tow_quote_buffer_pct))
    cap = tow_dispatch.compute_cap_amount(
        distance_km=distance_km,
        base_amount=base,
        per_km=per_km,
        urgency_surcharge=urgency,
        buffer_pct=buffer,
    )
    expires_at = datetime.now(UTC).replace(microsecond=0) + timedelta(minutes=5)
    snapshot: dict[str, object] = {
        "pickup_lat": round(float(tow_case.pickup_lat), 5),
        "pickup_lng": round(float(tow_case.pickup_lng), 5),
        "dropoff_lat": round(float(tow_case.dropoff_lat), 5),
        "dropoff_lng": round(float(tow_case.dropoff_lng), 5),
        "distance_km": str(distance_km),
        "distance_source": route.source,
        "route_duration_minutes": route.duration_minutes,
        "base_amount": str(base),
        "per_km_rate": str(per_km),
        "urgency_surcharge": str(urgency),
        "buffer_pct": str(buffer),
        "cap_amount": str(cap),
        "currency": "TRY",
        "expires_at": expires_at.isoformat(),
    }
    if route.route_coords:
        snapshot["route_coords"] = [
            {"lat": lat, "lng": lng} for lat, lng in route.route_coords
        ]
    return snapshot


def _build_case_approval_payment_snapshot(
    approval: CaseApproval,
) -> dict[str, object]:
    return {
        "approval_id": str(approval.id),
        "approval_kind": _enum_value(approval.kind),
        "amount": str(approval.amount),
        "currency": approval.currency,
        "title": approval.title,
    }


async def _mark_case_approval_payment_failed(
    session: AsyncSession,
    order: PaymentOrder,
    message: str | None,
) -> None:
    if _enum_value(order.subject_type) != PaymentSubjectType.CASE_APPROVAL.value:
        return
    approval = await session.get(CaseApproval, order.subject_id)
    if approval is None:
        return
    approval.payment_state = CaseApprovalPaymentState.FAILED
    approval.payment_method = CaseApprovalPaymentMethod.ONLINE
    approval.payment_order_id = order.id
    await append_event(
        session,
        case_id=approval.case_id,
        event_type=CaseEventType.PAYMENT_INITIATED,
        title="Online ödeme başarısız",
        tone=CaseTone.CRITICAL,
        context={
            "payment_order_id": str(order.id),
            "approval_id": str(approval.id),
            "message": message,
        },
    )


async def _mark_case_approval_capture_paid(
    session: AsyncSession,
    order: PaymentOrder,
    *,
    provider_ref: str,
) -> None:
    if _enum_value(order.subject_type) != PaymentSubjectType.CASE_APPROVAL.value:
        return
    approval = await session.get(CaseApproval, order.subject_id)
    if approval is None:
        raise PaymentSubjectNotFoundError("approval not found")
    case = await session.get(ServiceCase, approval.case_id)
    if case is None:
        raise PaymentSubjectNotFoundError("case not found")
    if approval.status != CaseApprovalStatus.PENDING:
        return

    approval.payment_method = CaseApprovalPaymentMethod.ONLINE
    approval.payment_state = CaseApprovalPaymentState.PAID
    approval.payment_order_id = order.id
    from app.services import approval_flow

    decided = await approval_flow.approve(
        session,
        approval.id,
        actor_user_id=case.customer_user_id,
    )
    if decided.kind == CaseApprovalKind.INVOICE:
        case.billing_state = "settled"
        case.total_amount = decided.amount
    await append_event(
        session,
        case_id=case.id,
        event_type=CaseEventType.PAYMENT_AUTHORIZED,
        title="Online ödeme alındı",
        tone=CaseTone.SUCCESS,
        actor_user_id=case.customer_user_id,
        context={
            "payment_order_id": str(order.id),
            "approval_id": str(approval.id),
            "approval_kind": approval.kind.value,
            "payment_ref": provider_ref,
            "amount": str(order.amount),
        },
    )


async def _mark_tow_payment_failed(
    session: AsyncSession,
    order: PaymentOrder,
    message: str | None,
) -> None:
    if _enum_value(order.subject_type) != PaymentSubjectType.TOW_CASE.value:
        return
    tow_case = await session.get(TowCase, order.subject_id)
    case = await session.get(ServiceCase, order.subject_id)
    if tow_case is None or case is None:
        return
    tow_case.tow_stage = TowDispatchStage.PREAUTH_FAILED
    await append_event(
        session,
        case_id=case.id,
        event_type=CaseEventType.PAYMENT_INITIATED,
        title="Çekici ön provizyonu başarısız",
        tone=CaseTone.CRITICAL,
        actor_user_id=case.customer_user_id,
        context={"payment_order_id": str(order.id), "message": message},
    )


async def _mark_tow_preauth_held(
    session: AsyncSession,
    order: PaymentOrder,
    *,
    provider_ref: str,
    psp_response: dict[str, object] | None,
    redis: Redis | None,
) -> None:
    if _enum_value(order.subject_type) != PaymentSubjectType.TOW_CASE.value:
        return
    case = await session.get(ServiceCase, order.subject_id)
    tow_case = await session.get(TowCase, order.subject_id)
    if case is None or tow_case is None:
        raise PaymentSubjectNotFoundError("tow case not found")

    settlement = await tow_repo.get_settlement_by_case(session, case.id)
    if settlement is None:
        settlement = await tow_repo.create_settlement(
            session,
            case_id=case.id,
            cap_amount=order.amount,
            quoted_amount=order.amount,
        )
    now = datetime.now(UTC)
    await tow_repo.update_settlement_state(
        session,
        settlement.id,
        TowSettlementStatus.PRE_AUTH_HOLDING,
        preauth_id=provider_ref,
        preauth_authorized_at=now,
        preauth_expires_at=now + timedelta(hours=24),
        cap_amount=order.amount,
        quoted_amount=order.amount,
        psp_response=psp_response,
    )
    now_due = tow_case.scheduled_at is None or tow_case.scheduled_at <= now
    target_stage = (
        TowDispatchStage.SEARCHING
        if tow_case.tow_mode != TowMode.SCHEDULED or now_due
        else TowDispatchStage.SCHEDULED_WAITING
    )
    moved = False
    for from_stage in (
        TowDispatchStage.PAYMENT_REQUIRED,
        TowDispatchStage.PREAUTH_FAILED,
        TowDispatchStage.PREAUTH_STALE,
    ):
        moved = await tow_repo.update_tow_stage_with_lock(
            session,
            case.id,
            from_stage=from_stage,
            to_stage=target_stage,
        )
        if moved:
            break
    if moved:
        tow_case.tow_stage = target_stage
        from app.services import tow_lifecycle

        tow_lifecycle.sync_case_status(case, target_stage)
    else:
        return
    await append_event(
        session,
        case_id=case.id,
        event_type=CaseEventType.PAYMENT_AUTHORIZED,
        title="Çekici ön provizyonu alındı",
        tone=CaseTone.SUCCESS,
        actor_user_id=case.customer_user_id,
        context={
            "payment_order_id": str(order.id),
            "preauth_id": provider_ref,
            "amount": str(order.amount),
            "tow_stage": target_stage.value,
        },
    )
    if target_stage == TowDispatchStage.SCHEDULED_WAITING:
        return
    try:
        await tow_dispatch.initiate_dispatch(session, case, tow_case, redis=redis)
    except tow_dispatch.NoCandidateFoundError:
        await tow_dispatch._transition_to_pool_offered(
            session, case, tow_case, case.customer_user_id
        )


def _parse_expires_at(snapshot: dict[str, object]) -> datetime | None:
    raw = snapshot.get("expires_at")
    if not isinstance(raw, str):
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


async def _lock_payment_subject(
    session: AsyncSession,
    *,
    subject_type: PaymentSubjectType,
    subject_id: UUID,
    mode: PaymentMode,
) -> None:
    lock_key = f"{subject_type.value}:{subject_id}:{mode.value}"
    await session.execute(
        text("SELECT pg_advisory_xact_lock(hashtextextended(:lock_key, 0))"),
        {"lock_key": lock_key},
    )
