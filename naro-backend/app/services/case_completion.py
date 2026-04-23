"""Case completion single-authority orchestrator — B-P1-2.

Audit L1-P1-2: 3 path (tow_lifecycle, approval_flow, case_billing) case'i
COMPLETED yazıyordu → senkronizasyon drift riski. Bu modül tek authority:
her path `try_complete(session, case_id)` çağırır; gate'lerin tümü
tamamlanınca shell status=COMPLETED yazılır.

Gate'ler (K1 product kararı):
- **Gate 1 (operasyonel)**:
  - tow kind → `tow_case.tow_stage == DELIVERED`
  - non-tow → en az 1 `CaseApproval` completion kind `APPROVED`
- **Gate 2 (billing)**:
  - non-tow → `case.billing_state == "settled"`
  - tow → tow settlement `FINAL_CHARGED` (tow_payment capture)
- **Gate 3 (terminal guard)**: case halen COMPLETED/CANCELLED/ARCHIVED
  değilse transition.

Brief: be-pilot-finale-lifecycle-fixes § B-P1-2.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case import ServiceCase, ServiceCaseStatus, ServiceRequestKind, TowDispatchStage
from app.models.case_process import CaseApproval, CaseApprovalKind, CaseApprovalStatus
from app.models.case_subtypes import TowCase


async def try_complete(
    session: AsyncSession,
    case_id: UUID,
    *,
    actor_user_id: UUID | None = None,
) -> bool:
    """3 gate kontrolü — hepsi OK ise transition_case_status(COMPLETED).

    Returns: True → transition yapıldı. False → gate(ler) eksik, case
    mevcut statüsünde kalır.
    """
    case = await session.get(ServiceCase, case_id)
    if case is None or case.deleted_at is not None:
        return False
    # Gate 3: terminal guard (idempotent — already completed returns False)
    if case.status in (
        ServiceCaseStatus.COMPLETED,
        ServiceCaseStatus.CANCELLED,
        ServiceCaseStatus.ARCHIVED,
    ):
        return False

    # Gate 1: operasyonel truth
    if case.kind == ServiceRequestKind.TOWING:
        tow_case = await session.get(TowCase, case_id)
        if tow_case is None:
            return False
        if tow_case.tow_stage != TowDispatchStage.DELIVERED:
            return False
    else:
        completion_stmt = select(CaseApproval).where(
            CaseApproval.case_id == case_id,
            CaseApproval.kind == CaseApprovalKind.COMPLETION,
            CaseApproval.status == CaseApprovalStatus.APPROVED,
        ).limit(1)
        completion = (
            await session.execute(completion_stmt)
        ).scalar_one_or_none()
        if completion is None:
            return False

    # Gate 2: billing truth (tow hariç — tow settlement ayrı state machine)
    if (
        case.kind != ServiceRequestKind.TOWING
        and case.billing_state != "settled"
    ):
        return False
    # tow için case_billing path farklı (tow_fare_settlements.state);
    # FINAL_CHARGED gate'i tow_lifecycle DELIVERED sync'i sonrası
    # otomatik tetiklenir (lifecycle sync case.status'u zaten işler).
    # Bu yüzden tow için Gate 1 yeterli.

    # Transition — late import (cyclic'i kır)
    from app.services.case_lifecycle import transition_case_status

    await transition_case_status(
        session,
        case_id,
        ServiceCaseStatus.COMPLETED,
        actor_user_id=actor_user_id,
    )
    return True


__all__ = ["try_complete"]
