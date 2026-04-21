"""Case events service — append-only audit log + bildirim intent queue.

Eksen 5 [5a]: explicit service-layer call. Her service mutation sonrası
`append_event()` çağırılır. Eksen 5 [5b]: context JSONB — old_value/new_value.

Bildirim intent'ları caller tarafından `publish_intent()` ile yazılır (opsiyonel).
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case_audit import (
    CaseEvent,
    CaseEventType,
    CaseNotificationIntent,
    CaseNotificationIntentType,
    CaseTone,
)


async def append_event(
    session: AsyncSession,
    *,
    case_id: UUID,
    event_type: CaseEventType,
    title: str,
    body: str | None = None,
    tone: CaseTone = CaseTone.NEUTRAL,
    actor_user_id: UUID | None = None,
    context: dict[str, object] | None = None,
) -> CaseEvent:
    """Append-only event. Caller transaction'ında çalışır; commit caller'da."""
    event = CaseEvent(
        case_id=case_id,
        event_type=event_type,
        title=title,
        body=body,
        tone=tone.value,
        actor_user_id=actor_user_id,
        context=context or {},
    )
    session.add(event)
    await session.flush()
    return event


async def publish_intent(
    session: AsyncSession,
    *,
    case_id: UUID,
    intent_type: CaseNotificationIntentType,
    actor: str,
    title: str,
    body: str | None = None,
    route_hint: str | None = None,
    task_id: UUID | None = None,
) -> CaseNotificationIntent:
    """Mobil/sunucu bildirim kuyrudu — push/sms delivery Faz 8+."""
    intent = CaseNotificationIntent(
        case_id=case_id,
        task_id=task_id,
        intent_type=intent_type,
        actor=actor,
        title=title,
        body=body,
        route_hint=route_hint,
    )
    session.add(intent)
    await session.flush()
    return intent


async def mark_intent_read(
    session: AsyncSession, intent_id: UUID
) -> None:
    from datetime import UTC, datetime

    from sqlalchemy import update

    await session.execute(
        update(CaseNotificationIntent)
        .where(CaseNotificationIntent.id == intent_id)
        .values(is_new=False, read_at=datetime.now(UTC))
    )
