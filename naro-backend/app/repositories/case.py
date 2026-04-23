"""ServiceCase repository — CRUD + pool + assign + search.

Status makinesi `app/services/case_lifecycle.py` içinde; burada yalnızca
basit atama ve filtre helper'ları. Pool feed `pool_matching.KIND_PROVIDER_MAP`
ile birleştirilir.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from sqlalchemy import ColumnElement, and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case import (
    CaseOrigin,
    ServiceCase,
    ServiceCaseStatus,
    ServiceRequestKind,
    ServiceRequestUrgency,
)
from app.models.case_subtypes import (
    AccidentCase,
    BreakdownCase,
    MaintenanceCase,
    TowCase,
)
from app.models.technician import ProviderType
from app.services.pool_matching import kinds_for_provider

CaseSubtype = TowCase | AccidentCase | BreakdownCase | MaintenanceCase

POOL_VISIBLE_STATUSES: tuple[ServiceCaseStatus, ...] = (
    ServiceCaseStatus.MATCHING,
    ServiceCaseStatus.OFFERS_READY,
)


async def get_case(session: AsyncSession, case_id: UUID) -> ServiceCase | None:
    return await session.get(ServiceCase, case_id)


_SUBTYPE_MODEL: dict[ServiceRequestKind, type[CaseSubtype]] = {
    ServiceRequestKind.TOWING: TowCase,
    ServiceRequestKind.ACCIDENT: AccidentCase,
    ServiceRequestKind.BREAKDOWN: BreakdownCase,
    ServiceRequestKind.MAINTENANCE: MaintenanceCase,
}


async def get_subtype_row(
    session: AsyncSession, case: ServiceCase
) -> CaseSubtype | None:
    """Faz 1 canonical case architecture — kind'a göre subtype row fetch.

    Yeni vakalar insert edilirken subtype row yazılır; legacy vakalar için
    `scripts/backfill_case_subtypes.py` ile doldurulur.
    """
    model = _SUBTYPE_MODEL.get(case.kind)
    if model is None:
        return None
    return await session.get(model, case.id)


async def get_case_with_subtype(
    session: AsyncSession, case_id: UUID
) -> tuple[ServiceCase | None, CaseSubtype | None]:
    case = await session.get(ServiceCase, case_id)
    if case is None:
        return None, None
    subtype = await get_subtype_row(session, case)
    return case, subtype


async def create_case(
    session: AsyncSession,
    *,
    vehicle_id: UUID,
    customer_user_id: UUID,
    kind: ServiceRequestKind,
    title: str,
    request_draft: dict[str, object],
    workflow_blueprint: str,
    urgency: ServiceRequestUrgency = ServiceRequestUrgency.PLANNED,
    origin: CaseOrigin = CaseOrigin.CUSTOMER,
    subtitle: str | None = None,
    summary: str | None = None,
    location_label: str | None = None,
    preferred_technician_id: UUID | None = None,
    estimate_amount: Decimal | None = None,
) -> ServiceCase:
    case = ServiceCase(
        vehicle_id=vehicle_id,
        customer_user_id=customer_user_id,
        kind=kind,
        urgency=urgency,
        origin=origin,
        title=title,
        subtitle=subtitle,
        summary=summary,
        location_label=location_label,
        preferred_technician_id=preferred_technician_id,
        workflow_blueprint=workflow_blueprint,
        request_draft=request_draft,
        estimate_amount=estimate_amount,
    )
    session.add(case)
    await session.flush()
    return case


async def list_pool_cases(
    session: AsyncSession,
    provider_type: ProviderType,
    *,
    limit: int = 50,
    before_created_at: datetime | None = None,
    before_id: UUID | None = None,
) -> list[ServiceCase]:
    kinds = kinds_for_provider(provider_type)
    if not kinds:
        return []
    conds: list[ColumnElement[bool]] = [
        ServiceCase.status.in_(POOL_VISIBLE_STATUSES),
        ServiceCase.kind.in_(kinds),
        ServiceCase.deleted_at.is_(None),
        ServiceCase.assigned_technician_id.is_(None),
    ]
    if before_created_at is not None and before_id is not None:
        conds.append(
            (ServiceCase.created_at < before_created_at)
            | (
                (ServiceCase.created_at == before_created_at)
                & (ServiceCase.id > before_id)
            )
        )
    stmt = (
        select(ServiceCase)
        .where(and_(*conds))
        .order_by(ServiceCase.created_at.desc(), ServiceCase.id.asc())
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars().all())


async def list_cases_for_customer(
    session: AsyncSession, customer_user_id: UUID
) -> list[ServiceCase]:
    stmt = (
        select(ServiceCase)
        .where(
            and_(
                ServiceCase.customer_user_id == customer_user_id,
                ServiceCase.deleted_at.is_(None),
            )
        )
        .order_by(ServiceCase.created_at.desc())
    )
    return list((await session.execute(stmt)).scalars().all())


async def list_cases_for_technician(
    session: AsyncSession, technician_user_id: UUID
) -> list[ServiceCase]:
    stmt = (
        select(ServiceCase)
        .where(
            and_(
                or_(
                    ServiceCase.assigned_technician_id == technician_user_id,
                    ServiceCase.preferred_technician_id == technician_user_id,
                ),
                ServiceCase.deleted_at.is_(None),
            )
        )
        .order_by(ServiceCase.updated_at.desc())
    )
    return list((await session.execute(stmt)).scalars().all())


async def list_cases_for_vehicle(
    session: AsyncSession, vehicle_id: UUID
) -> list[ServiceCase]:
    stmt = (
        select(ServiceCase)
        .where(ServiceCase.vehicle_id == vehicle_id)
        .order_by(ServiceCase.created_at.desc())
    )
    return list((await session.execute(stmt)).scalars().all())


async def assign_technician(
    session: AsyncSession,
    case_id: UUID,
    technician_user_id: UUID,
) -> None:
    await session.execute(
        update(ServiceCase)
        .where(ServiceCase.id == case_id)
        .values(assigned_technician_id=technician_user_id)
    )


async def clear_assigned_technician(
    session: AsyncSession, case_id: UUID
) -> None:
    await session.execute(
        update(ServiceCase)
        .where(ServiceCase.id == case_id)
        .values(assigned_technician_id=None)
    )


async def mark_seen(
    session: AsyncSession,
    case_id: UUID,
    actor: Literal["customer", "technician"],
) -> None:
    column = (
        ServiceCase.last_seen_by_customer
        if actor == "customer"
        else ServiceCase.last_seen_by_technician
    )
    await session.execute(
        update(ServiceCase)
        .where(ServiceCase.id == case_id)
        .values({column: datetime.now(UTC)})
    )


async def soft_delete_case(
    session: AsyncSession, case_id: UUID
) -> None:
    await session.execute(
        update(ServiceCase)
        .where(ServiceCase.id == case_id)
        .values(deleted_at=datetime.now(UTC))
    )


async def update_financials(
    session: AsyncSession,
    case_id: UUID,
    *,
    total_amount: Decimal | None = None,
    estimate_amount: Decimal | None = None,
) -> None:
    values: dict[str, object] = {}
    if total_amount is not None:
        values["total_amount"] = total_amount
    if estimate_amount is not None:
        values["estimate_amount"] = estimate_amount
    if not values:
        return
    await session.execute(
        update(ServiceCase).where(ServiceCase.id == case_id).values(**values)
    )


async def count_cases_for_vehicle(
    session: AsyncSession, vehicle_id: UUID
) -> int:
    """Vehicle dossier için — Faz 3'teki vehicle repo burayı çağırır."""
    stmt = select(ServiceCase).where(ServiceCase.vehicle_id == vehicle_id)
    result = await session.execute(stmt)
    return len(list(result.scalars().all()))
