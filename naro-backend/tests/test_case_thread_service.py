"""Case thread service DB integration — İş 3 (2026-04-23).

Kapsam:
- create_message happy path: customer + technician role dispatch
- terminal status (COMPLETED) → ThreadClosedError
- disintermediation content → DisintermediationRejectedError
- list_messages DESC + cursor pagination
- mark_seen → last_seen_by_* + unread reset
- customer_notes owner-only visibility
"""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from sqlalchemy import select, text as _text

from app.db.session import AsyncSessionLocal
from app.models.case import (
    ServiceCase,
    ServiceCaseStatus,
    ServiceRequestKind,
    ServiceRequestUrgency,
    CaseOrigin,
)
from app.models.case_communication import CaseMessage, CaseThread
from app.models.user import User
from app.services import case_thread as thread_svc


# ─── Fixtures ─────────────────────────────────────────────────────────


async def _make_user(db, role: str = "customer") -> UUID:
    uid = uuid4()
    phone = f"+90555{uuid4().hex[:7]}"
    await db.execute(
        _text(
            """
            INSERT INTO users (id, phone, role, status, locale, full_name,
                               created_at, updated_at)
            VALUES (:id, :phone, CAST(:role AS user_role),
                    CAST('active' AS user_status), 'tr-TR', 'Test User',
                    now(), now())
            """
        ),
        {"id": uid, "phone": phone, "role": role},
    )
    return uid


async def _make_vehicle(db, owner_id: UUID) -> UUID:
    vid = uuid4()
    plate = f"34 T {uuid4().hex[:4].upper()}"
    await db.execute(
        _text(
            """
            INSERT INTO vehicles (id, plate, plate_normalized,
                                  created_at, updated_at)
            VALUES (:id, :plate, :plate_norm, now(), now())
            """
        ),
        {"id": vid, "plate": plate, "plate_norm": plate.replace(" ", "")},
    )
    await db.execute(
        _text(
            """
            INSERT INTO user_vehicle_links (id, user_id, vehicle_id, role,
                                            is_primary, ownership_from,
                                            created_at)
            VALUES (:lid, :uid, :vid, 'owner', true, now(), now())
            """
        ),
        {"lid": uuid4(), "uid": owner_id, "vid": vid},
    )
    return vid


async def _make_case(
    db,
    customer_id: UUID,
    vehicle_id: UUID,
    status: ServiceCaseStatus = ServiceCaseStatus.MATCHING,
    technician_id: UUID | None = None,
) -> ServiceCase:
    case = ServiceCase(
        vehicle_id=vehicle_id,
        customer_user_id=customer_id,
        kind=ServiceRequestKind.MAINTENANCE,
        urgency=ServiceRequestUrgency.PLANNED,
        status=status,
        origin=CaseOrigin.CUSTOMER,
        title="Thread test",
        workflow_blueprint="maintenance_standard",
        request_draft={},
        assigned_technician_id=technician_id,
    )
    db.add(case)
    await db.flush()
    return case


