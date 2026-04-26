"""DB integration — completion approval publishes public showcase.

Bu test geniş endpoint auth katmanını değil, canonical kapanış servislerini
birlikte doğrular: final approval, zorunlu review ve iki taraf izin sonrası
public showcase yayına çıkar.
"""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from sqlalchemy import select
from sqlalchemy import text as _text

from app.db.session import AsyncSessionLocal
from app.models.case import ServiceCase
from app.models.case_process import (
    CaseApprovalKind,
    CaseApprovalLineItem,
)
from app.models.case_public_showcase import (
    CasePublicShowcase,
    CasePublicShowcaseStatus,
)
from app.repositories import review as review_repo
from app.services import approval_flow, case_public_showcases


async def _make_customer(db) -> UUID:
    user_id = uuid4()
    await db.execute(
        _text(
            """
            INSERT INTO users (id, phone, role, status, locale,
                               created_at, updated_at)
            VALUES (:id, :phone, CAST('customer' AS user_role),
                    CAST('active' AS user_status), 'tr-TR', now(), now())
            """
        ),
        {"id": user_id, "phone": f"+90555{uuid4().hex[:7]}"},
    )
    return user_id


async def _make_technician(db) -> tuple[UUID, UUID]:
    user_id = uuid4()
    profile_id = uuid4()
    await db.execute(
        _text(
            """
            INSERT INTO users (id, phone, role, status, approval_status,
                               locale, full_name, created_at, updated_at)
            VALUES (:id, :phone, CAST('technician' AS user_role),
                    CAST('active' AS user_status),
                    CAST('active' AS user_approval_status),
                    'tr-TR', 'Test Usta', now(), now())
            """
        ),
        {"id": user_id, "phone": f"+90556{uuid4().hex[:7]}"},
    )
    await db.execute(
        _text(
            """
            INSERT INTO technician_profiles (
                id, user_id, display_name, availability, verified_level,
                provider_type, secondary_provider_types, business_info,
                provider_mode, role_config_version, is_mock,
                created_at, updated_at
            )
            VALUES (
                :profile_id, :user_id, 'Test Usta',
                CAST('available' AS technician_availability),
                CAST('verified' AS technician_verified_level),
                CAST('usta' AS provider_type),
                ARRAY[]::provider_type[], '{}'::jsonb,
                CAST('business' AS provider_mode), 1, false,
                now(), now()
            )
            """
        ),
        {"profile_id": profile_id, "user_id": user_id},
    )
    return user_id, profile_id


async def _make_vehicle(db) -> UUID:
    vehicle_id = uuid4()
    plate = f"34 T {uuid4().hex[:4].upper()}"
    await db.execute(
        _text(
            """
            INSERT INTO vehicles (id, plate, plate_normalized, created_at, updated_at)
            VALUES (:id, :plate, :plate_norm, now(), now())
            """
        ),
        {"id": vehicle_id, "plate": plate, "plate_norm": plate.replace(" ", "")},
    )
    return vehicle_id


async def _make_case(db, *, customer_id: UUID, technician_id: UUID) -> tuple[UUID, UUID]:
    vehicle_id = await _make_vehicle(db)
    case_id = uuid4()
    await db.execute(
        _text(
            """
            INSERT INTO service_cases (
                id, vehicle_id, customer_user_id, assigned_technician_id,
                kind, urgency, status, origin, title, summary, location_label,
                workflow_blueprint, request_draft, wait_state_actor,
                billing_state, created_at, updated_at
            )
            VALUES (
                :case_id, :vehicle_id, :customer_id, :technician_id,
                CAST('maintenance' AS service_request_kind),
                CAST('planned' AS service_request_urgency),
                CAST('invoice_approval' AS service_case_status),
                CAST('customer' AS case_origin),
                'Periyodik bakım', '34 ABC 123 plakalı araç için 8.500 TL bakım',
                'Kadıköy, İstanbul, No: 12',
                'maintenance_major', '{}'::jsonb,
                CAST('technician' AS case_wait_actor),
                'settled', now(), now()
            )
            """
        ),
        {
            "case_id": case_id,
            "vehicle_id": vehicle_id,
            "customer_id": customer_id,
            "technician_id": technician_id,
        },
    )
    return case_id, vehicle_id


