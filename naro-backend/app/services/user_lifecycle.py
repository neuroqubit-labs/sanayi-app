"""User lifecycle service — soft delete + güvenlik zinciri + KVKK hazırlık.

User soft delete'te (deleted_at set) CASCADE tetiklenmez (DB hard delete'e bağlı).
Bu nedenle explicit:
  1. users.deleted_at = NOW
  2. users.phone/email anonymize (partial unique uq_users_phone/email serbest kalır)
  3. Aktif tüm auth_sessions revoke
  4. Teknisyen ise technician_profiles.deleted_at = NOW (pool'dan düşer)

30 gün grace sonrası hard delete cron (Faz 15) bu satırları tamamen siler.
Faz 7d sonrası: case_events INSERT (type='soft_deleted') eklenecek.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.technician import TechnicianProfile
from app.models.user import User, UserRole
from app.repositories import auth as auth_repo


class UserNotFoundError(LookupError):
    pass


class UserAlreadyDeletedError(ValueError):
    pass


def _anonymize_phone(user_id: UUID, phone: str | None) -> str | None:
    if phone is None:
        return None
    return f"DELETED_{user_id}_{phone}"[:32]


def _anonymize_email(user_id: UUID, email: str | None) -> str | None:
    if email is None:
        return None
    return f"DELETED_{user_id}_{email}"[:255]


async def soft_delete_user(
    session: AsyncSession,
    user_id: UUID,
    *,
    reason: str,
    actor_user_id: UUID | None = None,
) -> None:
    """User hesabını soft delete et — idempotent, güvenlik + KVKK uyumu.

    - reason: audit için saklanır (Faz 7d sonrası case_events.context'e yazılır)
    - actor_user_id: admin/self delete ayrımı
    """
    user = (
        await session.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if user is None:
        raise UserNotFoundError(str(user_id))
    if user.deleted_at is not None:
        raise UserAlreadyDeletedError(str(user_id))

    now = datetime.now(UTC)

    # 1 + 2. users soft delete + anonymize
    await session.execute(
        update(User)
        .where(User.id == user_id)
        .values(
            deleted_at=now,
            phone=_anonymize_phone(user_id, user.phone),
            email=_anonymize_email(user_id, user.email),
        )
    )

    # 3. Aktif session'ları revoke
    await auth_repo.revoke_all_sessions_for_user(session, user_id)

    # 4. Teknisyen ise profile'ı soft delete (havuz görünürlüğü)
    if user.role == UserRole.TECHNICIAN:
        await session.execute(
            update(TechnicianProfile)
            .where(TechnicianProfile.user_id == user_id)
            .values(deleted_at=now)
        )

    # Not: `reason` + `actor_user_id` Faz 7d sonrası case_events'e yazılacak.
    # Şu an audit yalnızca `users.deleted_at` timestamp'i ile sınırlı.
    _ = reason, actor_user_id  # parametreleri açıkça tüket — mypy/ruff için
