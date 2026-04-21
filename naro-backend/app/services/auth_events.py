"""Auth events helper — append-only audit + PII masking."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth_event import AuthEvent, AuthEventType
from app.repositories import auth_identity as identity_repo


def mask_target(target: str | None) -> str | None:
    """Phone/email partial mask: `+90***1234`, `u***@domain.com`."""
    if not target:
        return None
    if "@" in target:
        local, _, domain = target.partition("@")
        if len(local) <= 1:
            return f"*@{domain}"
        return f"{local[0]}***@{domain}"
    # Phone
    if len(target) <= 4:
        return "*" * len(target)
    return f"{target[:3]}***{target[-4:]}"


async def append_auth_event(
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
    """PII otomatik maskelenir; caller raw target geçebilir."""
    return await identity_repo.insert_auth_event(
        session,
        event_type=event_type,
        user_id=user_id,
        session_id=session_id,
        actor=actor,
        ip_address=ip_address,
        user_agent=user_agent,
        target=mask_target(target),
        context=context,
        body=body,
    )