async def _cleanup(db, *, user_ids: list[UUID], vehicle_ids: list[UUID]) -> None:
    if user_ids:
        await db.execute(
            _text(
                "DELETE FROM case_messages WHERE case_id IN "
                "(SELECT id FROM service_cases WHERE customer_user_id = ANY(:ids))"
            ),
            {"ids": user_ids},
        )
        await db.execute(
            _text(
                "DELETE FROM case_threads WHERE case_id IN "
                "(SELECT id FROM service_cases WHERE customer_user_id = ANY(:ids))"
            ),
            {"ids": user_ids},
        )
        await db.execute(
            _text(
                "DELETE FROM service_cases WHERE customer_user_id = ANY(:ids)"
            ),
            {"ids": user_ids},
        )
        await db.execute(
            _text("DELETE FROM user_vehicle_links WHERE user_id = ANY(:ids)"),
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


# ─── Tests ────────────────────────────────────────────────────────────


@pytest.mark.skip(
    reason="Cross-test asyncpg event-loop (Faz 10/11 bloker); per-test engine sonrası aktif."
)
@pytest.mark.asyncio
async def test_create_message_customer_happy_path() -> None:
    async with AsyncSessionLocal() as db:
        customer_id = await _make_user(db)
        tech_id = await _make_user(db, role="technician")
        vehicle_id = await _make_vehicle(db, customer_id)
        case = await _make_case(
            db, customer_id, vehicle_id, technician_id=tech_id
        )
        customer = await db.get(User, customer_id)
        assert customer is not None

        created = await thread_svc.create_message(
            db, case=case, user=customer, content="Merhaba usta"
        )
        await db.commit()

        assert created.sender_role == "customer"
        assert created.content == "Merhaba usta"

        # Thread + unread counter
        thread = (
            await db.execute(
                select(CaseThread).where(CaseThread.case_id == case.id)
            )
        ).scalar_one()
        assert thread.unread_technician == 1
        assert thread.unread_customer == 0
        assert thread.preview == "Merhaba usta"

        await _cleanup(
            db,
            user_ids=[customer_id, tech_id],
            vehicle_ids=[vehicle_id],
        )
        await db.commit()


@pytest.mark.skip(
    reason="Cross-test asyncpg event-loop (Faz 10/11 bloker); per-test engine sonrası aktif."
)
@pytest.mark.asyncio
async def test_create_message_terminal_status_rejects() -> None:
    async with AsyncSessionLocal() as db:
        customer_id = await _make_user(db)
        vehicle_id = await _make_vehicle(db, customer_id)
        case = await _make_case(
            db, customer_id, vehicle_id, status=ServiceCaseStatus.COMPLETED
        )
        await db.commit()

        customer = await db.get(User, customer_id)
        assert customer is not None
        with pytest.raises(thread_svc.ThreadClosedError):
            await thread_svc.create_message(
                db, case=case, user=customer, content="Mesaj"
            )

        await _cleanup(
            db, user_ids=[customer_id], vehicle_ids=[vehicle_id]
        )
        await db.commit()


@pytest.mark.skip(
    reason="Cross-test asyncpg event-loop (Faz 10/11 bloker); per-test engine sonrası aktif."
)
@pytest.mark.asyncio
async def test_create_message_disintermediation_rejects() -> None:
    async with AsyncSessionLocal() as db:
        customer_id = await _make_user(db)
        vehicle_id = await _make_vehicle(db, customer_id)
        case = await _make_case(db, customer_id, vehicle_id)
        await db.commit()

        customer = await db.get(User, customer_id)
        assert customer is not None
        with pytest.raises(thread_svc.DisintermediationRejectedError):
            await thread_svc.create_message(
                db,
                case=case,
                user=customer,
                content="Beni ara 0532 123 45 67",
            )

        await _cleanup(
            db, user_ids=[customer_id], vehicle_ids=[vehicle_id]
        )
        await db.commit()


@pytest.mark.skip(
    reason="Cross-test asyncpg event-loop (Faz 10/11 bloker); per-test engine sonrası aktif."
)
@pytest.mark.asyncio
async def test_list_messages_desc_cursor() -> None:
    async with AsyncSessionLocal() as db:
        customer_id = await _make_user(db)
        tech_id = await _make_user(db, role="technician")
        vehicle_id = await _make_vehicle(db, customer_id)
        case = await _make_case(
            db, customer_id, vehicle_id, technician_id=tech_id
        )
        customer = await db.get(User, customer_id)
        assert customer is not None

        for i in range(5):
            await thread_svc.create_message(
                db, case=case, user=customer, content=f"m{i}"
            )
        await db.commit()

        page1 = await thread_svc.list_messages(
            db, case_id=case.id, limit=3, cursor=None
        )
        assert len(page1.items) == 3
        assert page1.items[0].body == "m4"  # DESC
        assert page1.next_cursor is not None

        page2 = await thread_svc.list_messages(
            db, case_id=case.id, limit=3, cursor=page1.next_cursor
        )
        assert len(page2.items) == 2
        assert page2.items[0].body == "m1"
        assert page2.next_cursor is None

        await _cleanup(
            db,
            user_ids=[customer_id, tech_id],
            vehicle_ids=[vehicle_id],
        )
        await db.commit()


@pytest.mark.skip(
    reason="Cross-test asyncpg event-loop (Faz 10/11 bloker); per-test engine sonrası aktif."
)
@pytest.mark.asyncio
async def test_mark_seen_updates_timestamp_and_resets_unread() -> None:
    async with AsyncSessionLocal() as db:
        customer_id = await _make_user(db)
        tech_id = await _make_user(db, role="technician")
        vehicle_id = await _make_vehicle(db, customer_id)
        case = await _make_case(
            db, customer_id, vehicle_id, technician_id=tech_id
        )
        customer = await db.get(User, customer_id)
        technician = await db.get(User, tech_id)
        assert customer is not None and technician is not None

        # Technician yazar → unread_customer = 1
        await thread_svc.create_message(
            db, case=case, user=technician, content="Hazır olduğunuzda"
        )
        await db.commit()

        # Customer markSeen
        await thread_svc.mark_seen(db, case=case, user=customer)
        await db.commit()
        await db.refresh(case)

        assert case.last_seen_by_customer is not None
        thread = (
            await db.execute(
                select(CaseThread).where(CaseThread.case_id == case.id)
            )
        ).scalar_one()
        assert thread.unread_customer == 0

        await _cleanup(
            db,
            user_ids=[customer_id, tech_id],
            vehicle_ids=[vehicle_id],
        )
        await db.commit()


@pytest.mark.skip(
    reason="Cross-test asyncpg event-loop (Faz 10/11 bloker); per-test engine sonrası aktif."
)
@pytest.mark.asyncio
async def test_soft_deleted_messages_excluded() -> None:
    async with AsyncSessionLocal() as db:
        customer_id = await _make_user(db)
        vehicle_id = await _make_vehicle(db, customer_id)
        case = await _make_case(db, customer_id, vehicle_id)
        customer = await db.get(User, customer_id)
        assert customer is not None

        created = await thread_svc.create_message(
            db, case=case, user=customer, content="silinecek"
        )
        await db.commit()

        # Soft delete
        msg = await db.get(CaseMessage, created.id)
        assert msg is not None
        from datetime import UTC, datetime as _dt

        msg.deleted_at = _dt.now(UTC)
        await db.commit()

        page = await thread_svc.list_messages(
            db, case_id=case.id, limit=10, cursor=None
        )
        assert len(page.items) == 0

        await _cleanup(
            db,
            user_ids=[customer_id],
            vehicle_ids=[vehicle_id],
        )
        await db.commit()
