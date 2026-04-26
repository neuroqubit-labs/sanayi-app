"""Tow dispatch service — event-driven Uber-tarzı auto-dispatch.

Blocking loop yok. Senkron ilk aday SQL scoring + optimistic lock; timeout/decline
sonrası ARQ job `dispatch_attempt_timeout` tetiği (10f).

Radius fallback: 10 → 25 → 50 km. 3 deneme tükenince kullanıcı retry'a
alınır; V1 dispatch akışı havuz/teklif moduna dönmez.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case import (
    ServiceCase,
    ServiceRequestKind,
    TowDispatchStage,
    TowEquipment,
    TowMode,
)
from app.models.case_audit import CaseEventType, CaseTone
from app.models.case_subtypes import TowCase
from app.models.tow import TowDispatchResponse
from app.repositories import tow as tow_repo
from app.services import tow_presence
from app.services.case_events import append_event

DISPATCH_RADIUS_LADDER_KM: tuple[int, ...] = (10, 25, 50)
MAX_ATTEMPTS_BEFORE_NO_CANDIDATE = 3


class ConcurrentOfferError(Exception):
    """Another case already holds this technician's offer slot."""


class NoCandidateFoundError(Exception):
    """Radius ladder exhausted; no immediate candidate is available."""


@dataclass(slots=True)
class DispatchDecision:
    attempt_id: UUID
    technician_id: UUID
    attempt_order: int
    distance_km: Decimal
    eta_minutes: int
    radius_km: int


async def initiate_dispatch(
    session: AsyncSession,
    case: ServiceCase,
    tow_case: TowCase,
    *,
    redis: Redis | None = None,
) -> DispatchDecision:
    """Initial candidate selection + attempt INSERT + optimistic lock.

    Faz 1 canonical case architecture — tow state TowCase subtype'tan okunur.
    """
    if tow_case.tow_mode != TowMode.IMMEDIATE:
        raise ValueError("initiate_dispatch only valid for immediate mode")
    if tow_case.pickup_lat is None or tow_case.pickup_lng is None:
        raise ValueError("tow_case has no pickup location")

    return await _attempt_next_candidate(
        session,
        case=case,
        tow_case=tow_case,
        attempt_order=1,
        excluded=[],
        redis=redis,
    )


async def record_dispatch_response(
    session: AsyncSession,
    *,
    case: ServiceCase,
    tow_case: TowCase,
    attempt_id: UUID,
    response: TowDispatchResponse,
    actor_user_id: UUID,
    rejection_reason: str | None = None,
    redis: Redis | None = None,
) -> DispatchDecision | None:
    """Accept → stage='accepted'. Decline/timeout → next candidate or retry state.

    None döner → radius ladder tükendi veya teklif kabul edildi.
    """
    attempt = await tow_repo.record_response(
        session, attempt_id, response, rejection_reason
    )
    if attempt is None:
        raise LookupError("dispatch attempt not found")

    if response == TowDispatchResponse.ACCEPTED:
        # P0-2 fix: accept'te lock bırakma — `current_offer_case_id = case.id`
        # pin'le. Terminal stage'e kadar (cancel / complete) tutulur.
        await tow_repo.pin_technician_to_case(
            session, attempt.technician_id, case.id
        )
        await _transition_to_accepted(
            session, case, tow_case, attempt.technician_id, actor_user_id
        )
        return None

    # Decline or timeout → release lock + try next
    await tow_repo.release_technician_offer(session, attempt.technician_id)
    excluded = await tow_repo.list_attempt_technicians(session, case.id)
    next_order = attempt.attempt_order + 1
    if next_order > MAX_ATTEMPTS_BEFORE_NO_CANDIDATE:
        await transition_to_no_candidate_found(session, case, tow_case, actor_user_id)
        return None
    try:
        return await _attempt_next_candidate(
            session,
            case=case,
            tow_case=tow_case,
            attempt_order=next_order,
            excluded=excluded,
            redis=redis,
        )
    except NoCandidateFoundError:
        await transition_to_no_candidate_found(session, case, tow_case, actor_user_id)
        return None


