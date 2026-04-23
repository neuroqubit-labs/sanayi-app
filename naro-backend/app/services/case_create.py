"""Müşteri vaka oluşturma — 6-aşamalı submit akışı (§6.3 + §8).

1. Vehicle ownership kontrolü
2. Maintenance detail payload parse (kategori × şema map)
3. Attachment ownership + completion + uniqueness + kind bağları
4. REQUIRED_ATTACHMENT_MATRIX kontrolü
5. Duplicate open case guard (aynı araç için aynı kind)
6. Insert + workflow_blueprint + case_events audit + media link

Caller (router) HTTPException map eder; bu modül domain exception raise eder.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import and_, select, update

from app.models.case import (
    CaseOrigin,
    ServiceCase,
    ServiceCaseStatus,
    ServiceRequestKind,
    TowDispatchStage,
    TowMode,
)
from app.models.case_audit import CaseEventType, CaseTone
from app.models.case_process import CaseWorkflowBlueprint
from app.models.case_subtypes import (
    AccidentCase,
    BreakdownCase,
    MaintenanceCase,
    TowCase,
)
from app.models.media import MediaAsset, MediaStatus
from app.models.vehicle import UserVehicleLink, Vehicle
from app.observability.metrics import (
    case_create_total,
    case_create_validation_fail_total,
)
from app.schemas.service_request import (
    MaintenanceCategory,
    ServiceRequestDraftCreate,
)
from app.services.case_events import append_event
from app.services.maintenance_detail_validator import (
    MaintenanceDetailValidationError,
    validate_maintenance_detail,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


# ─── Domain exceptions ─────────────────────────────────────────────────────


class CaseCreateError(Exception):
    """Taban domain exception — alt sınıflar HTTP status'a map edilir."""

    http_status: int = 400
    error_type: str = "case_create_error"


class VehicleNotOwnedError(CaseCreateError):
    http_status = 403
    error_type = "vehicle_not_owned"


class AssetNotOwnedError(CaseCreateError):
    http_status = 403
    error_type = "asset_not_owned"


class AssetNotCompleteError(CaseCreateError):
    http_status = 422
    error_type = "asset_not_complete"


class AssetAlreadyLinkedError(CaseCreateError):
    http_status = 409
    error_type = "asset_already_linked"


class MissingRequiredAttachmentsError(CaseCreateError):
    http_status = 422
    error_type = "missing_required_attachments"

    def __init__(self, missing: set[str] | frozenset[str]) -> None:
        self.missing = set(missing)
        super().__init__(f"Zorunlu kanıt eksik: {sorted(self.missing)}")


class MaintenanceDetailError(CaseCreateError):
    http_status = 422
    error_type = "maintenance_detail_invalid"


class DuplicateOpenCaseError(CaseCreateError):
    http_status = 409
    error_type = "duplicate_open_case"

    def __init__(self, existing_case_id: UUID, kind: str) -> None:
        self.existing_case_id = existing_case_id
        self.kind = kind
        super().__init__(
            f"Aynı araç için açık {kind} vakası mevcut: {existing_case_id}"
        )


# ─── Required attachment matrix (§5.3) ─────────────────────────────────────


_OPEN_STATUSES: tuple[ServiceCaseStatus, ...] = (
    ServiceCaseStatus.MATCHING,
    ServiceCaseStatus.OFFERS_READY,
    ServiceCaseStatus.APPOINTMENT_PENDING,
    ServiceCaseStatus.SCHEDULED,
    ServiceCaseStatus.SERVICE_IN_PROGRESS,
    ServiceCaseStatus.PARTS_APPROVAL,
    ServiceCaseStatus.INVOICE_APPROVAL,
)

