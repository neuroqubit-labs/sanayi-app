"""Messaging service — thread + message yönetimi.

- `ensure_thread(case_id)` — case thread'i yoksa oluştur, varsa döndür (idempotent)
- `post_message(thread_id, author_role, body, attachments)` — yeni mesaj +
  unread counter update (karşı taraf için +1) + preview update
- `mark_thread_read(thread_id, actor)` — ilgili unread=0 sıfırla

Yalnızca thread-only iletişim; maskelenmemiş PII paylaşılmaz (güvenli + anti-disinter).
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case_audit import CaseEventType, CaseTone
from app.models.case_communication import (
    CaseMessage,
    CaseMessageAttachment,
    CaseMessageAuthorRole,
    CaseThread,
)
from app.services.case_events import append_event


class ThreadNotFoundError(LookupError):
    pass


async def ensure_thread(
    session: AsyncSession, case_id: UUID
) -> CaseThread:
    """Case thread'i yoksa oluştur, varsa döndür."""
    stmt = select(CaseThread).where(CaseThread.case_id == case_id)
    existing = (await session.execute(stmt)).scalar_one_or_none()
    if existing is not None:
        return existing
    thread = CaseThread(case_id=case_id)
    session.add(thread)
    await session.flush()
    return thread


async def _get_thread(
    session: AsyncSession, thread_id: UUID
) -> CaseThread:
    thread = await session.get(CaseThread, thread_id)
    if thread is None:
        raise ThreadNotFoundError(str(thread_id))
    return thread


async def post_message(
    session: AsyncSession,
    *,
    thread_id: UUID,
    author_role: CaseMessageAuthorRole,
    body: str,
    author_user_id: UUID | None = None,
    author_snapshot_name: str | None = None,
    attachment_asset_ids: list[UUID] | None = None,
) -> CaseMessage:
    thread = await _get_thread(session, thread_id)

    message = CaseMessage(
        thread_id=thread.id,
        case_id=thread.case_id,
        author_user_id=author_user_id,
        author_role=author_role.value,
        author_snapshot_name=author_snapshot_name,
        body=body,
    )
    session.add(message)
    await session.flush()

    for asset_id in attachment_asset_ids or []:
        session.add(
            CaseMessageAttachment(
                message_id=message.id,
                media_asset_id=asset_id,
            )
        )

    # Unread counter update + preview
    preview = body[:500]
    counter_updates: dict[str, object] = {"preview": preview}
    if author_role == CaseMessageAuthorRole.CUSTOMER:
        counter_updates["unread_technician"] = CaseThread.unread_technician + 1
    elif author_role == CaseMessageAuthorRole.TECHNICIAN:
        counter_updates["unread_customer"] = CaseThread.unread_customer + 1
    # system mesajı: iki taraf da "bilgi amaçlı" — counter artırma (tercih)

    await session.execute(
        update(CaseThread)
        .where(CaseThread.id == thread.id)
        .values(**counter_updates)
    )
    await session.flush()

    # system mesajları audit'e basmaz (UX bilgilendirme)
    if author_role != CaseMessageAuthorRole.SYSTEM:
        await append_event(
            session,
            case_id=thread.case_id,
            event_type=CaseEventType.MESSAGE,
            title="Mesaj",
            body=preview,
            tone=CaseTone.INFO,
            actor_user_id=author_user_id,
            context={"message_id": str(message.id), "role": author_role.value},
        )
    return message


async def mark_thread_read(
    session: AsyncSession,
    thread_id: UUID,
    actor: CaseMessageAuthorRole,
) -> None:
    if actor == CaseMessageAuthorRole.CUSTOMER:
        await session.execute(
            update(CaseThread)
            .where(CaseThread.id == thread_id)
            .values(unread_customer=0)
        )
    elif actor == CaseMessageAuthorRole.TECHNICIAN:
        await session.execute(
            update(CaseThread)
            .where(CaseThread.id == thread_id)
            .values(unread_technician=0)
        )
