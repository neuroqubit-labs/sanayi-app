"""Scheduled tow payment window and dispatch sweep."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_db
from app.models.case import ServiceCase, ServiceRequestKind, TowDispatchStage, TowMode
from app.models.case_audit import CaseEventType, CaseTone
from app.models.case_subtypes import TowCase
from app.models.payment import PaymentMode, PaymentState, PaymentSubjectType
from app.repositories import tow as tow_repo
from app.services import payment_core, tow_dispatch, tow_lifecycle
from app.services.case_events import append_event


def _value(value: object) -> str:
    return str(getattr(value, "value", value))


async def scheduled_payment_window(ctx: dict[str, object]) -> None:
    """Open preauth window for scheduled tow jobs shortly before pickup.

    Scheduled tow does not hold a card at case creation time. When the pickup
    time enters the configured lead window, the case moves to payment_required.
    If a preauth was already held and the pickup time has arrived, dispatch
    starts from the same sweep.
    """

    _ = ctx
    settings = get_settings()
    now = datetime.now(UTC)
    cutoff = now + timedelta(minutes=settings.tow_scheduled_payment_lead_minutes)
    async for session in get_db():
        stmt = (
            select(ServiceCase, TowCase)
            .join(TowCase, TowCase.case_id == ServiceCase.id)
            .where(
                ServiceCase.kind == ServiceRequestKind.TOWING,
                ServiceCase.deleted_at.is_(None),
                TowCase.tow_mode == TowMode.SCHEDULED,
                TowCase.tow_stage == TowDispatchStage.SCHEDULED_WAITING,
                TowCase.scheduled_at.is_not(None),
                TowCase.scheduled_at <= cutoff,
            )
            .order_by(TowCase.scheduled_at.asc())
            .limit(100)
        )
        for case, tow_case in (await session.execute(stmt)).all():
            order = await payment_core.get_payment_order(
                session,
                subject_type=PaymentSubjectType.TOW_CASE,
                subject_id=case.id,
                mode=PaymentMode.PREAUTH_CAPTURE,
            )
            state = _value(order.state) if order is not None else None
            if state == PaymentState.PREAUTH_HELD.value:
                if tow_case.scheduled_at and tow_case.scheduled_at <= now:
                    await _start_scheduled_dispatch(session, case, tow_case)
                continue
            if state == PaymentState.PREAUTH_REQUESTED.value:
                continue

            await payment_core.ensure_tow_payment_required(
                session, case=case, tow_case=tow_case
            )
            moved = await tow_repo.update_tow_stage_with_lock(
                session,
                case.id,
                from_stage=TowDispatchStage.SCHEDULED_WAITING,
                to_stage=TowDispatchStage.PAYMENT_REQUIRED,
            )
            if moved:
                tow_case.tow_stage = TowDispatchStage.PAYMENT_REQUIRED
                tow_lifecycle.sync_case_status(case, TowDispatchStage.PAYMENT_REQUIRED)
                await append_event(
                    session,
                    case_id=case.id,
                    event_type=CaseEventType.PAYMENT_INITIATED,
                    title="Planlı çekici ödeme penceresi açıldı",
                    tone=CaseTone.INFO,
                    actor_user_id=case.customer_user_id,
                    context={
                        "scheduled_at": tow_case.scheduled_at.isoformat()
                        if tow_case.scheduled_at
                        else None,
                        "lead_minutes": settings.tow_scheduled_payment_lead_minutes,
                    },
                )
        await session.commit()
        break


async def _start_scheduled_dispatch(
    session: AsyncSession,
    case: ServiceCase,
    tow_case: TowCase,
) -> None:
    moved = await tow_repo.update_tow_stage_with_lock(
        session,
        case.id,
        from_stage=TowDispatchStage.SCHEDULED_WAITING,
        to_stage=TowDispatchStage.SEARCHING,
    )
    if not moved:
        return
    tow_case.tow_stage = TowDispatchStage.SEARCHING
    tow_lifecycle.sync_case_status(case, TowDispatchStage.SEARCHING)
    await append_event(
        session,
        case_id=case.id,
        event_type=CaseEventType.TOW_STAGE_COMMITTED,
        title="Planlı çekici araması başladı",
        tone=CaseTone.INFO,
        actor_user_id=case.customer_user_id,
        context={
            "from_stage": TowDispatchStage.SCHEDULED_WAITING.value,
            "to_stage": TowDispatchStage.SEARCHING.value,
        },
    )
    try:
        await tow_dispatch.initiate_dispatch(session, case, tow_case, redis=None)
    except tow_dispatch.NoCandidateFoundError:
        await tow_dispatch.transition_to_no_candidate_found(
            session, case, tow_case, case.customer_user_id
        )
