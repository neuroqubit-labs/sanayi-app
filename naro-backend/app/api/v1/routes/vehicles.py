"""/vehicles router — 7 endpoint.

- POST   /vehicles                     (customer: create + owner link)
- GET    /vehicles/me                  (customer: aktif araçlar)
- GET    /vehicles/{id}                (owner or admin: detay)
- GET    /vehicles/{id}/dossier        (owner or admin: case + warranty özet)
- PATCH  /vehicles/{id}                (owner: kısmi güncelleme)
- DELETE /vehicles/{id}                (owner: soft delete + link kapat)
- POST   /vehicles/{id}/history-consent (owner: audit P1-1 grant/revoke)

Ownership guard `get_active_owner_link` üzerinden (§17.1 IDOR invariant).
Consent endpoint AuthEvent emit (§17.5). Transfer + admin cross-user V2.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.api.v1.deps import CurrentUserDep, CustomerDep, DbDep
from app.models.auth_event import AuthEvent, AuthEventType
from app.models.user import UserRole
from app.models.vehicle import Vehicle
from app.repositories import vehicle as vehicle_repo
from app.schemas.vehicle import (
    HistoryConsentRequest,
    VehicleCreate,
    VehicleDossierView,
    VehicleResponse,
    VehicleUpdate,
)

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


# ─── Helpers ───────────────────────────────────────────────────────────────


async def _load_owner_vehicle(
    db: DbDep, vehicle_id: UUID, user_id: UUID
) -> None:
    """Owner olmayan / silinmiş vehicle için 403/404 raise."""
    link = await vehicle_repo.get_active_owner_link(db, vehicle_id)
    if link is None:
        raise HTTPException(
            status_code=404, detail={"type": "vehicle_not_found"}
        )
    if link.user_id != user_id:
        raise HTTPException(
            status_code=403, detail={"type": "not_vehicle_owner"}
        )


async def _load_vehicle_for_read(
    db: DbDep, vehicle_id: UUID, user: CurrentUserDep
) -> Vehicle:
    """Customer → owner check; admin → bypass. 404 deleted_at guard."""
    vehicle = await db.get(Vehicle, vehicle_id)
    if vehicle is None or vehicle.deleted_at is not None:
        raise HTTPException(
            status_code=404, detail={"type": "vehicle_not_found"}
        )
    if user.role == UserRole.ADMIN:
        return vehicle
    link = await vehicle_repo.get_active_owner_link(db, vehicle_id)
    if link is None or link.user_id != user.id:
        raise HTTPException(
            status_code=403, detail={"type": "not_vehicle_owner"}
        )
    return vehicle


async def _emit_consent_event(
    db: DbDep,
    user_id: UUID,
    vehicle_id: UUID,
    granted: bool,
) -> None:
    event_type = (
        AuthEventType.VEHICLE_CONSENT_GRANTED
        if granted
        else AuthEventType.VEHICLE_CONSENT_REVOKED
    )
    db.add(
        AuthEvent(
            user_id=user_id,
            event_type=event_type,
            actor="user",
            context={"vehicle_id": str(vehicle_id)},
        )
    )


# ─── Endpoints ─────────────────────────────────────────────────────────────


@router.post(
    "",
    response_model=VehicleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yeni araç + owner link (customer)",
)
async def create_vehicle_endpoint(
    payload: VehicleCreate,
    user: CustomerDep,
    db: DbDep,
) -> VehicleResponse:
    try:
        vehicle = await vehicle_repo.create_vehicle(
            db,
            plate=payload.plate,
            owner_user_id=user.id,
            vehicle_kind=payload.vehicle_kind.value,
            make=payload.make,
            model=payload.model,
            year=payload.year,
            color=payload.color,
            fuel_type=payload.fuel_type.value if payload.fuel_type else None,
            transmission=(
                payload.transmission.value if payload.transmission else None
            ),
            drivetrain=(
                payload.drivetrain.value if payload.drivetrain else None
            ),
            engine_displacement=payload.engine_displacement,
            engine_power_hp=payload.engine_power_hp,
            chassis_no=payload.chassis_no,
            engine_no=payload.engine_no,
            photo_url=payload.photo_url,
            vin=payload.vin,
            current_km=payload.current_km,
            note=payload.note,
            is_primary=payload.is_primary,
        )
        # Lifecycle alanları create flow'unda opt-in patch ile
        lifecycle_fields = {
            "inspection_valid_until": payload.inspection_valid_until,
            "inspection_kind": payload.inspection_kind,
            "kasko_valid_until": payload.kasko_valid_until,
            "kasko_insurer": payload.kasko_insurer,
            "trafik_valid_until": payload.trafik_valid_until,
            "trafik_insurer": payload.trafik_insurer,
            "exhaust_valid_until": payload.exhaust_valid_until,
        }
        if any(v is not None for v in lifecycle_fields.values()):
            await vehicle_repo.update_vehicle(db, vehicle.id, **lifecycle_fields)
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=409, detail={"type": "vehicle_plate_conflict"}
        ) from exc
    await db.refresh(vehicle)
    return VehicleResponse.model_validate(vehicle)


@router.get(
    "/me",
    response_model=list[VehicleResponse],
    summary="Kendi araçlarım (aktif link'ler)",
)
async def list_my_vehicles(
    user: CustomerDep,
    db: DbDep,
) -> list[VehicleResponse]:
    vehicles = await vehicle_repo.list_vehicles_for_user(
        db, user.id, active_only=True
    )
    return [VehicleResponse.model_validate(v) for v in vehicles]


@router.get(
    "/{vehicle_id}",
    response_model=VehicleResponse,
    summary="Araç detayı (owner ya da admin)",
)
async def get_vehicle_endpoint(
    vehicle_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
) -> VehicleResponse:
    vehicle = await _load_vehicle_for_read(db, vehicle_id, user)
    return VehicleResponse.model_validate(vehicle)


@router.get(
    "/{vehicle_id}/dossier",
    response_model=VehicleDossierView,
    summary="Araç geçmiş + lifecycle özet (consent gate'li)",
)
async def get_vehicle_dossier(
    vehicle_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
) -> VehicleDossierView:
    vehicle = await _load_vehicle_for_read(db, vehicle_id, user)
    links = await vehicle_repo.list_active_links_for_vehicle(db, vehicle_id)
    primary_owner_id: UUID | None = None
    additional_user_ids: list[UUID] = []
    for lnk in links:
        if lnk.is_primary and primary_owner_id is None:
            primary_owner_id = lnk.user_id
        else:
            additional_user_ids.append(lnk.user_id)

    count, last_case = await vehicle_repo.build_dossier_aggregates(
        db, vehicle_id
    )

    # Consent gate (audit P1-1) — grant yoksa last_case detayı mask
    if vehicle.history_consent_granted and last_case is not None:
        last_case_id = last_case.id
        last_case_title = last_case.title
        last_case_updated_at = last_case.updated_at
    else:
        last_case_id = None
        last_case_title = None
        last_case_updated_at = None

    return VehicleDossierView(
        vehicle=VehicleResponse.model_validate(vehicle),
        primary_owner_id=primary_owner_id,
        additional_user_ids=additional_user_ids,
        previous_case_count=count,
        last_case_id=last_case_id,
        last_case_title=last_case_title,
        last_case_updated_at=last_case_updated_at,
    )


@router.patch(
    "/{vehicle_id}",
    response_model=VehicleResponse,
    summary="Araç kısmi güncelleme (owner)",
)
async def patch_vehicle_endpoint(
    vehicle_id: UUID,
    payload: VehicleUpdate,
    user: CustomerDep,
    db: DbDep,
) -> VehicleResponse:
    await _load_owner_vehicle(db, vehicle_id, user.id)
    fields = payload.model_dump(exclude_unset=True)
    for enum_field in (
        "fuel_type",
        "vehicle_kind",
        "transmission",
        "drivetrain",
    ):
        if enum_field in fields and fields[enum_field] is not None:
            fields[enum_field] = fields[enum_field].value
    try:
        await vehicle_repo.update_vehicle(db, vehicle_id, **fields)
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=409, detail={"type": "vehicle_plate_conflict"}
        ) from exc
    vehicle = await db.get(Vehicle, vehicle_id)
    assert vehicle is not None
    return VehicleResponse.model_validate(vehicle)


@router.delete(
    "/{vehicle_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Araç soft delete + aktif link'leri kapat (owner)",
)
async def delete_vehicle_endpoint(
    vehicle_id: UUID,
    user: CustomerDep,
    db: DbDep,
) -> None:
    await _load_owner_vehicle(db, vehicle_id, user.id)
    await vehicle_repo.soft_delete_vehicle(db, vehicle_id)
    await vehicle_repo.close_all_active_links(db, vehicle_id)
    await db.commit()


@router.post(
    "/{vehicle_id}/history-consent",
    response_model=VehicleResponse,
    summary="Araç geçmişi izin aç/kapat (audit P1-1)",
)
async def toggle_history_consent(
    vehicle_id: UUID,
    payload: HistoryConsentRequest,
    user: CustomerDep,
    db: DbDep,
) -> VehicleResponse:
    await _load_owner_vehicle(db, vehicle_id, user.id)
    if payload.granted:
        await vehicle_repo.grant_history_consent(db, vehicle_id)
    else:
        await vehicle_repo.revoke_history_consent(db, vehicle_id)
    await _emit_consent_event(db, user.id, vehicle_id, payload.granted)
    await db.commit()

    vehicle = await db.get(Vehicle, vehicle_id)
    assert vehicle is not None
    return VehicleResponse.model_validate(vehicle)
