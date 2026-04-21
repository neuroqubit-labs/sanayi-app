"""ARQ job — fare reconcile (Plan §5 dual-hold renewal).

Hourly: preauth_expires_at yaklaşan (< 24h) case'ler için new_authorize(100%)
→ success → old_release; fail → state='preauth_stale' + customer push.

V1'de `authorize_preauth` yeniden çağrılır; cached idempotency key aynı → replay
safe. Gerçek dual-hold V1.1 Iyzico switch sonrası tam flow.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, select

from app.db.session import get_db
from app.models.tow import TowFareSettlement, TowSettlementStatus
from app.repositories import tow as tow_repo


async def fare_reconcile(ctx: dict[str, object]) -> None:
    now = datetime.now(UTC)
    horizon = now + timedelta(hours=2)
    # V1.1: PSP get_psp() ile dual-hold renewal; V1'de stub mark stale.
    async for session in get_db():
        stmt = select(TowFareSettlement).where(
            and_(
                TowFareSettlement.state == TowSettlementStatus.PRE_AUTH_HOLDING,
                TowFareSettlement.preauth_expires_at.is_not(None),
                TowFareSettlement.preauth_expires_at <= horizon,
            )
        )
        settlements = (await session.execute(stmt)).scalars().all()
        for settlement in settlements:
            # V1 stub: mark preauth_stale for operations follow-up
            # V1.1: try fresh authorize with same card_token; success → void old
            await tow_repo.update_settlement_state(
                session,
                settlement.id,
                TowSettlementStatus.PREAUTH_STALE,
                last_error="preauth approaching expiry; requires renewal",
            )
        await session.commit()
        break