# (kind, sub_category) → zorunlu attachment.category set
REQUIRED_ATTACHMENT_MATRIX: dict[tuple[str, str | None], frozenset[str]] = {
    ("accident", None): frozenset({"scene_overview", "damage_detail"}),
    ("maintenance", "periodic"): frozenset({"mileage_photo"}),
    ("maintenance", "tire"): frozenset({"tire_photo"}),
    ("maintenance", "glass_film"): frozenset(),
    ("maintenance", "battery"): frozenset(),
    ("maintenance", "brake"): frozenset(),
    ("maintenance", "climate"): frozenset(),
    ("maintenance", "coating"): frozenset(),
    ("maintenance", "detail_wash"): frozenset(),
    ("maintenance", "headlight_polish"): frozenset(),
    ("maintenance", "engine_wash"): frozenset(),
    ("maintenance", "package_summer"): frozenset(),
    ("maintenance", "package_winter"): frozenset(),
    ("maintenance", "package_new_car"): frozenset(),
    ("maintenance", "package_sale_prep"): frozenset(),
    ("breakdown", "engine"): frozenset(),
    ("breakdown", "electric"): frozenset(),
    ("breakdown", "mechanic"): frozenset(),
    ("breakdown", "climate"): frozenset(),
    ("breakdown", "transmission"): frozenset(),
    ("breakdown", "tire"): frozenset(),
    ("breakdown", "fluid"): frozenset(),
    ("breakdown", "other"): frozenset(),
    ("towing", None): frozenset(),
}


# ─── Workflow blueprint resolver (§8) ──────────────────────────────────────


def resolve_blueprint(draft: ServiceRequestDraftCreate) -> CaseWorkflowBlueprint:
    """Kind-specific workflow blueprint resolver.

    P0-4 fix (audit 2026-04-23): breakdown + towing kendi blueprint
    enum'larına sahip — fallback `MAINTENANCE_STANDARD` kaldırıldı.
    """
    if draft.kind == ServiceRequestKind.ACCIDENT:
        return (
            CaseWorkflowBlueprint.DAMAGE_INSURED
            if (draft.kasko_selected or draft.sigorta_selected)
            else CaseWorkflowBlueprint.DAMAGE_UNINSURED
        )
    if draft.kind == ServiceRequestKind.MAINTENANCE:
        major = {
            MaintenanceCategory.PERIODIC,
            MaintenanceCategory.COATING,
            MaintenanceCategory.PACKAGE_SUMMER,
            MaintenanceCategory.PACKAGE_WINTER,
            MaintenanceCategory.PACKAGE_NEW_CAR,
            MaintenanceCategory.PACKAGE_SALE_PREP,
        }
        if draft.maintenance_category in major:
            return CaseWorkflowBlueprint.MAINTENANCE_MAJOR
        return CaseWorkflowBlueprint.MAINTENANCE_STANDARD
    if draft.kind == ServiceRequestKind.BREAKDOWN:
        return CaseWorkflowBlueprint.BREAKDOWN_STANDARD
    if draft.kind == ServiceRequestKind.TOWING:
        # Tow kendi tow_stage makinesi kullanır; blueprint scheduled_at
        # bayrağına göre ayrılır (tow.py route ek olarak tow_mode set eder)
        return (
            CaseWorkflowBlueprint.TOWING_SCHEDULED
            if draft.pickup_preference is not None  # scheduled = planlı
            else CaseWorkflowBlueprint.TOWING_IMMEDIATE
        )
    # Unreachable — tüm kind değerleri yukarıda kapsandı
    return CaseWorkflowBlueprint.MAINTENANCE_STANDARD


def _required_attachment_categories(
    draft: ServiceRequestDraftCreate,
) -> frozenset[str]:
    sub: str | None = None
    if draft.kind == ServiceRequestKind.MAINTENANCE:
        sub = draft.maintenance_category.value if draft.maintenance_category else None
    elif draft.kind == ServiceRequestKind.BREAKDOWN:
        sub = draft.breakdown_category.value if draft.breakdown_category else None
    key = (draft.kind.value, sub)
    return REQUIRED_ATTACHMENT_MATRIX.get(key, frozenset())


# ─── Main entry point ──────────────────────────────────────────────────────


@dataclass(slots=True)
class CaseCreateResult:
    case: ServiceCase
    blueprint: CaseWorkflowBlueprint


