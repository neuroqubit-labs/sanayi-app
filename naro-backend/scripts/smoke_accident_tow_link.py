"""Accident → tow parent_case_id E2E smoke (İş 4, PO brief 2026-04-23).

Amaç: Faz 2 tow_case.parent_case_id akışının uçtan uca doğrulanması.
Kapsam:
1. Customer + vehicle + technician seed
2. Accident case create (subtype dispatch + snapshot)
3. linked_tow_case_ids boş (henüz child yok)
4. Tow case create with parent_case_id=accident.id
5. Bidirectional link (accident → linked_tow + tow → parent_case_id)
6. Tow lifecycle sim (preauth → assigned → en_route → arrived → loading
   → in_transit → delivered); evidence gate skip (smoke amaçlı)
7. Independent lifecycle: tow DELIVERED sonrası accident shell hâlâ
   MATCHING (tow lifecycle accident'i etkilemez)
8. Snapshot tutarlılığı: iki case'in kendi subtype snapshot'ları aynı
   vehicle'dan kopyalanır

Çalıştırma:
    cd naro-backend
    set -a && source .env.local && set +a
    uv run python scripts/smoke_accident_tow_link.py

Idempotent — aynı run 2x güvenli (baştaki cleanup prefix'li row'ları
siler). REST katmanı atlanır; direkt service layer'dan çağrı (HTTP
auth simülasyonu cross-test bloker'dan kaçınmak için).

Exit code: 0 PASS, 1 FAIL (çıktıda detay).
"""

from __future__ import annotations

import asyncio
import logging
import sys
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import text as _text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.integrations.psp.mock import build_mock_psp
from app.models.case import (
    CaseOrigin,
    ServiceCase,
    ServiceCaseStatus,
    ServiceRequestKind,
    ServiceRequestUrgency,
    TowDispatchStage,
    TowIncidentReason,
    TowMode,
)
from app.models.case_subtypes import AccidentCase, TowCase
from app.repositories import case as case_repo
from app.repositories import tow as tow_repo
from app.schemas.service_request import (
    AccidentReportMethod,
    CaseAttachmentDraft,
    CaseAttachmentKind,
    DamageSeverity,
    LatLng,
    ServiceRequestDraftCreate,
)
from app.services import case_create, tow_payment

logger = logging.getLogger("smoke_accident_tow_link")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

SMOKE_PREFIX = "SMOKE_LINK_"
PICKUP_LAT = 38.7353
PICKUP_LNG = 35.4795
DROPOFF_LAT = 38.7400
DROPOFF_LNG = 35.4800


# ─── Seed helpers ──────────────────────────────────────────────────────


async def _cleanup_prior_run(db: AsyncSession) -> None:
    """Aynı prefix'li prior row'ları siler — idempotent re-run için."""
    # Dependent rows önce (FK zinciri)
    await db.execute(
        _text(
            """
            DELETE FROM tow_fare_settlements WHERE case_id IN (
                SELECT id FROM service_cases WHERE title LIKE :p
            )
            """
        ),
        {"p": f"{SMOKE_PREFIX}%"},
    )
    await db.execute(
        _text(
            """
            DELETE FROM tow_payment_idempotency WHERE settlement_id IN (
                SELECT id FROM tow_fare_settlements
                WHERE case_id IN (SELECT id FROM service_cases WHERE title LIKE :p)
            )
            """
        ),
        {"p": f"{SMOKE_PREFIX}%"},
    )
    await db.execute(
        _text(
            """
            DELETE FROM case_events WHERE case_id IN (
                SELECT id FROM service_cases WHERE title LIKE :p
            )
            """
        ),
        {"p": f"{SMOKE_PREFIX}%"},
    )
    await db.execute(
        _text("DELETE FROM service_cases WHERE title LIKE :p"),
        {"p": f"{SMOKE_PREFIX}%"},
    )
    await db.execute(
        _text(
            """
            DELETE FROM user_vehicle_links WHERE user_id IN (
                SELECT id FROM users WHERE full_name LIKE :p
            )
            """
        ),
        {"p": f"{SMOKE_PREFIX}%"},
    )
    await db.execute(
        _text(
            """
            DELETE FROM vehicles WHERE plate_normalized LIKE :p
            """
        ),
        {"p": f"{SMOKE_PREFIX}%"},
    )
    await db.execute(
        _text("DELETE FROM users WHERE full_name LIKE :p"),
        {"p": f"{SMOKE_PREFIX}%"},
    )


