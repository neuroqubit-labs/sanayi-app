"""ARQ cron — offer expiry sweep (B-P1-6).

Pending offers expires_at < NOW → EXPIRED + per-case OFFER_EXPIRED event
emit. 5 dakikada bir (pilot ölçeği için yeter; ölçek artarsa 1 dk).

Brief: be-pilot-finale-lifecycle-fixes § B-P1-6.
"""

from __future__ import annotations

import logging

from app.db.session import AsyncSessionLocal
from app.models.case_audit import CaseEventType, CaseTone
from app.repositories import offer as offer_repo
from app.services.case_events import append_event

logger = logging.getLogger("worker.offer_expiry")


async def offer_expiry_job(ctx: dict[str, object]) -> None:  # noqa: ARG001
    async with AsyncSessionLocal() as session:
        expired = await offer_repo.expire_stale_offers_returning(session)
        for offer_id, case_id in expired:
            await append_event(
                session,
                case_id=case_id,
                event_type=CaseEventType.OFFER_EXPIRED,
                title="Teklif süresi doldu",
                tone=CaseTone.NEUTRAL,
                context={"offer_id": str(offer_id)},
            )
        await session.commit()
        if expired:
            logger.info("offer_expiry_job: %d offers expired", len(expired))