async def create_case(
    session: AsyncSession,
    *,
    user_id: UUID,
    draft: ServiceRequestDraftCreate,
) -> CaseCreateResult:
    """6-aşamalı submit flow. Domain exception raise eder; caller map eder."""
    try:
        # 1. Vehicle ownership
        await _assert_vehicle_owned(session, draft.vehicle_id, user_id)

        # 2. Maintenance detail parse
        if draft.kind == ServiceRequestKind.MAINTENANCE:
            try:
                validate_maintenance_detail(
                    draft.maintenance_category, draft.maintenance_detail
                )
            except MaintenanceDetailValidationError as exc:
                raise MaintenanceDetailError(str(exc)) from exc

        # 3. Attachments — ownership + completion + uniqueness
        asset_ids = [a.asset_id for a in draft.attachments if a.asset_id]
        if asset_ids:
            await _assert_attachments_valid(session, asset_ids, user_id)

        # 4. Required attachment matrix
        required_categories = _required_attachment_categories(draft)
        if required_categories:
            present = {
                a.category
                for a in draft.attachments
                if a.category is not None
            }
            missing = required_categories - present
            if missing:
                raise MissingRequiredAttachmentsError(missing)

        # 5. Duplicate open case (accident/breakdown/towing için)
        if draft.kind in (
            ServiceRequestKind.ACCIDENT,
            ServiceRequestKind.BREAKDOWN,
            ServiceRequestKind.TOWING,
        ):
            existing_id = await _find_open_case_for_vehicle_and_kind(
                session, draft.vehicle_id, draft.kind
            )
            if existing_id is not None:
                raise DuplicateOpenCaseError(existing_id, draft.kind.value)

        # 6. Insert + blueprint + audit + media link
        blueprint = resolve_blueprint(draft)
        case = ServiceCase(
            vehicle_id=draft.vehicle_id,
            customer_user_id=user_id,
            kind=draft.kind,
            urgency=draft.urgency,
            status=ServiceCaseStatus.MATCHING,
            origin=CaseOrigin.CUSTOMER,
            title=_build_title(draft),
            summary=draft.summary,
            location_label=draft.location_label,
            workflow_blueprint=blueprint.value,
            request_draft=draft.model_dump(mode="json"),
            preferred_technician_id=draft.preferred_technician_id,
        )
        # Towing için case.py'daki tow_* kolonlar
        if draft.kind == ServiceRequestKind.TOWING and draft.location_lat_lng:
            case.pickup_lat = draft.location_lat_lng.lat
            case.pickup_lng = draft.location_lat_lng.lng
            case.pickup_address = draft.location_label
            if draft.dropoff_lat_lng:
                case.dropoff_lat = draft.dropoff_lat_lng.lat
                case.dropoff_lng = draft.dropoff_lat_lng.lng
                case.dropoff_address = draft.dropoff_label

        session.add(case)
        await session.flush()

        # Faz 1c — subtype row insert (canonical case architecture)
        # Vehicle snapshot populate (immutable) + kind-specific payload
        await _insert_subtype_row(session, case, draft)

        if asset_ids:
            await session.execute(
                update(MediaAsset)
                .where(MediaAsset.id.in_(asset_ids))
                .values(linked_case_id=case.id)
            )

        await append_event(
            session,
            case_id=case.id,
            event_type=CaseEventType.SUBMITTED,
            title="Talep alındı",
            body=draft.summary,
            tone=CaseTone.INFO,
            actor_user_id=user_id,
            context={
                "kind": draft.kind.value,
                "urgency": draft.urgency.value,
                "blueprint": blueprint.value,
                "attachments_count": len(draft.attachments),
            },
        )
        case_create_total.labels(
            kind=draft.kind.value, status="success"
        ).inc()
        return CaseCreateResult(case=case, blueprint=blueprint)

    except CaseCreateError as exc:
        case_create_validation_fail_total.labels(
            kind=draft.kind.value, reason=exc.error_type
        ).inc()
        raise


