"""Refresh token rotation + family chain + reuse attack detection.

Faz 9a. Strict rotation:
- Her `/auth/refresh` çağrısı yeni access + refresh pair üretir.
- Eski session revoke edilir; yeni session same `token_family_id`, `parent_session_id = eski.id`.
- Eğer revoke edilmiş refresh token tekrar kullanılırsa (hırsızlık sinyali):
  - Bütün family revoke (`revoke_family`)
  - `auth_event.REFRESH_REUSED_ATTACK` + `SUSPICIOUS_LOGIN` emit
  - 401 raise

Raw token hiçbir zaman DB'de yok; `hash_refresh_token` (sha256) ile lookup.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import (
    create_token,
    hash_refresh_token,
    validate_refresh_token,
)
from app.models.auth import AuthSession
from app.models.auth_event import AuthEventType
from app.models.auth_identity import AuthIdentityProvider
from app.services.auth_events import append_auth_event


class TokenPair:
    __slots__ = ("access_token", "refresh_token")

    def __init__(self, access_token: str, refresh_token: str) -> None:
        self.access_token = access_token
        self.refresh_token = refresh_token


class InvalidRefreshTokenError(ValueError):
    pass


class RefreshTokenReuseAttackError(ValueError):
    """Revoke edilmiş refresh token tekrar kullanıldı — family revoke."""


async def _find_session_by_hash(
    session: AsyncSession, token_hash: str
) -> AuthSession | None:
    stmt = select(AuthSession).where(AuthSession.refresh_token_hash == token_hash)
    return (await session.execute(stmt)).scalar_one_or_none()


async def revoke_family(
    session: AsyncSession, family_id: UUID
) -> None:
    """Token family'nin tümünü revoke et (reuse attack sonrası)."""
    now = datetime.now(UTC)
    await session.execute(
        update(AuthSession)
        .where(
            and_(
                AuthSession.token_family_id == family_id,
                AuthSession.revoked_at.is_(None),
            )
        )
        .values(revoked_at=now)
    )


async def issue_initial_session(
    session: AsyncSession,
    *,
    user_id: UUID,
    issued_via: AuthIdentityProvider,
    ip_address: str | None = None,
    user_agent: str | None = None,
    device_label: str | None = None,
) -> TokenPair:
    """İlk login (OTP verify veya OAuth callback) sonrası session + pair üretir.

    `token_family_id` kendine eşit (root session).
    """
    settings = get_settings()
    now = datetime.now(UTC)
    refresh_ttl = timedelta(days=settings.jwt_refresh_token_expire_days)

    refresh_token = create_token(str(user_id), "refresh")
    access_token = create_token(str(user_id), "access")

    auth_session = AuthSession(
        user_id=user_id,
        refresh_token_hash=hash_refresh_token(refresh_token),
        issued_at=now,
        expires_at=now + refresh_ttl,
        device_label=device_label,
        ip_address=ip_address,
        user_agent=user_agent,
        issued_via=issued_via,
    )
    session.add(auth_session)
    await session.flush()

    # family_id = self
    await session.execute(
        update(AuthSession)
        .where(AuthSession.id == auth_session.id)
        .values(token_family_id=auth_session.id)
    )
    await session.refresh(auth_session)

    return TokenPair(access_token=access_token, refresh_token=refresh_token)


async def rotate_refresh_token(
    session: AsyncSession,
    *,
    refresh_token_raw: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> TokenPair:
    """Refresh token → yeni pair + eski revoke + family chain.

    Attack detection: revoke edilmiş refresh token tekrar kullanılırsa family revoke.
    """
    # JWT validate
    try:
        payload = validate_refresh_token(refresh_token_raw)
    except ValueError as exc:
        raise InvalidRefreshTokenError(str(exc)) from exc

    user_id = UUID(payload["sub"])
    token_hash = hash_refresh_token(refresh_token_raw)

    # Session lookup (aktif veya revoked)
    existing = await _find_session_by_hash(session, token_hash)
    if existing is None:
        # Session hiç yok — muhtemelen tamamen uydurma token veya expired+cleanup
        raise InvalidRefreshTokenError("session not found for this refresh token")

    now = datetime.now(UTC)

    # Reuse attack detection
    if existing.revoked_at is not None or existing.expires_at <= now:
        if existing.token_family_id is not None:
            await revoke_family(session, existing.token_family_id)
        await append_auth_event(
            session,
            event_type=AuthEventType.REFRESH_REUSED_ATTACK,
            user_id=user_id,
            session_id=existing.id,
            ip_address=ip_address,
            user_agent=user_agent,
            context={
                "reason": "reuse" if existing.revoked_at else "expired",
                "family_id": str(existing.token_family_id)
                if existing.token_family_id
                else None,
            },
        )
        raise RefreshTokenReuseAttackError(
            "refresh token reused or expired; family revoked"
        )

    # Geçerli rotation
    settings = get_settings()
    refresh_ttl = timedelta(days=settings.jwt_refresh_token_expire_days)

    new_refresh = create_token(str(user_id), "refresh")
    new_access = create_token(str(user_id), "access")
    new_hash = hash_refresh_token(new_refresh)

    # Yeni session insert (same family)
    new_session = AuthSession(
        user_id=user_id,
        refresh_token_hash=new_hash,
        issued_at=now,
        expires_at=now + refresh_ttl,
        device_label=existing.device_label,
        ip_address=ip_address or existing.ip_address,
        user_agent=user_agent or existing.user_agent,
        issued_via=existing.issued_via,
        token_family_id=existing.token_family_id,
        parent_session_id=existing.id,
    )
    session.add(new_session)
    await session.flush()

    # Eski session revoke
    await session.execute(
        update(AuthSession)
        .where(AuthSession.id == existing.id)
        .values(revoked_at=now, last_used_at=now)
    )

    await append_auth_event(
        session,
        event_type=AuthEventType.REFRESH_ROTATED,
        user_id=user_id,
        session_id=new_session.id,
        ip_address=ip_address,
        user_agent=user_agent,
        context={
            "family_id": str(existing.token_family_id) if existing.token_family_id else None,
            "parent_session_id": str(existing.id),
        },
    )

    return TokenPair(access_token=new_access, refresh_token=new_refresh)
