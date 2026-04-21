"""ARQ job — dispatch attempt 15sn timeout.

Service `initiate_dispatch` sonrası enqueue edilir (`_defer_by=15s`). Job firing:
- attempt hâlâ 'pending' ise → record_dispatch_response(timeout) + next candidate
- attempt 'accepted' / 'declined' ise → no-op (gözlemci idempotent)
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from app.db.session import get_db
from app.models.tow import TowDispatchAttempt, TowDispatchResponse
from app.services import tow_dispatch as dispatch_svc


async def dispatch_attempt_timeout(
    ctx: dict[str, object], attempt_id: str
) -> None:
    attempt_uuid = UUID(attempt_id)
    async for session in get_db():
        attempt = await session.get(TowDispatchAttempt, attempt_uuid)
        if attempt is None or attempt.response != TowDispatchResponse.PENDING:
            return
        from app.models.case import ServiceCase

        case = await session.get(ServiceCase, attempt.case_id)
        if case is None:
            return
        await dispatch_svc.record_dispatch_response(
            session,
            case=case,
            attempt_id=attempt_uuid,
            response=TowDispatchResponse.TIMEOUT,
            actor_user_id=attempt.technician_id,
            rejection_reason="timeout",
        )
        await session.commit()
        break


async def current_offer_expiry(ctx: dict[str, object]) -> None:
    """Periodic — release technician_profiles.current_offer_case_id stuck > 15s."""
    from sqlalchemy import text as _text

    cutoff = datetime.now(UTC) - timedelta(seconds=15)
    async for session in get_db():
        await session.execute(
            _text(
                """
                UPDATE technician_profiles
                SET current_offer_case_id = NULL,
                    current_offer_issued_at = NULL
                WHERE current_offer_issued_at IS NOT NULL
                  AND current_offer_issued_at < :cutoff
                """
            ),
            {"cutoff": cutoff},
        )
        await session.commit()
        break
