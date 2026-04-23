"""ARQ cron — appointment expiry sweep (B-P1-10 emit disiplini).

Pending appointments expires_at < NOW → EXPIRED + per-case
APPOINTMENT_EXPIRED event emit. Her 5 dakikada bir.
"""

from __future__ import annotations

import logging

from app.db.session import AsyncSessionLocal
from app.models.case_audit import CaseEventType, CaseTone
from app.repositories import appointment as appointment_repo
from app.services.case_events import append_event

logger = logging.getLogger("worker.appointment_expiry")


async def appointment_expiry_job(ctx: dict[str, object]) -> None:
    async with AsyncSessionLocal() as session:
        expired = await appointment_repo.expire_pending_appointments_returning(
            session
        )
        for appt_id, case_id in expired:
            await append_event(
                session,
                case_id=case_id,
                event_type=CaseEventType.APPOINTMENT_EXPIRED,
                title="Randevu süresi doldu",
                tone=CaseTone.WARNING,
                context={"appointment_id": str(appt_id)},
            )
        await session.commit()
        if expired:
            logger.info(
                "appointment_expiry_job: %d appointments expired",
                len(expired),
            )
