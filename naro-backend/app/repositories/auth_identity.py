"""UserIdentity + AuthEvent repositories — CRUD + lookup helpers."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth_event import AuthEvent, AuthEventType
from app.models.auth_identity import AuthIdentityProvider, UserIdentity

# ─── UserIdentity ───────────────────────────────────────────────────────────


async def find_identity(
    session: AsyncSession,
    provider: AuthIdentityProvider,
    provider_user_id: str,
) -> UserIdentity | None:
    stmt = select(UserIdentity).where(
        and_(
            UserIdentity.provider == provider,
            UserIdentity.provider_user_id == provider_user_id,
        )
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def find_identities_by_email(
    session: AsyncSession, email: str
) -> list[UserIdentity]:
    stmt = select(UserIdentity).where(UserIdentity.email == email)
    return list((await session.execute(stmt)).scalars().all())


async def create_identity(
    session: AsyncSession,
    *,
    user_id: UUID,
    provider: AuthIdentityProvider,
    provider_user_id: str,
    email: str | None = None,
    raw_profile: dict[str, object] | None = None,
    verified: bool = False,
) -> UserIdentity:
    identity = UserIdentity(
        user_id=user_id,
        provider=provider,
        provider_user_id=provider_user_id,
        email=email,
        raw_profile=raw_profile or {},
        verified_at=datetime.now(UTC) if verified else None,
    )
    session.add(identity)
    await session.flush()
    return identity


async def list_identities_for_user(
    session: AsyncSession, user_id: UUID
) -> list[UserIdentity]:
    stmt = (
        select(UserIdentity)
        .where(UserIdentity.user_id == user_id)
        .order_by(UserIdentity.created_at)
    )
    return list((await session.execute(stmt)).scalars().all())


async def touch_identity(
    session: AsyncSession, identity_id: UUID
) -> None:
    from sqlalchemy import update as sa_update

    await session.execute(
        sa_update(UserIdentity)
        .where(UserIdentity.id == identity_id)
        .values(last_used_at=datetime.now(UTC))
    )


# ─── AuthEvent ──────────────────────────────────────────────────────────────


async def insert_auth_event(
    session: AsyncSession,
    *,
    event_type: AuthEventType,
    user_id: UUID | None = None,
    session_id: UUID | None = None,
    actor: str = "user",
    ip_address: str | None = None,
    user_agent: str | None = None,
    target: str | None = None,
    context: dict[str, object] | None = None,
    body: str | None = None,
) -> AuthEvent:
    event = AuthEvent(
        event_type=event_type,
        user_id=user_id,
        session_id=session_id,
        actor=actor,
        ip_address=ip_address,
        user_agent=user_agent,
        target=target,
        context=context or {},
        body=body,
    )
    session.add(event)
    await session.flush()
    return event


async def count_failed_events_for_target(
    session: AsyncSession,
    target: str,
    *,
    since: timedelta,
) -> int:
    threshold = datetime.now(UTC) - since
    stmt = (
        select(func.count())
        .select_from(AuthEvent)
        .where(
            and_(
                AuthEvent.target == target,
                AuthEvent.event_type.in_(
                    (AuthEventType.OTP_FAILED, AuthEventType.LOGIN_FAILED)
                ),
                AuthEvent.created_at > threshold,
            )
        )
    )
    return int((await session.execute(stmt)).scalar_one() or 0)


async def list_events_for_user(
    session: AsyncSession, user_id: UUID, *, limit: int = 50
) -> list[AuthEvent]:
    stmt = (
        select(AuthEvent)
        .where(AuthEvent.user_id == user_id)
        .order_by(AuthEvent.created_at.desc())
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars().all())