async def _attempt_next_candidate(
    session: AsyncSession,
    *,
    case: ServiceCase,
    tow_case: TowCase,
    attempt_order: int,
    excluded: list[UUID],
    redis: Redis | None,
) -> DispatchDecision:
    required_equipment = (
        [
            e.value if isinstance(e, TowEquipment) else e
            for e in tow_case.tow_required_equipment
        ]
        if tow_case.tow_required_equipment
        else None
    )
    assert tow_case.pickup_lat is not None and tow_case.pickup_lng is not None
    candidate: dict[str, object] | None = None
    used_radius = DISPATCH_RADIUS_LADDER_KM[-1]
    for radius in DISPATCH_RADIUS_LADDER_KM:
        redis_candidates: list[UUID] | None = None
        if redis is not None:
            redis_candidates = await tow_presence.nearby_candidate_ids(
                redis,
                pickup_lat=tow_case.pickup_lat,
                pickup_lng=tow_case.pickup_lng,
                radius_km=radius,
            )
            if redis_candidates:
                candidate = await tow_repo.select_next_candidate(
                    session,
                    pickup_lat=tow_case.pickup_lat,
                    pickup_lng=tow_case.pickup_lng,
                    radius_km=radius,
                    excluded_technician_ids=excluded,
                    candidate_technician_ids=redis_candidates,
                    required_equipment=required_equipment,
                )
                if candidate:
                    used_radius = radius
                    break

        candidate = await tow_repo.select_next_candidate(
            session,
            pickup_lat=tow_case.pickup_lat,
            pickup_lng=tow_case.pickup_lng,
            radius_km=radius,
            excluded_technician_ids=excluded,
            required_equipment=required_equipment,
        )
        if candidate:
            used_radius = radius
            break
    if candidate is None:
        raise NoCandidateFoundError(
            f"no candidate within {DISPATCH_RADIUS_LADDER_KM[-1]}km"
        )

    tech_id = candidate["technician_id"]
    assert isinstance(tech_id, UUID)

    acquired = await tow_repo.lock_offer_to_technician(session, tech_id, case.id)
    if not acquired:
        # Another case grabbed the slot; skip and retry with exclusion
        excluded = [*excluded, tech_id]
        return await _attempt_next_candidate(
            session,
            case=case,
            tow_case=tow_case,
            attempt_order=attempt_order,
            excluded=excluded,
            redis=redis,
        )

    distance = candidate["distance_km"]
    eta = candidate["eta_minutes"]
    score = candidate["score"]
    assert isinstance(distance, Decimal)
    assert isinstance(eta, int)
    assert isinstance(score, Decimal)

    attempt = await tow_repo.create_attempt(
        session,
        case_id=case.id,
        technician_id=tech_id,
        attempt_order=attempt_order,
        distance_km=distance,
        eta_minutes=eta,
        score=score,
        radius_km=used_radius,
    )
    await append_event(
        session,
        case_id=case.id,
        event_type=CaseEventType.TOW_DISPATCH_CANDIDATE_SELECTED,
        title=f"Çekici adayı atandı (deneme #{attempt_order})",
        context={
            "attempt_id": str(attempt.id),
            "technician_id": str(tech_id),
            "distance_km": str(distance),
            "eta_minutes": eta,
            "radius_km": used_radius,
            "score": str(score),
        },
    )
    return DispatchDecision(
        attempt_id=attempt.id,
        technician_id=tech_id,
        attempt_order=attempt_order,
        distance_km=distance,
        eta_minutes=eta,
        radius_km=used_radius,
    )


