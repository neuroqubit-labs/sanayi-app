"""Tow repositories — dispatch_attempts, live_locations, settlements, otp, cancellations.

Tek dosya ergonomi için; ayrı concern'ler ayrı fonksiyon grupları hâlinde. Service
layer bu repositories'i DI ile kullanır; raw SQL PostGIS fonksiyonları kritik
noktalarda (scoring, distance aggregate) doğrudan burada yer alır.
"""

from __future__ import annotations

import hashlib
import re
import secrets
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import and_, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.case import TowDispatchStage
from app.models.case_subtypes import TowCase
from app.models.technician import TechnicianProfile
from app.models.tow import (
    TowCancellation,
    TowCancellationActor,
    TowDispatchAttempt,
    TowDispatchResponse,
    TowFareRefund,
    TowFareSettlement,
    TowOtpDelivery,
    TowOtpEvent,
    TowOtpPurpose,
    TowOtpRecipient,
    TowOtpVerifyResult,
    TowPaymentIdempotency,
    TowPaymentOperation,
    TowRefundReason,
    TowSettlementStatus,
)

# ─── Dispatch attempts ─────────────────────────────────────────────────────


async def create_attempt(
    session: AsyncSession,
    *,
    case_id: UUID,
    technician_id: UUID,
    attempt_order: int,
    distance_km: Decimal | None,
    eta_minutes: int | None,
    score: Decimal | None,
    radius_km: int,
) -> TowDispatchAttempt:
    attempt = TowDispatchAttempt(
        case_id=case_id,
        technician_id=technician_id,
        attempt_order=attempt_order,
        response=TowDispatchResponse.PENDING,
        distance_km=distance_km,
        eta_minutes=eta_minutes,
        score=score,
        radius_km=radius_km,
    )
    session.add(attempt)
    await session.flush()
    return attempt


async def record_response(
    session: AsyncSession,
    attempt_id: UUID,
    response: TowDispatchResponse,
    rejection_reason: str | None = None,
) -> TowDispatchAttempt | None:
    now = datetime.now(UTC)
    await session.execute(
        update(TowDispatchAttempt)
        .where(TowDispatchAttempt.id == attempt_id)
        .values(
            response=response,
            responded_at=now,
            rejection_reason=rejection_reason,
        )
    )
    return await session.get(TowDispatchAttempt, attempt_id)


