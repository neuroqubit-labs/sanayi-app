"""Müşteri vaka oluşturma + listeleme + cancel endpoint'leri (brief §2.2).

- POST   /cases                (müşteri: create)
- GET    /cases/{id}           (participant: detay)
- GET    /cases/me             (müşteri: açık vakalar)
- POST   /cases/{id}/cancel    (müşteri/admin: iptal)

Draft endpoint'leri (POST/GET/DELETE /cases/drafts/*) ayrı brief kapsamında.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict

from app.api.v1.deps import CurrentUserDep, CustomerDep, DbDep
from app.models.case import (
    ServiceCase,
    ServiceCaseStatus,
    ServiceRequestKind,
)
from app.models.case_audit import CaseEventType, CaseTone
from app.models.case_subtypes import (
    AccidentCase,
    BreakdownCase,
    MaintenanceCase,
    TowCase,
)
from app.models.user import UserRole
from app.repositories import case as case_repo
from app.schemas.case_thread import CaseNotesPayload
from app.schemas.service_request import ServiceRequestDraftCreate
from app.services import case_create
from app.services.case_events import append_event

router = APIRouter(prefix="/cases", tags=["cases"])


# ─── Response models ────────────────────────────────────────────────────────


class CaseCreateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: ServiceCaseStatus
    kind: ServiceRequestKind
    workflow_blueprint: str
    created_at: datetime
    title: str


class CaseSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: ServiceRequestKind
    status: ServiceCaseStatus
    urgency: str
    title: str
    summary: str | None = None
    location_label: str | None = None
    created_at: datetime
    updated_at: datetime


class VehicleSnapshotResponse(BaseModel):
    """Immutable vehicle snapshot — case create anında alınır."""

    plate: str
    make: str | None = None
    model: str | None = None
    year: int | None = None
    fuel_type: str | None = None
    vin: str | None = None
    current_km: int | None = None


class CaseDetailResponse(CaseSummaryResponse):
    """Faz 1 canonical case architecture — shell + subtype + snapshot.

    Subtype dict kind'a göre shape alır (tow/accident/breakdown/maintenance).
    FE parity: kind bazlı discriminated union. Pilot V1 pratik şema; V2'de
    generic code generation (openapi → Zod) ile tip disipline edilecek.

    Faz 2 (2026-04-23): linkage field'ları.
    - `parent_case_id` — tow kind'da dolu ise accident/breakdown parent
    - `linked_tow_case_ids` — accident/breakdown kind'da parent ise child
      tow vakaları (0..n)
    """

    vehicle_snapshot: VehicleSnapshotResponse | None = None
    subtype: dict[str, object] | None = None
    parent_case_id: UUID | None = None
    linked_tow_case_ids: list[UUID] = []
    # İş 3 (2026-04-23) — customer_notes owner-private. Technician/admin
    # response'unda null döner (owner bile olsa admin view'ında null).
    customer_notes: str | None = None


# ─── Endpoints ──────────────────────────────────────────────────────────────


@router.post(
    "",
    response_model=CaseCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yeni vaka oluştur (müşteri)",
)
async def create_case_endpoint(
    draft: ServiceRequestDraftCreate,
    user: CustomerDep,
    db: DbDep,
) -> CaseCreateResponse:
    try:
        result = await case_create.create_case(db, user_id=user.id, draft=draft)
    except case_create.CaseCreateError as exc:
        detail: dict[str, object] = {
            "type": exc.error_type,
            "message": str(exc),
        }
        if isinstance(exc, case_create.MissingRequiredAttachmentsError):
            detail["missing"] = sorted(exc.missing)
        if isinstance(exc, case_create.DuplicateOpenCaseError):
            detail["existing_case_id"] = str(exc.existing_case_id)
            detail["kind"] = exc.kind
        raise HTTPException(status_code=exc.http_status, detail=detail) from exc

    await db.commit()
    case = result.case
    return CaseCreateResponse(
        id=case.id,
        status=case.status,
        kind=case.kind,
        workflow_blueprint=case.workflow_blueprint,
        created_at=case.created_at,
        title=case.title,
    )


@router.get(
    "/me",
    response_model=list[CaseSummaryResponse],
    summary="Müşterinin vakaları",
)
async def list_my_cases(
    user: CustomerDep,
    db: DbDep,
) -> list[CaseSummaryResponse]:
    cases = await case_repo.list_cases_for_customer(db, user.id)
    return [CaseSummaryResponse.model_validate(c) for c in cases]


@router.get(
    "/{case_id}",
    response_model=CaseDetailResponse,
    summary="Vaka detay (participant-only)",
)
async def get_case_endpoint(
    case_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
) -> CaseDetailResponse:
    case, subtype = await case_repo.get_case_with_subtype(db, case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(status_code=404, detail={"type": "case_not_found"})
    _assert_participant(case, user_id=user.id, role=user.role)
    # Faz 2 linkage: tow çocuksa parent_case_id, accident/breakdown parent'sa
    # child tow listesi.
    parent_case_id: UUID | None = None
    linked_tow_case_ids: list[UUID] = []
    if isinstance(subtype, TowCase):
        parent_case_id = subtype.parent_case_id
    elif case.kind in (
        ServiceRequestKind.ACCIDENT,
        ServiceRequestKind.BREAKDOWN,
    ):
        linked_tow_case_ids = await case_repo.list_linked_tow_case_ids(
            db, case.id
        )
    # customer_notes sadece owner'a döner
    notes = case.customer_notes if case.customer_user_id == user.id else None
    return CaseDetailResponse(
        id=case.id,
        kind=case.kind,
        status=case.status,
        urgency=case.urgency.value,
        title=case.title,
        summary=case.summary,
        location_label=case.location_label,
        created_at=case.created_at,
        updated_at=case.updated_at,
        vehicle_snapshot=_vehicle_snapshot_view(subtype),
        subtype=_subtype_view(subtype),
        parent_case_id=parent_case_id,
        linked_tow_case_ids=linked_tow_case_ids,
        customer_notes=notes,
    )


@router.patch(
    "/{case_id}/notes",
    response_model=CaseDetailResponse,
    summary="Müşteri notları güncelle (owner-only)",
)
async def update_case_notes(
    case_id: UUID,
    payload: CaseNotesPayload,
    user: CustomerDep,
    db: DbDep,
) -> CaseDetailResponse:
    case, subtype = await case_repo.get_case_with_subtype(db, case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(status_code=404, detail={"type": "case_not_found"})
    if case.customer_user_id != user.id:
        raise HTTPException(
            status_code=403, detail={"type": "not_case_owner"}
        )
    case.customer_notes = payload.content
    await db.commit()
    await db.refresh(case)

    parent_case_id: UUID | None = None
    linked_tow_case_ids: list[UUID] = []
    if isinstance(subtype, TowCase):
        parent_case_id = subtype.parent_case_id
    elif case.kind in (
        ServiceRequestKind.ACCIDENT,
        ServiceRequestKind.BREAKDOWN,
    ):
        linked_tow_case_ids = await case_repo.list_linked_tow_case_ids(
            db, case.id
        )
    return CaseDetailResponse(
        id=case.id,
        kind=case.kind,
        status=case.status,
        urgency=case.urgency.value,
        title=case.title,
        summary=case.summary,
        location_label=case.location_label,
        created_at=case.created_at,
        updated_at=case.updated_at,
        vehicle_snapshot=_vehicle_snapshot_view(subtype),
        subtype=_subtype_view(subtype),
        parent_case_id=parent_case_id,
        linked_tow_case_ids=linked_tow_case_ids,
        customer_notes=case.customer_notes,
    )


@router.post(
    "/{case_id}/cancel",
    response_model=CaseSummaryResponse,
    summary="Vaka iptal (müşteri/admin)",
)
async def cancel_case_endpoint(
    case_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
) -> CaseSummaryResponse:
    case = await case_repo.get_case(db, case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(status_code=404, detail={"type": "case_not_found"})
    # Sadece müşteri kendi vakasını veya admin iptal edebilir
    if case.customer_user_id != user.id and user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail={"type": "not_case_owner"}
        )
    if case.status in (
        ServiceCaseStatus.COMPLETED,
        ServiceCaseStatus.CANCELLED,
        ServiceCaseStatus.ARCHIVED,
    ):
        raise HTTPException(
            status_code=409,
            detail={
                "type": "case_closed",
                "message": f"case already {case.status.value}",
            },
        )
    case.status = ServiceCaseStatus.CANCELLED
    case.closed_at = datetime.now(UTC)
    await append_event(
        db,
        case_id=case.id,
        event_type=CaseEventType.CANCELLED,
        title="Vaka iptal edildi",
        tone=CaseTone.WARNING,
        actor_user_id=user.id,
    )
    await db.commit()
    return CaseSummaryResponse.model_validate(case)


# ─── Helpers ────────────────────────────────────────────────────────────────


def _assert_participant(case: ServiceCase, *, user_id: UUID, role: UserRole) -> None:
    if role == UserRole.ADMIN:
        return
    participant_ids = {case.customer_user_id, case.assigned_technician_id}
    if user_id not in participant_ids:
        raise HTTPException(
            status_code=403, detail={"type": "not_case_participant"}
        )


def _vehicle_snapshot_view(
    subtype: case_repo.CaseSubtype | None,
) -> VehicleSnapshotResponse | None:
    if subtype is None:
        return None
    return VehicleSnapshotResponse(
        plate=subtype.snapshot_plate,
        make=subtype.snapshot_make,
        model=subtype.snapshot_model,
        year=subtype.snapshot_year,
        fuel_type=subtype.snapshot_fuel_type,
        vin=subtype.snapshot_vin,
        current_km=subtype.snapshot_current_km,
    )


def _subtype_view(
    subtype: case_repo.CaseSubtype | None,
) -> dict[str, object] | None:
    if subtype is None:
        return None
    if isinstance(subtype, TowCase):
        return {
            "tow_mode": subtype.tow_mode.value,
            "tow_stage": subtype.tow_stage.value,
            "required_equipment": [
                e.value for e in (subtype.tow_required_equipment or [])
            ],
            "incident_reason": (
                subtype.incident_reason.value
                if subtype.incident_reason
                else None
            ),
            "scheduled_at": (
                subtype.scheduled_at.isoformat()
                if subtype.scheduled_at
                else None
            ),
            "pickup_lat": subtype.pickup_lat,
            "pickup_lng": subtype.pickup_lng,
            "pickup_address": subtype.pickup_address,
            "dropoff_lat": subtype.dropoff_lat,
            "dropoff_lng": subtype.dropoff_lng,
            "dropoff_address": subtype.dropoff_address,
            "fare_quote": subtype.tow_fare_quote,
        }
    if isinstance(subtype, AccidentCase):
        return {
            "damage_area": subtype.damage_area,
            "damage_severity": subtype.damage_severity,
            "counterparty_count": subtype.counterparty_count,
            "counterparty_note": subtype.counterparty_note,
            "kasko_selected": subtype.kasko_selected,
            "sigorta_selected": subtype.sigorta_selected,
            "kasko_brand": subtype.kasko_brand,
            "sigorta_brand": subtype.sigorta_brand,
            "ambulance_contacted": subtype.ambulance_contacted,
            "report_method": subtype.report_method,
            "emergency_acknowledged": subtype.emergency_acknowledged,
        }
    if isinstance(subtype, BreakdownCase):
        return {
            "breakdown_category": subtype.breakdown_category,
            "symptoms": subtype.symptoms,
            "vehicle_drivable": subtype.vehicle_drivable,
            "on_site_repair_requested": subtype.on_site_repair_requested,
            "valet_requested": subtype.valet_requested,
            "pickup_preference": subtype.pickup_preference,
            "price_preference": subtype.price_preference,
        }
    if isinstance(subtype, MaintenanceCase):
        return {
            "maintenance_category": subtype.maintenance_category,
            "maintenance_detail": subtype.maintenance_detail,
            "maintenance_tier": subtype.maintenance_tier,
            "service_style_preference": subtype.service_style_preference,
            "mileage_km": subtype.mileage_km,
            "valet_requested": subtype.valet_requested,
            "pickup_preference": subtype.pickup_preference,
            "price_preference": subtype.price_preference,
        }
    return None