async def _transition_to_accepted(
    session: AsyncSession,
    case: ServiceCase,
    tow_case: TowCase,
    technician_id: UUID,
    actor_user_id: UUID,
) -> None:
    moved = await tow_repo.update_tow_stage_with_lock(
        session,
        case_id=case.id,
        from_stage=TowDispatchStage.SEARCHING,
        to_stage=TowDispatchStage.ACCEPTED,
    )
    if not moved:
        return
    tow_case.tow_stage = TowDispatchStage.ACCEPTED
    case.assigned_technician_id = technician_id
    # B-P1-5 fix: shell yazma yetkisi tow_lifecycle'da.
    from app.services.tow_lifecycle import sync_case_status

    sync_case_status(case, TowDispatchStage.ACCEPTED)
    await append_event(
        session,
        case_id=case.id,
        event_type=CaseEventType.TOW_STAGE_COMMITTED,
        title="Çekici atandı",
        actor_user_id=actor_user_id,
        context={
            "from_stage": TowDispatchStage.SEARCHING.value,
            "to_stage": TowDispatchStage.ACCEPTED.value,
            "technician_id": str(technician_id),
        },
    )


async def transition_to_no_candidate_found(
    session: AsyncSession,
    case: ServiceCase,
    tow_case: TowCase,
    actor_user_id: UUID,
) -> None:
    moved = await tow_repo.update_tow_stage_with_lock(
        session,
        case_id=case.id,
        from_stage=TowDispatchStage.SEARCHING,
        to_stage=TowDispatchStage.NO_CANDIDATE_FOUND,
    )
    if not moved:
        if tow_case.tow_stage == TowDispatchStage.NO_CANDIDATE_FOUND:
            return
        return
    tow_case.tow_stage = TowDispatchStage.NO_CANDIDATE_FOUND
    from app.services import tow_lifecycle

    tow_lifecycle.sync_case_status(case, TowDispatchStage.NO_CANDIDATE_FOUND)
    await append_event(
        session,
        case_id=case.id,
        event_type=CaseEventType.TOW_STAGE_COMMITTED,
        title="Aday çekici bulunamadı",
        tone=CaseTone.WARNING,
        actor_user_id=actor_user_id,
        context={
            "from_stage": TowDispatchStage.SEARCHING.value,
            "to_stage": TowDispatchStage.NO_CANDIDATE_FOUND.value,
        },
    )


def compute_cap_amount(
    *,
    distance_km: Decimal,
    base_amount: Decimal,
    per_km: Decimal,
    urgency_surcharge: Decimal,
    buffer_pct: Decimal,
) -> Decimal:
    """Hemen mod cap-price: (base + dist*per_km + urgency) * (1 + buffer)."""
    raw = base_amount + distance_km * per_km + urgency_surcharge
    capped = raw * (Decimal("1") + buffer_pct)
    return capped.quantize(Decimal("1"))  # integer TRY


def compute_cancellation_fee(
    mode: TowMode, stage: TowDispatchStage, *, locked_price: Decimal | None = None
) -> Decimal:
    """Spec §2 K-4: 0 → 75 → 300 → full. Scheduled farklı bucket."""
    if mode == TowMode.IMMEDIATE:
        if stage in (
            TowDispatchStage.PAYMENT_REQUIRED,
            TowDispatchStage.SEARCHING,
            TowDispatchStage.NO_CANDIDATE_FOUND,
        ):
            return Decimal("0")
        if stage in (
            TowDispatchStage.ACCEPTED,
            TowDispatchStage.EN_ROUTE,
            TowDispatchStage.NEARBY,
        ):
            return Decimal("75")
        if stage == TowDispatchStage.ARRIVED:
            return Decimal("300")
        if stage in (TowDispatchStage.LOADING, TowDispatchStage.IN_TRANSIT):
            return locked_price or Decimal("-1")  # -1 → "full fare"
        return Decimal("0")
    # scheduled
    if stage in (
        TowDispatchStage.BIDDING_OPEN,
        TowDispatchStage.SCHEDULED_WAITING,
        TowDispatchStage.NO_CANDIDATE_FOUND,
    ):
        return Decimal("0")
    if stage in (TowDispatchStage.ACCEPTED, TowDispatchStage.EN_ROUTE):
        return Decimal("150")
    if stage == TowDispatchStage.ARRIVED:
        return locked_price or Decimal("-1")
    return Decimal("0")


def _ensure_is_towing(case: ServiceCase) -> None:
    if case.kind != ServiceRequestKind.TOWING:
        raise ValueError("case is not a towing case")