# ─── Subtype dispatch (Faz 1c canonical case architecture) ───────────────


async def _build_vehicle_snapshot(
    session: AsyncSession, vehicle_id: UUID
) -> dict[str, object]:
    """Immutable vehicle snapshot — case create anında populate.

    Pilot V1: 7 alan (plate, make, model, year, fuel_type, vin, current_km).
    V1.1 matching v2 alanları Vehicle master'a eklenince genişletilecek.
    """
    vehicle = await session.get(Vehicle, vehicle_id)
    if vehicle is None:
        return {
            "snapshot_plate": "UNKNOWN",
            "snapshot_make": None,
            "snapshot_model": None,
            "snapshot_year": None,
            "snapshot_fuel_type": None,
            "snapshot_vin": None,
            "snapshot_current_km": None,
        }
    return {
        "snapshot_plate": vehicle.plate,
        "snapshot_make": vehicle.make,
        "snapshot_model": vehicle.model,
        "snapshot_year": vehicle.year,
        "snapshot_fuel_type": (
            vehicle.fuel_type.value if vehicle.fuel_type else None
        ),
        "snapshot_vin": vehicle.vin,
        "snapshot_current_km": vehicle.current_km,
    }


async def _insert_subtype_row(
    session: AsyncSession,
    case: ServiceCase,
    draft: ServiceRequestDraftCreate,
) -> None:
    """Kind'a göre subtype tablosuna row insert. Vehicle snapshot ortak.

    Invariant: bir ServiceCase için bir subtype row (FK UNIQUE zaten PK).
    """
    snapshot = await _build_vehicle_snapshot(session, case.vehicle_id)
    if draft.kind == ServiceRequestKind.TOWING:
        tow = TowCase(
            case_id=case.id,
            tow_mode=TowMode.IMMEDIATE,  # Default; tow.py route override
            tow_stage=TowDispatchStage.SEARCHING,  # Default initial
            pickup_lat=(
                draft.location_lat_lng.lat if draft.location_lat_lng else None
            ),
            pickup_lng=(
                draft.location_lat_lng.lng if draft.location_lat_lng else None
            ),
            pickup_address=draft.location_label,
            dropoff_lat=(
                draft.dropoff_lat_lng.lat if draft.dropoff_lat_lng else None
            ),
            dropoff_lng=(
                draft.dropoff_lat_lng.lng if draft.dropoff_lat_lng else None
            ),
            dropoff_address=draft.dropoff_label,
            **snapshot,
        )
        session.add(tow)
    elif draft.kind == ServiceRequestKind.ACCIDENT:
        accident = AccidentCase(
            case_id=case.id,
            damage_area=draft.damage_area,
            damage_severity=(
                draft.damage_severity.value if draft.damage_severity else None
            ),
            counterparty_count=int(draft.counterparty_vehicle_count or 0),
            counterparty_note=draft.counterparty_note,
            kasko_selected=draft.kasko_selected,
            sigorta_selected=draft.sigorta_selected,
            kasko_brand=draft.kasko_brand,
            sigorta_brand=draft.sigorta_brand,
            ambulance_contacted=draft.ambulance_contacted,
            report_method=(
                draft.report_method.value if draft.report_method else None
            ),
            emergency_acknowledged=draft.emergency_acknowledged,
            **snapshot,
        )
        session.add(accident)
    elif draft.kind == ServiceRequestKind.BREAKDOWN:
        breakdown = BreakdownCase(
            case_id=case.id,
            breakdown_category=(
                draft.breakdown_category.value
                if draft.breakdown_category
                else "other"
            ),
            symptoms=(
                ", ".join(draft.symptoms) if draft.symptoms else None
            ),
            vehicle_drivable=draft.vehicle_drivable,
            on_site_repair_requested=draft.on_site_repair,
            valet_requested=draft.valet_requested,
            pickup_preference=(
                draft.pickup_preference.value
                if draft.pickup_preference
                else None
            ),
            price_preference=(
                draft.price_preference.value
                if draft.price_preference
                else None
            ),
            **snapshot,
        )
        session.add(breakdown)
    elif draft.kind == ServiceRequestKind.MAINTENANCE:
        maintenance = MaintenanceCase(
            case_id=case.id,
            maintenance_category=(
                draft.maintenance_category.value
                if draft.maintenance_category
                else "general"
            ),
            maintenance_detail=draft.maintenance_detail,
            maintenance_tier=draft.maintenance_tier,
            mileage_km=draft.mileage_km,
            valet_requested=draft.valet_requested,
            pickup_preference=(
                draft.pickup_preference.value
                if draft.pickup_preference
                else None
            ),
            price_preference=(
                draft.price_preference.value
                if draft.price_preference
                else None
            ),
            **snapshot,
        )
        session.add(maintenance)
    await session.flush()


