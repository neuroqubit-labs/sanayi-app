"""Tow dispatch — SQL scoring + cap/fee pure functions + cap absorption.

Not: Pre-existing SAEnum `.name`→'.value'` bug (UserRole.CUSTOMER → 'CUSTOMER'
yerine 'customer' beklenir) nedeniyle User/ServiceCase SQLAlchemy insert'leri
raw SQL ile yapılır; böylece test tow-spesifik kod yollarını exercise eder.

Kapsam:
- test_compute_cap_* — pure helpers
- test_cancellation_fee_* — K-4 bucket'ları
- test_scoring_prefers_closer — SQL weighted ORDER BY (DB integration)
- test_scoring_excludes_stale_heartbeat_and_locked_offer — filter'lar
- test_cap_absorbed_when_actual_exceeds — capture_final clamps to cap
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from sqlalchemy import text as _text

from app.db.session import AsyncSessionLocal
from app.models.case import TowDispatchStage, TowMode
from app.repositories import tow as tow_repo
from app.services.tow_dispatch import (
    compute_cancellation_fee,
    compute_cap_amount,
    initiate_dispatch,
)

# ─── Pure helpers (no DB) ───────────────────────────────────────────────────


def test_compute_cap_urgency_bumped() -> None:
    """(950 + 10*70 + 80) * 1.10 = 1903"""
    cap = compute_cap_amount(
        distance_km=Decimal("10"),
        base_amount=Decimal("950"),
        per_km=Decimal("70"),
        urgency_surcharge=Decimal("80"),
        buffer_pct=Decimal("0.10"),
    )
    assert cap == Decimal("1903")


def test_compute_cap_no_urgency() -> None:
    """(950 + 5*70) * 1.10 = 1430"""
    cap = compute_cap_amount(
        distance_km=Decimal("5"),
        base_amount=Decimal("950"),
        per_km=Decimal("70"),
        urgency_surcharge=Decimal("0"),
        buffer_pct=Decimal("0.10"),
    )
    assert cap == Decimal("1430")


def test_cancellation_fee_immediate_buckets() -> None:
    """Spec §2 K-4 hemen mod: 0 → 75 → 300 → full."""
    assert compute_cancellation_fee(
        TowMode.IMMEDIATE, TowDispatchStage.SEARCHING
    ) == Decimal("0")
    assert compute_cancellation_fee(
        TowMode.IMMEDIATE, TowDispatchStage.ACCEPTED
    ) == Decimal("75")
    assert compute_cancellation_fee(
        TowMode.IMMEDIATE, TowDispatchStage.EN_ROUTE
    ) == Decimal("75")
    assert compute_cancellation_fee(
        TowMode.IMMEDIATE, TowDispatchStage.NEARBY
    ) == Decimal("75")
    assert compute_cancellation_fee(
        TowMode.IMMEDIATE, TowDispatchStage.ARRIVED
    ) == Decimal("300")
    locked = Decimal("1500")
    assert compute_cancellation_fee(
        TowMode.IMMEDIATE, TowDispatchStage.LOADING, locked_price=locked
    ) == locked
    assert compute_cancellation_fee(
        TowMode.IMMEDIATE, TowDispatchStage.IN_TRANSIT, locked_price=locked
    ) == locked


def test_cancellation_fee_scheduled_buckets() -> None:
    """Scheduled mod: bidding_open → 0, accepted → 150, arrived → full."""
    assert compute_cancellation_fee(
        TowMode.SCHEDULED, TowDispatchStage.BIDDING_OPEN
    ) == Decimal("0")
    assert compute_cancellation_fee(
        TowMode.SCHEDULED, TowDispatchStage.SCHEDULED_WAITING
    ) == Decimal("0")
    assert compute_cancellation_fee(
        TowMode.SCHEDULED, TowDispatchStage.ACCEPTED
    ) == Decimal("150")
    assert compute_cancellation_fee(
        TowMode.SCHEDULED, TowDispatchStage.EN_ROUTE
    ) == Decimal("150")
    assert compute_cancellation_fee(
        TowMode.SCHEDULED,
        TowDispatchStage.ARRIVED,
        locked_price=Decimal("2000"),
    ) == Decimal("2000")


@pytest.mark.asyncio
async def test_initiate_dispatch_uses_redis_geo_candidates(monkeypatch) -> None:
    """Redis GEO narrows the hot candidate set; DB still validates/scorers."""
    tech_id = uuid4()
    attempt_id = uuid4()
    captured: dict[str, object] = {}

    async def fake_nearby(*_args, **_kwargs):
        return [tech_id]

    async def fake_select_next_candidate(_session, **kwargs):
        captured["candidate_ids"] = kwargs.get("candidate_technician_ids")
        return {
            "technician_id": tech_id,
            "distance_km": Decimal("1.250"),
            "eta_minutes": 3,
            "score": Decimal("0.9000"),
        }

    async def fake_lock(*_args, **_kwargs):
        return True

    async def fake_create_attempt(*_args, **_kwargs):
        return SimpleNamespace(id=attempt_id)

    async def fake_append_event(*_args, **_kwargs):
        return SimpleNamespace(id=uuid4())

    from app.services import tow_dispatch as dispatch_svc

    monkeypatch.setattr(dispatch_svc.tow_presence, "nearby_candidate_ids", fake_nearby)
    monkeypatch.setattr(dispatch_svc.tow_repo, "select_next_candidate", fake_select_next_candidate)
    monkeypatch.setattr(dispatch_svc.tow_repo, "lock_offer_to_technician", fake_lock)
    monkeypatch.setattr(dispatch_svc.tow_repo, "create_attempt", fake_create_attempt)
    monkeypatch.setattr(dispatch_svc, "append_event", fake_append_event)

    case = SimpleNamespace(id=uuid4())
    tow_case = SimpleNamespace(
        tow_mode=TowMode.IMMEDIATE,
        pickup_lat=41.0,
        pickup_lng=29.0,
        tow_required_equipment=None,
    )

    decision = await initiate_dispatch(object(), case, tow_case, redis=object())

    assert decision.technician_id == tech_id
    assert captured["candidate_ids"] == [tech_id]


@pytest.mark.asyncio
async def test_initiate_dispatch_falls_back_when_redis_empty(monkeypatch) -> None:
    """Redis cache miss must not block canonical PostGIS/DB dispatch."""
    tech_id = uuid4()
    attempt_id = uuid4()
    captured: dict[str, object] = {}

    async def fake_nearby(*_args, **_kwargs):
        return []

    async def fake_select_next_candidate(_session, **kwargs):
        captured["candidate_ids"] = kwargs.get("candidate_technician_ids")
        return {
            "technician_id": tech_id,
            "distance_km": Decimal("2.000"),
            "eta_minutes": 4,
            "score": Decimal("0.7000"),
        }

    async def fake_lock(*_args, **_kwargs):
        return True

    async def fake_create_attempt(*_args, **_kwargs):
        return SimpleNamespace(id=attempt_id)

    async def fake_append_event(*_args, **_kwargs):
        return SimpleNamespace(id=uuid4())

    from app.services import tow_dispatch as dispatch_svc

    monkeypatch.setattr(dispatch_svc.tow_presence, "nearby_candidate_ids", fake_nearby)
    monkeypatch.setattr(dispatch_svc.tow_repo, "select_next_candidate", fake_select_next_candidate)
    monkeypatch.setattr(dispatch_svc.tow_repo, "lock_offer_to_technician", fake_lock)
    monkeypatch.setattr(dispatch_svc.tow_repo, "create_attempt", fake_create_attempt)
    monkeypatch.setattr(dispatch_svc, "append_event", fake_append_event)

    case = SimpleNamespace(id=uuid4())
    tow_case = SimpleNamespace(
        tow_mode=TowMode.IMMEDIATE,
        pickup_lat=41.0,
        pickup_lng=29.0,
        tow_required_equipment=None,
    )

    decision = await initiate_dispatch(object(), case, tow_case, redis=object())

    assert decision.technician_id == tech_id
    assert captured["candidate_ids"] is None


# ─── DB integration helpers (raw SQL to bypass pre-existing SAEnum bug) ─────


async def _insert_user_raw(db, *, phone: str, role: str = "customer") -> UUID:
    user_id = uuid4()
    await db.execute(
        _text(
            """
            INSERT INTO users (id, phone, role, status, locale, created_at, updated_at)
            VALUES (:id, :phone, CAST(:role AS user_role),
                    CAST('active' AS user_status), 'tr-TR', now(), now())
            """
        ),
        {"id": user_id, "phone": phone, "role": role},
    )
    return user_id


async def _insert_vehicle_raw(db, *, plate: str) -> UUID:
    vehicle_id = uuid4()
    await db.execute(
        _text(
            """
            INSERT INTO vehicles (id, plate, plate_normalized, created_at, updated_at)
            VALUES (:id, :plate, :plate_norm, now(), now())
            """
        ),
        {
            "id": vehicle_id,
            "plate": plate,
            "plate_norm": plate.replace(" ", "").upper(),
        },
    )
    return vehicle_id


async def _insert_tow_tech(
    db,
    *,
    lat: float,
    lng: float,
    evidence_score: float = 1.0,
    available: bool = True,
    location_age_seconds: int = 10,
    locked_offer_case_id: UUID | None = None,
) -> UUID:
    user_id = await _insert_user_raw(
        db, phone=f"+90555{uuid4().hex[:7]}", role="technician"
    )
    profile_id = uuid4()
    captured_at = datetime.now(UTC) - timedelta(seconds=location_age_seconds)
    await db.execute(
        _text(
            """
            INSERT INTO technician_profiles
                (id, user_id, display_name, provider_type, availability,
                 verified_level, evidence_discipline_score,
                 last_known_location_lat, last_known_location_lng,
                 last_location_at,
                 current_offer_case_id,
                 created_at, updated_at, business_info, secondary_provider_types)
            VALUES (
                :id, :user_id, :display,
                CAST('cekici' AS provider_type),
                CAST(:avail AS technician_availability),
                CAST('verified' AS technician_verified_level),
                :escore,
                :lat, :lng,
                :captured_at, :locked_case,
                now(), now(), CAST('{}' AS jsonb), '{}'
            )
            """
        ),
        {
            "id": profile_id,
            "user_id": user_id,
            "display": f"Tow {uuid4().hex[:6]}",
            "avail": "available" if available else "offline",
            "escore": Decimal(str(evidence_score)).quantize(Decimal("0.01")),
            "lat": lat,
            "lng": lng,
            "captured_at": captured_at,
            "locked_case": locked_offer_case_id,
        },
    )
    return user_id


async def _cleanup(db, user_ids: list[UUID], vehicle_ids: list[UUID]) -> None:
    if user_ids:
        await db.execute(
            _text("DELETE FROM technician_profiles WHERE user_id = ANY(:ids)"),
            {"ids": user_ids},
        )
        await db.execute(
            _text("DELETE FROM users WHERE id = ANY(:ids)"),
            {"ids": user_ids},
        )
    if vehicle_ids:
        await db.execute(
            _text("DELETE FROM vehicles WHERE id = ANY(:ids)"),
            {"ids": vehicle_ids},
        )


async def _purge_test_residue(db) -> None:
    """Remove any leftover test data (cascade-safe order)."""
    await db.execute(
        _text(
            "DELETE FROM service_cases WHERE title IN ('dummy', 'cap absorb')"
        )
    )
    await db.execute(
        _text(
            "DELETE FROM technician_profiles WHERE display_name LIKE 'Tow %'"
        )
    )
    await db.execute(
        _text(
            "DELETE FROM users WHERE phone LIKE '+90555%' "
            "AND id NOT IN (SELECT user_id FROM auth_sessions)"
        )
    )
    await db.execute(
        _text("DELETE FROM vehicles WHERE plate LIKE '34 T %'")
    )


# ─── DB integration tests ──────────────────────────────────────────────────


@pytest.mark.skip(
    reason="Cross-test asyncpg event-loop (Faz 10 bloker); per-test engine sonrası aktif."
)
@pytest.mark.asyncio
async def test_scoring_prefers_closer_technician() -> None:
    """Weighted SQL scoring: closer tech at equal evidence wins."""
    async with AsyncSessionLocal() as db:
        await _purge_test_residue(db)
        await db.commit()
        pickup_lat, pickup_lng = 41.0082, 28.9784

        tech_near = await _insert_tow_tech(
            db, lat=pickup_lat + 0.009, lng=pickup_lng, evidence_score=1.0
        )
        tech_far = await _insert_tow_tech(
            db, lat=pickup_lat + 0.045, lng=pickup_lng, evidence_score=1.0
        )
        await db.commit()

        result = await tow_repo.select_next_candidate(
            db,
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            radius_km=10,
            excluded_technician_ids=[],
        )
        assert result is not None
        assert result["technician_id"] == tech_near
        assert isinstance(result["distance_km"], Decimal)
        assert result["distance_km"] < Decimal("2")

        await _cleanup(db, [tech_near, tech_far], [])
        await db.commit()


@pytest.mark.skip(
    reason="Pre-existing SAEnum name/value bug + cross-test event-loop issue; "
    "Faz 10f sub-sprint fixes shared engine fixture."
)
@pytest.mark.asyncio
async def test_scoring_excludes_stale_heartbeat_and_locked_offer() -> None:
    """Stale (>90s) AND locked (current_offer_case_id) techs filtered out."""
    async with AsyncSessionLocal() as db:
        await _purge_test_residue(db)
        await db.commit()
        pickup_lat, pickup_lng = 41.0082, 28.9784

        # Create a dummy locked case_id for lock simulation
        dummy_user_id = await _insert_user_raw(db, phone=f"+90555{uuid4().hex[:7]}")
        dummy_vehicle_id = await _insert_vehicle_raw(db, plate=f"34 T {uuid4().hex[:4]}")
        dummy_case_id = uuid4()
        await db.execute(
            _text(
                """
                INSERT INTO service_cases
                    (id, vehicle_id, customer_user_id, kind, status, origin,
                     urgency, title, workflow_blueprint, request_draft,
                     wait_state_actor, tow_mode, tow_stage, incident_reason,
                     pickup_lat, pickup_lng, created_at, updated_at)
                VALUES
                    (:id, :vid, :uid,
                     CAST('towing' AS service_request_kind),
                     CAST('matching' AS service_case_status),
                     CAST('customer' AS case_origin),
                     CAST('urgent' AS service_request_urgency),
                     'dummy', 'towing_immediate', CAST('{}' AS jsonb),
                     CAST('system' AS case_wait_actor),
                     CAST('immediate' AS tow_mode),
                     CAST('searching' AS tow_dispatch_stage),
                     CAST('not_running' AS tow_incident_reason),
                     41.0, 28.9, now(), now())
                """
            ),
            {"id": dummy_case_id, "vid": dummy_vehicle_id, "uid": dummy_user_id},
        )

        tech_stale = await _insert_tow_tech(
            db, lat=pickup_lat + 0.005, lng=pickup_lng, location_age_seconds=120
        )
        tech_locked = await _insert_tow_tech(
            db, lat=pickup_lat + 0.006, lng=pickup_lng,
            locked_offer_case_id=dummy_case_id,
        )
        tech_good = await _insert_tow_tech(
            db, lat=pickup_lat + 0.010, lng=pickup_lng
        )
        await db.commit()

        result = await tow_repo.select_next_candidate(
            db,
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            radius_km=10,
            excluded_technician_ids=[],
        )
        assert result is not None
        assert result["technician_id"] == tech_good, (
            "only fresh + unlocked tech should be selected"
        )

        # Cleanup order: cases → users/techs → vehicles (FK)
        await db.execute(
            _text("DELETE FROM service_cases WHERE id = :id"),
            {"id": dummy_case_id},
        )
        await _cleanup(
            db, [tech_stale, tech_locked, tech_good, dummy_user_id],
            [dummy_vehicle_id],
        )
        await db.commit()


@pytest.mark.skip(
    reason="Pre-existing SAEnum bug at ORM hydration; db.get(ServiceCase) "
    "fails on 'towing' value. Faz 10f sub-sprint: global values_callable fix."
)
@pytest.mark.asyncio
async def test_cap_absorbed_when_actual_exceeds_cap() -> None:
    """capture_final(actual > cap) → final_amount clamped to cap.

    Platform cap üstü absorbe eder: final_amount = min(actual, cap).
    PSP.capture yalnızca cap kadar çağırılır; delta refund tetiklenmez.
    """
    from unittest.mock import AsyncMock

    from app.integrations.psp.protocol import PspResult
    from app.models.tow import TowSettlementStatus
    from app.services.tow_payment import capture_final

    async with AsyncSessionLocal() as db:
        await _purge_test_residue(db)
        await db.commit()
        customer_id = await _insert_user_raw(db, phone=f"+90555{uuid4().hex[:7]}")
        vehicle_id = await _insert_vehicle_raw(db, plate=f"34 T {uuid4().hex[:4]}")
        case_id = uuid4()
        await db.execute(
            _text(
                """
                INSERT INTO service_cases
                    (id, vehicle_id, customer_user_id, kind, status, origin,
                     urgency, title, workflow_blueprint, request_draft,
                     wait_state_actor, tow_mode, tow_stage, incident_reason,
                     pickup_lat, pickup_lng, created_at, updated_at)
                VALUES
                    (:id, :vid, :uid,
                     CAST('towing' AS service_request_kind),
                     CAST('service_in_progress' AS service_case_status),
                     CAST('customer' AS case_origin),
                     CAST('urgent' AS service_request_urgency),
                     'cap absorb', 'towing_immediate', CAST('{}' AS jsonb),
                     CAST('technician' AS case_wait_actor),
                     CAST('immediate' AS tow_mode),
                     CAST('in_transit' AS tow_dispatch_stage),
                     CAST('not_running' AS tow_incident_reason),
                     41.0, 28.9, now(), now())
                """
            ),
            {"id": case_id, "vid": vehicle_id, "uid": customer_id},
        )
        await db.commit()

        case = await db.get(__import__("app.models", fromlist=["ServiceCase"]).ServiceCase, case_id)
        assert case is not None

        cap_amount = Decimal("1000")
        actual_amount = Decimal("1500")  # exceeds cap by 500
        settlement = await tow_repo.create_settlement(
            db,
            case_id=case.id,
            cap_amount=cap_amount,
            quoted_amount=cap_amount,
        )
        await tow_repo.update_settlement_state(
            db,
            settlement.id,
            TowSettlementStatus.PRE_AUTH_HOLDING,
            preauth_id="test_pa_cap",
            preauth_authorized_at=datetime.now(UTC),
        )
        await db.commit()

        psp = AsyncMock()
        psp.capture = AsyncMock(
            return_value=PspResult(
                success=True, provider_ref="cap_ref", raw={"op": "capture"}
            )
        )
        psp.refund = AsyncMock(
            return_value=PspResult(
                success=True, provider_ref="rf_ref", raw={"op": "refund"}
            )
        )

        await capture_final(db, case=case, actual_amount=actual_amount, psp=psp)
        await db.commit()

        reloaded = await tow_repo.get_settlement_by_case(db, case.id)
        assert reloaded is not None
        assert reloaded.final_amount == cap_amount  # clamped to cap
        assert reloaded.actual_amount == actual_amount

        # PSP.capture invoked with clamped amount, not actual
        psp.capture.assert_called_once()
        assert psp.capture.call_args.kwargs["amount"] == cap_amount
        # No capture_delta refund since final == cap
        psp.refund.assert_not_called()

        # Cleanup
        await db.execute(
            _text("DELETE FROM tow_fare_settlements WHERE case_id = :id"),
            {"id": case.id},
        )
        await db.execute(
            _text("DELETE FROM tow_payment_idempotency WHERE settlement_id = :id"),
            {"id": settlement.id},
        )
        await db.execute(
            _text("DELETE FROM case_events WHERE case_id = :id"), {"id": case.id}
        )
        await db.execute(
            _text("DELETE FROM service_cases WHERE id = :id"), {"id": case.id}
        )
        await _cleanup(db, [customer_id], [vehicle_id])
        await db.commit()
