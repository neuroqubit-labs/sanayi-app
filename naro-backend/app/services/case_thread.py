"""Case thread servisi — mesaj create/list + anti-disintermediation (İş 3).

Anti-disintermediation rejected pattern (V1 minimal):
- Türk mobil telefon numarası (+90 5xx xxx xx xx, 10-13 rakam variantları)
- Email (RFC basit)

V1.1 backlog: ML-based detection + escrow açıldıktan sonra allowlist.

Thread invariant: case.status yaşayan ve `deleted_at IS NULL`. Settled
(COMPLETED/ARCHIVED/CANCELLED) → mesaj YAZMA 403; okuma serbest.
"""

from __future__ import annotations

import base64
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case import ServiceCase, ServiceCaseStatus
from app.models.case_communication import CaseMessage, CaseThread
from app.models.user import User

# Türk mobil + uluslararası prefix; boşluk/tire/nokta ayırıcıları kabul et.
# Örn. 05321234567, +905321234567, 90 532 123 45 67, (0532)123-45-67
_PHONE_RE = re.compile(
    r"(?:\+?9?0)?[\s\-.()]*5\d{2}[\s\-.()]*\d{3}[\s\-.()]*\d{2}[\s\-.()]*\d{2}"
)
_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")

_TERMINAL_STATUSES = {
    ServiceCaseStatus.COMPLETED,
    ServiceCaseStatus.ARCHIVED,
    ServiceCaseStatus.CANCELLED,
}


class DisintermediationRejectedError(ValueError):
    """Mesaj içeriğinde telefon/email paylaşımı tespit edildi."""


class ThreadClosedError(ValueError):
    """Case terminal statüste — mesaj yazılamaz."""


def detect_disintermediation(content: str) -> str | None:
    """Telefon/email pattern'i bulursa kısa label döner; yoksa None.

    Label 422 response'da "type" field'ı olarak kullanılır.
    """
    if _PHONE_RE.search(content):
        return "phone_number"
    if _EMAIL_RE.search(content):
        return "email"
    return None


def resolve_sender_role(case: ServiceCase, user: User) -> str:
    """customer | technician — participant değilse ValueError (route 403)."""
    if case.customer_user_id == user.id:
        return "customer"
    if case.assigned_technician_id == user.id:
        return "technician"
    raise ValueError("not a case participant")


async def _get_or_create_thread(
    session: AsyncSession, case_id: UUID
) -> CaseThread:
    stmt = select(CaseThread).where(CaseThread.case_id == case_id)
    thread = (await session.execute(stmt)).scalar_one_or_none()
    if thread is not None:
        return thread
    thread = CaseThread(case_id=case_id)
    session.add(thread)
    await session.flush()
    return thread


@dataclass(slots=True)
class CreatedMessage:
    id: UUID
    sender_role: str
    content: str
    created_at: datetime


async def create_message(
    session: AsyncSession,
    *,
    case: ServiceCase,
    user: User,
    content: str,
) -> CreatedMessage:
    """Mesaj insert + thread preview/unread counter update.

    Invariants:
    - case terminal statüde değil
    - content anti-disintermediation check passed
    - sender = customer_user_id veya assigned_technician_id
    """
    if case.status in _TERMINAL_STATUSES:
        raise ThreadClosedError(case.status.value)
    label = detect_disintermediation(content)
    if label is not None:
        raise DisintermediationRejectedError(label)
    sender_role = resolve_sender_role(case, user)

    thread = await _get_or_create_thread(session, case.id)

    message = CaseMessage(
        thread_id=thread.id,
        case_id=case.id,
        author_user_id=user.id,
        author_role=sender_role,
        author_snapshot_name=user.full_name,
        body=content,
    )
    session.add(message)
    await session.flush()

    # Thread preview/unread counter
    thread.preview = content[:512]
    if sender_role == "customer":
        thread.unread_technician += 1
    else:
        thread.unread_customer += 1

    return CreatedMessage(
        id=message.id,
        sender_role=sender_role,
        content=content,
        created_at=message.created_at,
    )


@dataclass(slots=True)
class MessagePage:
    items: list[CaseMessage]
    next_cursor: str | None


def _encode_cursor(created_at: datetime, message_id: UUID) -> str:
    raw = f"{created_at.isoformat()}|{message_id}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def _decode_cursor(cursor: str) -> tuple[datetime, UUID]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        ts_str, uid_str = raw.split("|", 1)
        return datetime.fromisoformat(ts_str), UUID(uid_str)
    except (ValueError, TypeError) as exc:
        raise ValueError("invalid cursor") from exc


async def list_messages(
    session: AsyncSession,
    *,
    case_id: UUID,
    limit: int,
    cursor: str | None,
) -> MessagePage:
    """DESC created_at; cursor = son dönen satırın (created_at, id) base64.

    Soft delete'li mesajlar hariç.
    """
    conds = [
        CaseMessage.case_id == case_id,
        CaseMessage.deleted_at.is_(None),
    ]
    if cursor:
        cur_ts, cur_id = _decode_cursor(cursor)
        conds.append(
            (CaseMessage.created_at < cur_ts)
            | (
                (CaseMessage.created_at == cur_ts)
                & (CaseMessage.id < cur_id)
            )
        )
    stmt = (
        select(CaseMessage)
        .where(and_(*conds))
        .order_by(CaseMessage.created_at.desc(), CaseMessage.id.desc())
        .limit(limit + 1)
    )
    rows = list((await session.execute(stmt)).scalars().all())
    has_more = len(rows) > limit
    items = rows[:limit]
    next_cursor = (
        _encode_cursor(items[-1].created_at, items[-1].id)
        if has_more and items
        else None
    )
    return MessagePage(items=items, next_cursor=next_cursor)


async def mark_seen(
    session: AsyncSession,
    *,
    case: ServiceCase,
    user: User,
) -> None:
    """sender_role'e göre last_seen_by_customer veya
    last_seen_by_technician = NOW(). Unread counter sıfırlanır.
    """
    role = resolve_sender_role(case, user)
    now = datetime.now(UTC)
    if role == "customer":
        case.last_seen_by_customer = now
    else:
        case.last_seen_by_technician = now

    # Unread counter reset (karşı tarafın sayacı değil, okuyanın)
    thread_stmt = select(CaseThread).where(CaseThread.case_id == case.id)
    thread = (await session.execute(thread_stmt)).scalar_one_or_none()
    if thread is None:
        return
    if role == "customer":
        await session.execute(
            update(CaseThread)
            .where(CaseThread.id == thread.id)
            .values(unread_customer=0)
        )
    else:
        await session.execute(
            update(CaseThread)
            .where(CaseThread.id == thread.id)
            .values(unread_technician=0)
        )