async def latest_attempt(
    session: AsyncSession, case_id: UUID
) -> TowDispatchAttempt | None:
    stmt = (
        select(TowDispatchAttempt)
        .where(TowDispatchAttempt.case_id == case_id)
        .order_by(TowDispatchAttempt.attempt_order.desc())
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_attempt_technicians(
    session: AsyncSession, case_id: UUID
) -> list[UUID]:
    stmt = select(TowDispatchAttempt.technician_id).where(
        TowDispatchAttempt.case_id == case_id
    )
    return [row[0] for row in (await session.execute(stmt)).all()]


# ─── Candidate selection (SQL scoring, partial GIST) ───────────────────────


async def select_next_candidate(
    session: AsyncSession,
    *,
    pickup_lat: float,
    pickup_lng: float,
    radius_km: int,
    excluded_technician_ids: list[UUID],
    candidate_technician_ids: list[UUID] | None = None,
    required_equipment: list[str] | None = None,
    heartbeat_cutoff: datetime | None = None,
) -> dict[str, object] | None:
    """SQL-weighted scoring; partial GIST + ST_DWithin; ORDER BY composite score.

    Dönen: {technician_id, distance_km, eta_minutes, score}. None → pool empty.
    """
    settings = get_settings()
    default_cutoff_seconds = (
        settings.tow_heartbeat_seconds + settings.tow_heartbeat_grace_seconds
    )
    cutoff = heartbeat_cutoff or (
        datetime.now(UTC) - timedelta(seconds=default_cutoff_seconds)
    )
    if candidate_technician_ids is not None and len(candidate_technician_ids) == 0:
        return None
    equip_filter = (
        ""
        if not required_equipment
        else """
        AND NOT EXISTS (
            SELECT 1 FROM unnest(CAST(:required_equipment AS tow_equipment[])) AS req
            WHERE req NOT IN (
                SELECT tte.equipment
                FROM technician_tow_equipment tte
                WHERE tte.profile_id = tp.id
            )
        )
        """
    )
    excluded_clause = (
        "" if not excluded_technician_ids else "AND tp.user_id != ALL(:excluded)"
    )
    candidate_clause = (
        "" if candidate_technician_ids is None else "AND tp.user_id = ANY(:candidates)"
    )

    sql = f"""
        SELECT
            tp.user_id AS technician_id,
            ST_Distance(
                tp.last_known_location,
                ST_SetSRID(ST_MakePoint(:pickup_lng, :pickup_lat), 4326)::geography
            ) / 1000.0 AS distance_km,
            -- Weighted score: proximity(0.5) + rating(0.2) + fairness(0.15) + evidence(0.15)
            (
                0.5 * (1.0 - LEAST(
                    ST_Distance(
                        tp.last_known_location,
                        ST_SetSRID(ST_MakePoint(:pickup_lng, :pickup_lat), 4326)::geography
                    ) / (:radius_km * 1000.0),
                    1.0
                ))
                + 0.35 * COALESCE(tp.evidence_discipline_score::double precision, 1.0)
                + 0.15 * 1.0 -- fairness placeholder (matview Faz 10f)
            ) AS score
        FROM technician_profiles tp
        LEFT JOIN technician_capacity tc ON tc.profile_id = tp.id
        WHERE tp.provider_type = 'cekici'
          AND tp.availability = 'available'
          AND tp.deleted_at IS NULL
          AND tp.last_known_location IS NOT NULL
          AND tp.last_location_at IS NOT NULL
          AND tp.last_location_at > :cutoff
          AND tp.current_offer_case_id IS NULL
          {candidate_clause}
          -- B-P1-9 fix: capacity guard — current_queue_depth < max_concurrent_jobs
          -- Kapasite kaydı yoksa teknisyen default kapasitede sayılır (geçmiş
          -- mock/onboarding seed'ler için güvenli).
          AND (tc.profile_id IS NULL OR tc.current_queue_depth < tc.max_concurrent_jobs)
          AND ST_DWithin(
              tp.last_known_location,
              ST_SetSRID(ST_MakePoint(:pickup_lng, :pickup_lat), 4326)::geography,
              :radius_km * 1000
          )
          {excluded_clause}
          {equip_filter}
        ORDER BY score DESC, distance_km ASC
        LIMIT 1
    """
    params: dict[str, object] = {
        "pickup_lat": pickup_lat,
        "pickup_lng": pickup_lng,
        "radius_km": radius_km,
        "cutoff": cutoff,
    }
    if excluded_technician_ids:
        params["excluded"] = excluded_technician_ids
    if candidate_technician_ids is not None:
        params["candidates"] = candidate_technician_ids
    if required_equipment:
        params["required_equipment"] = required_equipment

    row = (await session.execute(text(sql), params)).mappings().first()
    if not row:
        return None
    distance_km = Decimal(str(row["distance_km"])).quantize(Decimal("0.001"))
    # Rough ETA: assume 35 km/h avg urban speed
    eta_minutes = max(1, int(float(distance_km) / 35.0 * 60))
    return {
        "technician_id": row["technician_id"],
        "distance_km": distance_km,
        "eta_minutes": eta_minutes,
        "score": Decimal(str(row["score"])).quantize(Decimal("0.0001")),
    }


async def lock_offer_to_technician(
    session: AsyncSession,
    technician_id: UUID,
    case_id: UUID,
) -> bool:
    """Optimistic lock: set current_offer_case_id only if NULL. Returns True if acquired."""
    now = datetime.now(UTC)
    result = await session.execute(
        update(TechnicianProfile)
        .where(
            and_(
                TechnicianProfile.user_id == technician_id,
                TechnicianProfile.current_offer_case_id.is_(None),
            )
        )
        .values(current_offer_case_id=case_id, current_offer_issued_at=now)
    )
    rowcount: int = int(getattr(result, "rowcount", 0) or 0)
    return rowcount > 0


async def release_technician_offer(
    session: AsyncSession, technician_id: UUID
) -> None:
    """Occupancy lock release — decline/timeout/terminal (cancel/complete)."""
    await session.execute(
        update(TechnicianProfile)
        .where(TechnicianProfile.user_id == technician_id)
        .values(current_offer_case_id=None, current_offer_issued_at=None)
    )


async def pin_technician_to_case(
    session: AsyncSession, technician_id: UUID, case_id: UUID
) -> None:
    """Occupancy lock pin — accept anında. P0-2 fix: terminal stage'e kadar
    tutulur; aday seçimi `current_offer_case_id IS NULL` filter'ı ile görmez.
    """
    await session.execute(
        update(TechnicianProfile)
        .where(TechnicianProfile.user_id == technician_id)
        .values(current_offer_case_id=case_id)
    )


# ─── Live locations ────────────────────────────────────────────────────────


async def insert_live_location(
    session: AsyncSession,
    *,
    case_id: UUID,
    technician_id: UUID,
    lat: float,
    lng: float,
    heading_deg: int | None,
    speed_kmh: int | None,
    accuracy_m: int | None,
    captured_at: datetime,
) -> None:
    """Partitioned INSERT — partition routing by captured_at."""
    await session.execute(
        text(
            """
            INSERT INTO tow_live_locations
                (case_id, technician_id, lat, lng, heading_deg, speed_kmh,
                 accuracy_m, captured_at)
            VALUES
                (:case_id, :technician_id, :lat, :lng, :heading_deg, :speed_kmh,
                 :accuracy_m, :captured_at)
            """
        ),
        {
            "case_id": case_id,
            "technician_id": technician_id,
            "lat": lat,
            "lng": lng,
            "heading_deg": heading_deg,
            "speed_kmh": speed_kmh,
            "accuracy_m": accuracy_m,
            "captured_at": captured_at,
        },
    )


async def update_technician_last_location(
    session: AsyncSession,
    *,
    technician_id: UUID,
    lat: float,
    lng: float,
    captured_at: datetime,
) -> None:
    await session.execute(
        text(
            """
            UPDATE technician_profiles
            SET last_known_location_lat = :lat,
                last_known_location_lng = :lng,
                last_location_at = :captured_at
            WHERE user_id = :tech_id
            """
        ),
        {"tech_id": technician_id, "lat": lat, "lng": lng,
         "captured_at": captured_at},
    )


async def distance_from_pickup_m(
    session: AsyncSession,
    *,
    case_id: UUID,
    tech_lat: float,
    tech_lng: float,
) -> float | None:
    """Tech current position distance to case pickup (m) via PostGIS.

    Faz 1 canonical case architecture — pickup geography TowCase subtype'ta.
    """
    row = (
        await session.execute(
            text(
                """
                SELECT ST_Distance(
                    pickup_location,
                    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                ) AS meters
                FROM tow_case
                WHERE case_id = :case_id AND pickup_location IS NOT NULL
                """
            ),
            {"case_id": case_id, "lat": tech_lat, "lng": tech_lng},
        )
    ).mappings().first()
    if row is None or row["meters"] is None:
        return None
    return float(row["meters"])


async def compute_actual_distance_km(
    session: AsyncSession, case_id: UUID
) -> Decimal:
    """Sum ST_Distance between consecutive points ordered by captured_at."""
    row = (
        await session.execute(
            text(
                """
                WITH ordered AS (
                    SELECT
                        location::geometry AS pt,
                        LAG(location::geometry) OVER (ORDER BY captured_at) AS prev_pt
                    FROM tow_live_locations
                    WHERE case_id = :case_id
                )
                SELECT COALESCE(SUM(ST_Distance(pt::geography, prev_pt::geography)), 0) / 1000.0 AS km
                FROM ordered
                WHERE prev_pt IS NOT NULL
                """
            ),
            {"case_id": case_id},
        )
    ).mappings().first()
    km = row["km"] if row else 0.0
    return Decimal(str(km)).quantize(Decimal("0.001"))


# ─── Settlements + refunds + idempotency ───────────────────────────────────


async def get_settlement_by_case(
    session: AsyncSession, case_id: UUID
) -> TowFareSettlement | None:
    stmt = select(TowFareSettlement).where(TowFareSettlement.case_id == case_id)
    return (await session.execute(stmt)).scalar_one_or_none()


async def create_settlement(
    session: AsyncSession,
    *,
    case_id: UUID,
    cap_amount: Decimal,
    quoted_amount: Decimal,
) -> TowFareSettlement:
    settlement = TowFareSettlement(
        case_id=case_id,
        state=TowSettlementStatus.NONE,
        cap_amount=cap_amount,
        quoted_amount=quoted_amount,
    )
    session.add(settlement)
    await session.flush()
    return settlement


async def update_settlement_state(
    session: AsyncSession,
    settlement_id: UUID,
    new_state: TowSettlementStatus,
    **fields: object,
) -> None:
    values: dict[str, object] = {"state": new_state, "updated_at": datetime.now(UTC)}
    values.update(fields)
    await session.execute(
        update(TowFareSettlement)
        .where(TowFareSettlement.id == settlement_id)
        .values(**values)
    )


async def insert_refund(
    session: AsyncSession,
    *,
    settlement_id: UUID,
    amount: Decimal,
    reason: TowRefundReason,
    idempotency_key: str,
    psp_ref: str | None = None,
    psp_response: dict[str, object] | None = None,
) -> TowFareRefund:
    refund = TowFareRefund(
        settlement_id=settlement_id,
        amount=amount,
        reason=reason,
        idempotency_key=idempotency_key,
        psp_ref=psp_ref,
        psp_response=psp_response,
    )
    session.add(refund)
    await session.flush()
    return refund


async def read_idempotency(
    session: AsyncSession, key: str
) -> TowPaymentIdempotency | None:
    return await session.get(TowPaymentIdempotency, key)


async def write_idempotency(
    session: AsyncSession,
    *,
    key: str,
    settlement_id: UUID | None,
    operation: TowPaymentOperation,
    request_hash: str,
    response_status: int,
    response_body: dict[str, object] | None,
    ttl_hours: int = 24,
) -> None:
    now = datetime.now(UTC)
    stmt = insert(TowPaymentIdempotency).values(
        key=key,
        settlement_id=settlement_id,
        operation=operation,
        request_hash=request_hash,
        response_status=response_status,
        response_body=response_body,
        created_at=now,
        expires_at=now + timedelta(hours=ttl_hours),
    )
    stmt = stmt.on_conflict_do_nothing(index_elements=["key"])
    await session.execute(stmt)


# ─── Cancellations ─────────────────────────────────────────────────────────


async def create_cancellation(
    session: AsyncSession,
    *,
    case_id: UUID,
    actor: TowCancellationActor,
    actor_user_id: UUID | None,
    reason_code: str,
    stage_at_cancel: TowDispatchStage,
    cancellation_fee: Decimal,
    refund_amount: Decimal,
    reason_note: str | None = None,
) -> TowCancellation:
    cancellation = TowCancellation(
        case_id=case_id,
        actor=actor,
        actor_user_id=actor_user_id,
        reason_code=reason_code,
        stage_at_cancel=stage_at_cancel,
        cancellation_fee=cancellation_fee,
        refund_amount=refund_amount,
        reason_note=reason_note,
    )
    session.add(cancellation)
    await session.flush()
    return cancellation


# ─── OTP events ────────────────────────────────────────────────────────────


_OTP_NUMERIC_RE = re.compile(r"^\d+$")


def generate_otp_code(length: int = 6) -> str:
    """Cryptographic secure numeric OTP."""
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


def hash_otp_code(code: str, case_id: UUID) -> str:
    """Hash salted with case_id for storage (never store plaintext)."""
    return hashlib.sha256(f"{code}:{case_id}".encode()).hexdigest()


async def issue_otp(
    session: AsyncSession,
    *,
    case_id: UUID,
    purpose: TowOtpPurpose,
    recipient: TowOtpRecipient,
    delivered_via: TowOtpDelivery,
    code: str,
    ttl_minutes: int = 10,
    issued_by_user_id: UUID | None = None,
) -> TowOtpEvent:
    now = datetime.now(UTC)
    event = TowOtpEvent(
        case_id=case_id,
        purpose=purpose,
        recipient=recipient,
        delivered_via=delivered_via,
        code_hash=hash_otp_code(code, case_id),
        issued_at=now,
        expires_at=now + timedelta(minutes=ttl_minutes),
        issued_by_user_id=issued_by_user_id,
    )
    session.add(event)
    await session.flush()
    return event


async def get_active_otp(
    session: AsyncSession, case_id: UUID, purpose: TowOtpPurpose
) -> TowOtpEvent | None:
    stmt = select(TowOtpEvent).where(
        and_(
            TowOtpEvent.case_id == case_id,
            TowOtpEvent.purpose == purpose,
            TowOtpEvent.verify_result == TowOtpVerifyResult.PENDING,
        )
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def mark_otp_result(
    session: AsyncSession,
    otp_id: UUID,
    result: TowOtpVerifyResult,
    *,
    increment_attempts: bool = True,
) -> None:
    now = datetime.now(UTC) if result == TowOtpVerifyResult.SUCCESS else None
    stmt = (
        update(TowOtpEvent)
        .where(TowOtpEvent.id == otp_id)
        .values(
            verify_result=result,
            verified_at=now,
        )
    )
    await session.execute(stmt)
    if increment_attempts:
        await session.execute(
            update(TowOtpEvent)
            .where(TowOtpEvent.id == otp_id)
            .values(attempts=TowOtpEvent.attempts + 1)
        )


# ─── Evidence gate ─────────────────────────────────────────────────────────


async def evidence_gate_counts(
    session: AsyncSession, case_id: UUID
) -> dict[str, int]:
    """Count evidence items per kind for gate check (case_evidence_items table)."""
    row = (
        await session.execute(
            text(
                """
                SELECT
                    COUNT(*) FILTER (
                        WHERE source_label = 'tow:tech_arrival'
                    ) AS tech_arrival,
                    COUNT(*) FILTER (
                        WHERE source_label = 'tow:tech_loading'
                    ) AS tech_loading,
                    COUNT(*) FILTER (
                        WHERE source_label = 'tow:tech_delivery'
                    ) AS tech_delivery,
                    COUNT(*) FILTER (
                        WHERE source_label IN ('tow:tech_arrival', 'tow:tech_loading')
                    ) AS photo_before,
                    COUNT(*) FILTER (
                        WHERE source_label = 'tow:tech_delivery'
                    ) AS photo_after,
                    COUNT(*) AS total
                FROM case_evidence_items
                WHERE case_id = :case_id
                """
            ),
            {"case_id": case_id},
        )
    ).mappings().first()
    if not row:
        return {
            "tech_arrival": 0,
            "tech_loading": 0,
            "tech_delivery": 0,
            "photo_before": 0,
            "photo_after": 0,
            "total": 0,
        }
    return dict(row)


# ─── Case-level tow helpers ────────────────────────────────────────────────


async def update_tow_stage_with_lock(
    session: AsyncSession,
    case_id: UUID,
    from_stage: TowDispatchStage,
    to_stage: TowDispatchStage,
) -> bool:
    """Atomic optimistic-locked transition. Returns True if stage moved.

    Faz 1 canonical case architecture — TowCase subtype authoritative.
    """
    result = await session.execute(
        update(TowCase)
        .where(
            and_(
                TowCase.case_id == case_id,
                TowCase.tow_stage == from_stage,
            )
        )
        .values(tow_stage=to_stage)
    )
    rowcount: int = int(getattr(result, "rowcount", 0) or 0)
    return rowcount > 0