# ─── Internal helpers ──────────────────────────────────────────────────────


async def _assert_vehicle_owned(
    session: AsyncSession, vehicle_id: UUID, user_id: UUID
) -> None:
    """Vehicle kullanıcının aktif link'i üzerinden (UserVehicleLink)."""
    stmt = (
        select(Vehicle.id)
        .join(UserVehicleLink, UserVehicleLink.vehicle_id == Vehicle.id)
        .where(
            and_(
                Vehicle.id == vehicle_id,
                Vehicle.deleted_at.is_(None),
                UserVehicleLink.user_id == user_id,
                UserVehicleLink.ownership_to.is_(None),
            )
        )
        .limit(1)
    )
    found = (await session.execute(stmt)).scalar_one_or_none()
    if found is None:
        raise VehicleNotOwnedError(f"Vehicle {vehicle_id} kullanıcıya ait değil")


async def _assert_attachments_valid(
    session: AsyncSession,
    asset_ids: list[UUID],
    user_id: UUID,
) -> None:
    """Asset ownership + status='ready'|'uploaded' + linked_case_id IS NULL."""
    stmt = select(MediaAsset).where(MediaAsset.id.in_(asset_ids))
    assets = list((await session.execute(stmt)).scalars().all())
    found_ids = {a.id for a in assets}
    missing = set(asset_ids) - found_ids
    if missing:
        raise AssetNotOwnedError(f"Asset bulunamadı: {sorted(missing)}")
    for asset in assets:
        if asset.uploaded_by_user_id != user_id:
            raise AssetNotOwnedError(f"Asset {asset.id} kullanıcıya ait değil")
        if asset.status not in (MediaStatus.READY, MediaStatus.UPLOADED):
            raise AssetNotCompleteError(
                f"Asset {asset.id} henüz tamamlanmadı (status={asset.status.value})"
            )
        if asset.linked_case_id is not None:
            raise AssetAlreadyLinkedError(
                f"Asset {asset.id} başka vakaya bağlı (case={asset.linked_case_id})"
            )


async def _find_open_case_for_vehicle_and_kind(
    session: AsyncSession,
    vehicle_id: UUID,
    kind: ServiceRequestKind,
) -> UUID | None:
    stmt = (
        select(ServiceCase.id)
        .where(
            and_(
                ServiceCase.vehicle_id == vehicle_id,
                ServiceCase.kind == kind,
                ServiceCase.status.in_(_OPEN_STATUSES),
                ServiceCase.deleted_at.is_(None),
            )
        )
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


def _build_title(draft: ServiceRequestDraftCreate) -> str:
    kind_labels = {
        ServiceRequestKind.ACCIDENT: "Kaza",
        ServiceRequestKind.BREAKDOWN: "Arıza",
        ServiceRequestKind.MAINTENANCE: "Bakım",
        ServiceRequestKind.TOWING: "Çekici",
    }
    prefix = kind_labels[draft.kind]
    # İlk 100 karakter summary
    snippet = draft.summary[:100]
    return f"{prefix} — {snippet}"


def _datetime_now() -> datetime:
    return datetime.now(UTC)