async def _cleanup(db, *, case_ids: list[UUID], vehicle_ids: list[UUID]) -> None:
    if not case_ids and not vehicle_ids:
        return
    if case_ids:
        await db.execute(
            _text(
                "DELETE FROM case_public_showcase_media "
                "WHERE showcase_id IN ("
                "SELECT id FROM case_public_showcases WHERE case_id = ANY(:ids))"
            ),
            {"ids": case_ids},
        )
        await db.execute(
            _text("DELETE FROM case_public_showcases WHERE case_id = ANY(:ids)"),
            {"ids": case_ids},
        )
        await db.execute(
            _text("DELETE FROM reviews WHERE case_id = ANY(:ids)"),
            {"ids": case_ids},
        )
        await db.execute(
            _text(
                "DELETE FROM case_approval_line_items "
                "WHERE approval_id IN ("
                "SELECT id FROM case_approvals WHERE case_id = ANY(:ids))"
            ),
            {"ids": case_ids},
        )
        await db.execute(
            _text("DELETE FROM case_approvals WHERE case_id = ANY(:ids)"),
            {"ids": case_ids},
        )
        await db.execute(
            _text("DELETE FROM case_events WHERE case_id = ANY(:ids)"),
            {"ids": case_ids},
        )
        await db.execute(
            _text("DELETE FROM service_cases WHERE id = ANY(:ids)"),
            {"ids": case_ids},
        )
    if vehicle_ids:
        await db.execute(
            _text("DELETE FROM vehicles WHERE id = ANY(:ids)"),
            {"ids": vehicle_ids},
        )


@pytest.mark.asyncio
async def test_completion_showcase_publishes_after_dual_consent() -> None:
    async with AsyncSessionLocal() as db:
        customer_id = await _make_customer(db)
        technician_id, profile_id = await _make_technician(db)
        case_id, vehicle_id = await _make_case(
            db, customer_id=customer_id, technician_id=technician_id
        )
        await db.commit()

        approval = await approval_flow.request_approval(
            db,
            case_id=case_id,
            kind=CaseApprovalKind.COMPLETION,
            title="Teslim raporu",
            description="Periyodik bakım tamamlandı.",
            requested_by_user_id=technician_id,
            requested_by_snapshot_name="Test Usta",
            line_items=[
                {"label": "Yapılan işlem özeti", "value": "Yağ ve filtre bakımı"},
                {"label": "Teslim kilometresi", "value": "84250"},
                {"label": "Fatura tutarı", "value": "8.500 TL"},
            ],
        )
        case = await db.get(ServiceCase, case_id)
        assert case is not None
        line_items = list(
            (
                await db.execute(
                    select(CaseApprovalLineItem).where(
                        CaseApprovalLineItem.approval_id == approval.id
                    )
                )
            )
            .scalars()
            .all()
        )
        await case_public_showcases.upsert_from_completion_request(
            db,
            case=case,
            approval=approval,
            line_items=line_items,
            technician_consented=True,
            media_ids=[],
        )

        decided = await approval_flow.approve(db, approval.id, actor_user_id=customer_id)
        review = await review_repo.create_review(
            db,
            case_id=case_id,
            reviewer_user_id=customer_id,
            reviewee_user_id=technician_id,
            rating=5,
            body="Temiz ve hızlı teslim edildi.",
        )
        await case_public_showcases.apply_customer_completion_decision(
            db,
            case=case,
            approval=decided,
            line_items=line_items,
            customer_consented=True,
            rating=review.rating,
            review_body=review.body,
            review_id=review.id,
        )
        await db.commit()

        showcase = (
            await db.execute(
                select(CasePublicShowcase).where(CasePublicShowcase.case_id == case_id)
            )
        ).scalar_one()
        assert showcase.technician_profile_id == profile_id
        assert showcase.status == CasePublicShowcaseStatus.PUBLISHED
        assert showcase.public_snapshot["rating"] == 5
        assert "TL" not in str(showcase.public_snapshot)
        assert "34 ABC 123" not in str(showcase.public_snapshot)

        await _cleanup(db, case_ids=[case_id], vehicle_ids=[vehicle_id])
        await db.execute(
            _text("DELETE FROM technician_profiles WHERE id = :id"),
            {"id": profile_id},
        )
        await db.execute(
            _text("DELETE FROM users WHERE id = ANY(:ids)"),
            {"ids": [customer_id, technician_id]},
        )
        await db.commit()
