"""ARQ cron — stale case auto-archive (B-P1-7).

Ürün kararı K2: 48 saat MATCHING statüsünde hareket olmayan case'ler
CANCELLED + AUTO_ARCHIVED event. Pilot UX güveni: müşteri eski case'lerden
haberdar olmadan listesi şişmez.

Brief: be-pilot-finale-lifecycle-fixes § B-P1-7.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from app.db.session import AsyncSessionLocal
from app.models.case import ServiceCaseStatus
from app.models.case_audit import CaseEventType, CaseTone
from app.repositories import case as case_repo
from app.services.case_events import append_event
from app.services.case_lifecycle import transition_case_status

logger = logging.getLogger("worker.stale_case_archive")

STALE_THRESHOLD_HOURS = 48


async def stale_case_archive_job(ctx: dict[str, object]) -> None:
    threshold = datetime.now(UTC) - timedelta(hours=STALE_THRESHOLD_HOURS)
    async with AsyncSessionLocal() as session:
        stale = await case_repo.list_stale_matching_cases(
            session, threshold=threshold
        )
        archived = 0
        for case in stale:
            await transition_case_status(
                session,
                case.id,
                ServiceCaseStatus.CANCELLED,
                actor_user_id=None,
            )
            await append_event(
                session,
                case_id=case.id,
                event_type=CaseEventType.AUTO_ARCHIVED,
                title="Otomatik arşivlendi",
                body=(
                    f"{STALE_THRESHOLD_HOURS} saat boyunca hareket yok. "
                    "Yeniden vaka açabilirsiniz."
                ),
                tone=CaseTone.INFO,
                context={
                    "reason": "stale_no_activity",
                    "threshold_hours": STALE_THRESHOLD_HOURS,
                },
            )
            archived += 1
        await session.commit()
        if archived:
            logger.info(
                "stale_case_archive_job: %d cases auto-archived",
                archived,
            )
