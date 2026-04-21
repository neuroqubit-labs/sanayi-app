"""Auth repository — refresh session + OTP code queries.

All helpers are async and take an explicit `AsyncSession`. No raw token or code
values cross this boundary; callers must hash before calling.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import AuthSession, OtpChannel, OtpCode
from app.models.user import UserRole

# ─── AuthSession ────────────────────────────────────────────────────────────


async def create_auth_session(
    session: AsyncSession,
    *,
    user_id: UUID,
    refresh_token_hash: str,
    issued_at: datetime,
    expires_at: datetime,
    device_label: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> AuthSession:
    row = AuthSession(
        user_id=user_id,
        refresh_token_hash=refresh_token_hash,
        issued_at=issued_at,
        expires_at=expires_at,
        device_label=device_label,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    session.add(row)
    await session.flush()
    return row


async def find_active_session_by_hash(
    session: AsyncSession, refresh_token_hash: str
) -> AuthSession | None:
    now = datetime.now(UTC)
    stmt = select(AuthSession).where(
        and_(
            AuthSession.refresh_token_hash == refresh_token_hash,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > now,
        )
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_active_sessions_for_user(
    session: AsyncSession, user_id: UUID
) -> list[AuthSession]:
    now = datetime.now(UTC)
    stmt = (
        select(AuthSession)
        .where(
            and_(
                AuthSession.user_id == user_id,
                AuthSession.revoked_at.is_(None),
                AuthSession.expires_at > now,
            )
        )
        .order_by(AuthSession.issued_at.desc())
    )
    return list((await session.execute(stmt)).scalars().all())


async def revoke_session(session: AsyncSession, session_id: UUID) -> None:
    await session.execute(
        update(AuthSession)
        .where(AuthSession.id == session_id)
        .values(revoked_at=datetime.now(UTC))
    )


async def revoke_all_sessions_for_user(
    session: AsyncSession, user_id: UUID
) -> None:
    """Kullanıcının tüm aktif session'larını revoke et (soft delete + güvenlik)."""
    await session.execute(
        update(AuthSession)
        .where(
            and_(
                AuthSession.user_id == user_id,
                AuthSession.revoked_at.is_(None),
            )
        )
        .values(revoked_at=datetime.now(UTC))
    )


async def touch_session(session: AsyncSession, session_id: UUID) -> None:
    await session.execute(
        update(AuthSession)
        .where(AuthSession.id == session_id)
        .values(last_used_at=datetime.now(UTC))
    )


# ─── OtpCode ────────────────────────────────────────────────────────────────


async def create_otp_code(
    session: AsyncSession,
    *,
    phone: str,
    code_hash: str,
    target_role: UserRole,
    channel: OtpChannel,
    expires_at: datetime,
    delivery_id: str | None = None,
) -> OtpCode:
    row = OtpCode(
        phone=phone,
        code_hash=code_hash,
        target_role=target_role,
        channel=channel,
        expires_at=expires_at,
        delivery_id=delivery_id,
    )
    session.add(row)
    await session.flush()
    return row


async def find_latest_active_otp(
    session: AsyncSession, phone: str
) -> OtpCode | None:
    now = datetime.now(UTC)
    stmt = (
        select(OtpCode)
        .where(
            and_(
                OtpCode.phone == phone,
                OtpCode.consumed_at.is_(None),
                OtpCode.expires_at > now,
            )
        )
        .order_by(OtpCode.created_at.desc())
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def count_recent_otps_for_phone(
    session: AsyncSession, phone: str, within: timedelta
) -> int:
    threshold = datetime.now(UTC) - within
    stmt = select(OtpCode).where(
        and_(OtpCode.phone == phone, OtpCode.created_at > threshold)
    )
    return len(list((await session.execute(stmt)).scalars().all()))


async def mark_otp_consumed(session: AsyncSession, otp_id: UUID) -> None:
    await session.execute(
        update(OtpCode)
        .where(OtpCode.id == otp_id)
        .values(consumed_at=datetime.now(UTC))
    )


async def increment_otp_attempts(session: AsyncSession, otp_id: UUID) -> int:
    stmt = (
        update(OtpCode)
        .where(OtpCode.id == otp_id)
        .values(attempts=OtpCode.attempts + 1)
        .returning(OtpCode.attempts)
    )
    result = await session.execute(stmt)
    return result.scalar_one()