async def _seed_customer(db: AsyncSession) -> UUID:
    uid = uuid4()
    await db.execute(
        _text(
            """
            INSERT INTO users (id, phone, role, status, locale, full_name,
                               created_at, updated_at)
            VALUES (:id, :phone, CAST('customer' AS user_role),
                    CAST('active' AS user_status), 'tr-TR', :name,
                    now(), now())
            """
        ),
        {
            "id": uid,
            "phone": f"+90555{uuid4().hex[:7]}",
            "name": f"{SMOKE_PREFIX}Customer",
        },
    )
    return uid


async def _seed_technician(db: AsyncSession) -> UUID:
    uid = uuid4()
    await db.execute(
        _text(
            """
            INSERT INTO users (id, phone, role, status, locale, full_name,
                               created_at, updated_at)
            VALUES (:id, :phone, CAST('technician' AS user_role),
                    CAST('active' AS user_status), 'tr-TR', :name,
                    now(), now())
            """
        ),
        {
            "id": uid,
            "phone": f"+90556{uuid4().hex[:7]}",
            "name": f"{SMOKE_PREFIX}Technician",
        },
    )
    return uid


async def _seed_vehicle(db: AsyncSession, owner_id: UUID) -> UUID:
    vid = uuid4()
    plate_norm = f"{SMOKE_PREFIX}{uuid4().hex[:6].upper()}"
    await db.execute(
        _text(
            """
            INSERT INTO vehicles (id, plate, plate_normalized, make, model,
                                  year, fuel_type, vin, current_km,
                                  created_at, updated_at)
            VALUES (:id, :plate, :plate_norm, 'Ford', 'Focus', 2019,
                    CAST('petrol' AS vehicle_fuel_type), :vin, 50000,
                    now(), now())
            """
        ),
        {
            "id": vid,
            "plate": f"38 X {uuid4().hex[:4].upper()}",
            "plate_norm": plate_norm,
            "vin": f"VIN{uuid4().hex[:14].upper()}",
        },
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


async def _seed_media_asset(db: AsyncSession, owner_id: UUID) -> UUID:
    mid = uuid4()
    await db.execute(
        _text(
            """
            INSERT INTO media_assets (id, upload_id, purpose, visibility,
                                      status, owner_ref, owner_kind, owner_id,
                                      bucket_name, object_key,
                                      original_filename, mime_type,
                                      size_bytes, checksum_sha256, etag,
                                      uploaded_by_user_id, uploaded_at,
                                      created_at, updated_at)
            VALUES (:id, :upload_id, 'case_attachment', 'private',
                    'ready', :owner_ref, 'user', :owner_id,
                    'smoke-bucket', :obj_key,
                    'smoke.jpg', 'image/jpeg',
                    12345, :sha, :etag, :uid, now(), now(), now())
            """
        ),
        {
            "id": mid,
            "upload_id": uuid4(),
            "owner_ref": str(owner_id),
            "owner_id": owner_id,
            "obj_key": f"smoke/{mid}",
            "sha": uuid4().hex,
            "etag": uuid4().hex,
            "uid": owner_id,
        },
    )
    return mid


# ─── Checkpoints ───────────────────────────────────────────────────────


class SmokeFailed(RuntimeError):  # noqa: N818 (script-specific naming)
    pass


def _check(condition: bool, label: str) -> None:
    if condition:
        logger.info("  ✓ %s", label)
    else:
        logger.error("  ✗ %s", label)
        raise SmokeFailed(label)


# ─── Main flow ─────────────────────────────────────────────────────────


async def main() -> int:
    async with AsyncSessionLocal() as db:
        logger.info("── 0. Cleanup prior run ──")
        await _cleanup_prior_run(db)
        await db.commit()

        logger.info("── 1. Seed (customer + technician + vehicle + media) ──")
        customer_id = await _seed_customer(db)
        tech_id = await _seed_technician(db)
        vehicle_id = await _seed_vehicle(db, customer_id)
        scene_asset = await _seed_media_asset(db, customer_id)
        damage_asset = await _seed_media_asset(db, customer_id)
        await db.commit()
        logger.info("  customer=%s tech=%s vehicle=%s", customer_id, tech_id, vehicle_id)

        logger.info("── 2. Accident case create ──")
        accident_draft = ServiceRequestDraftCreate(
            kind=ServiceRequestKind.ACCIDENT,
            vehicle_id=vehicle_id,
            urgency=ServiceRequestUrgency.URGENT,
            summary=f"{SMOKE_PREFIX}kaza",
            location_label="Kayseri merkez",
            location_lat_lng=LatLng(lat=PICKUP_LAT, lng=PICKUP_LNG),
            counterparty_vehicle_count=0,
            damage_area="ön",
            damage_severity=DamageSeverity.MODERATE,
            report_method=AccidentReportMethod.E_DEVLET,
            emergency_acknowledged=True,
            kasko_selected=False,
            attachments=[
                CaseAttachmentDraft(
                    id=f"a-{uuid4().hex[:8]}",
                    kind=CaseAttachmentKind.PHOTO,
                    title="Olay yeri",
                    asset_id=scene_asset,
                    category="scene_overview",
                ),
                CaseAttachmentDraft(
                    id=f"a-{uuid4().hex[:8]}",
                    kind=CaseAttachmentKind.PHOTO,
                    title="Hasar detay",
                    asset_id=damage_asset,
                    category="damage_detail",
                ),
            ],
        )
        # Title override prefix (case_create title builder smoke prefix'i korumaz;
        # cleanup için accident shell title'ını güncelle)
        accident_result = await case_create.create_case(
            db, user_id=customer_id, draft=accident_draft
        )
        accident_case = accident_result.case
        accident_case.title = f"{SMOKE_PREFIX}accident {accident_case.id}"
        await db.commit()
        logger.info("  accident_case_id=%s", accident_case.id)

        _check(
            accident_case.kind == ServiceRequestKind.ACCIDENT,
            "accident shell kind=accident",
        )
        _check(
            accident_case.status == ServiceCaseStatus.MATCHING,
            "accident shell status=MATCHING",
        )

        accident_subtype = await db.get(AccidentCase, accident_case.id)
        _check(
            accident_subtype is not None,
            "accident_case subtype row insert edildi",
        )
        assert accident_subtype is not None
        _check(
            accident_subtype.snapshot_plate is not None
            and len(accident_subtype.snapshot_plate) > 0,
            f"accident snapshot_plate='{accident_subtype.snapshot_plate}' (populated)",
        )
        _check(
            accident_subtype.snapshot_make == "Ford"
            and accident_subtype.snapshot_model == "Focus",
            f"accident snapshot make/model='Ford/Focus'",
        )
        _check(
            accident_subtype.damage_severity == "moderate",
            "accident damage_severity=moderate",
        )

        logger.info("── 3. linked_tow_case_ids boş olmalı ──")
        linked = await case_repo.list_linked_tow_case_ids(db, accident_case.id)
        _check(linked == [], f"linked_tow_case_ids=[] (got={linked})")

        logger.info("── 4. Tow case create with parent_case_id ──")
        tow_case_shell = ServiceCase(
            vehicle_id=vehicle_id,
            customer_user_id=customer_id,
            kind=ServiceRequestKind.TOWING,
            urgency=ServiceRequestUrgency.URGENT,
            status=ServiceCaseStatus.MATCHING,
            origin=CaseOrigin.CUSTOMER,
            title=f"{SMOKE_PREFIX}tow {accident_case.id}",
            workflow_blueprint="towing_immediate",
            request_draft={"parent_case_id": str(accident_case.id)},
        )
        db.add(tow_case_shell)
        await db.flush()

        snapshot = await case_create.build_vehicle_snapshot(db, vehicle_id)
        tow_subtype = TowCase(
            case_id=tow_case_shell.id,
            parent_case_id=accident_case.id,
            tow_mode=TowMode.IMMEDIATE,
            tow_stage=TowDispatchStage.SEARCHING,
            tow_required_equipment=None,
            incident_reason=TowIncidentReason.ACCIDENT,
            pickup_lat=PICKUP_LAT,
            pickup_lng=PICKUP_LNG,
            pickup_address="Kayseri kaza yeri",
            dropoff_lat=DROPOFF_LAT,
            dropoff_lng=DROPOFF_LNG,
            dropoff_address="Servis adresi",
            tow_fare_quote={
                "mode": "immediate",
                "base_amount": "200",
                "distance_km": "10",
                "per_km_rate": "30",
                "urgency_surcharge": "0",
                "buffer_pct": "0.15",
                "cap_amount": "575",
                "currency": "TRY",
            },
            **snapshot,
        )
        db.add(tow_subtype)
        await db.commit()
        logger.info("  tow_case_id=%s parent=%s", tow_case_shell.id, accident_case.id)

        logger.info("── 5. Bidirectional link verify ──")
        linked_after = await case_repo.list_linked_tow_case_ids(
            db, accident_case.id
        )
        _check(
            linked_after == [tow_case_shell.id],
            f"accident → linked_tow_case_ids=[{tow_case_shell.id}]",
        )

        fetched_tow = await db.get(TowCase, tow_case_shell.id)
        assert fetched_tow is not None
        _check(
            fetched_tow.parent_case_id == accident_case.id,
            f"tow → parent_case_id={accident_case.id}",
        )

        logger.info("── 6. Snapshot tutarlılığı ──")
        _check(
            accident_subtype.snapshot_plate == fetched_tow.snapshot_plate,
            f"iki subtype aynı plate '{fetched_tow.snapshot_plate}'",
        )
        _check(
            accident_subtype.snapshot_make == fetched_tow.snapshot_make,
            f"iki subtype aynı make '{fetched_tow.snapshot_make}'",
        )
        _check(
            accident_subtype.snapshot_current_km
            == fetched_tow.snapshot_current_km,
            f"iki subtype aynı current_km={fetched_tow.snapshot_current_km}",
        )

        logger.info("── 7. Tow lifecycle sim (preauth + stages) ──")
        outcome = await tow_payment.authorize_preauth(
            db,
            case=tow_case_shell,
            cap_amount=Decimal("575"),
            quoted_amount=Decimal("575"),
            customer_token="",
            psp=build_mock_psp(),
        )
        await db.commit()
        _check(
            outcome.state.value == "pre_auth_holding",
            f"preauth state={outcome.state.value}",
        )

        # Direct stage transitions (evidence gate ve dispatch candidate
        # simülasyonu scope dışı — canonical stage machine doğrula).
        stages = [
            (TowDispatchStage.SEARCHING, TowDispatchStage.ACCEPTED),
            (TowDispatchStage.ACCEPTED, TowDispatchStage.EN_ROUTE),
            (TowDispatchStage.EN_ROUTE, TowDispatchStage.ARRIVED),
            (TowDispatchStage.ARRIVED, TowDispatchStage.LOADING),
            (TowDispatchStage.LOADING, TowDispatchStage.IN_TRANSIT),
            (TowDispatchStage.IN_TRANSIT, TowDispatchStage.DELIVERED),
        ]
        for from_stage, to_stage in stages:
            moved = await tow_repo.update_tow_stage_with_lock(
                db,
                case_id=tow_case_shell.id,
                from_stage=from_stage,
                to_stage=to_stage,
            )
            _check(moved, f"stage {from_stage.value} → {to_stage.value}")
        tow_case_shell.assigned_technician_id = tech_id
        tow_case_shell.status = ServiceCaseStatus.COMPLETED
        await db.commit()

        logger.info("── 8. Independent lifecycle verify ──")
        await db.refresh(accident_case)
        await db.refresh(tow_case_shell)
        _check(
            accident_case.status == ServiceCaseStatus.MATCHING,
            f"accident shell hâlâ MATCHING (got={accident_case.status.value})",
        )
        _check(
            tow_case_shell.status == ServiceCaseStatus.COMPLETED,
            f"tow shell COMPLETED (got={tow_case_shell.status.value})",
        )

        final_tow = await db.get(TowCase, tow_case_shell.id)
        assert final_tow is not None
        _check(
            final_tow.tow_stage == TowDispatchStage.DELIVERED,
            "tow_case.tow_stage=DELIVERED",
        )

        linked_final = await case_repo.list_linked_tow_case_ids(
            db, accident_case.id
        )
        _check(
            linked_final == [tow_case_shell.id],
            "tow DELIVERED sonrası accident bağlantısı korunur",
        )

        logger.info("── 9. Cleanup ──")
        await _cleanup_prior_run(db)
        await db.commit()

    logger.info("✓ SMOKE PASS — accident → tow link akışı sağlıklı")
    return 0


if __name__ == "__main__":
    try:
        code = asyncio.run(main())
    except SmokeFailed as exc:
        logger.error("✗ SMOKE FAIL: %s", exc)
        sys.exit(1)
    except Exception:
        logger.exception("✗ SMOKE ERROR — unexpected")
        sys.exit(1)
    sys.exit(code)
