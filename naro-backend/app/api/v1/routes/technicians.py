"""/technicians/me/* router — profile + business + availability + capabilities + shell config.

PR 4 Gün 2 kapsamı:
- GET    /technicians/me/profile          (aggregate: profile + capability)
- GET    /technicians/me/certificates     (kendi cert listesi)
- GET    /technicians/me/shell-config     (cache-aware ShellConfig; X-Role-Config-Version header)
- PATCH  /technicians/me/profile          (name/tagline/bio/avatar/promo)
- PATCH  /technicians/me/business         (business_info JSONB — legal_name/phone/email vb.)
- PATCH  /technicians/me/availability     (admission_gate_passed şartıyla 'available')
- PATCH  /technicians/me/capabilities     (4-flag TechnicianCapability)

Gün 3: PUT /me/coverage|service-area|schedule, PATCH /me/provider-mode,
POST /me/switch-active-role, POST /me/certificates + resubmit.

Her mutation → `bump_role_config_version` + AuthEvent emit. `availability=available`
set edilirken admission gate zorunlu (I-PR4-8).
"""

from __future__ import annotations

from datetime import datetime, time
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from app.api.v1.deps import CurrentTechnicianDep, DbDep, RedisDep
from app.models.auth_event import AuthEvent, AuthEventType
from app.models.case import TowEquipment
from app.models.technician import (
    ProviderMode,
    ProviderType,
    TechnicianAvailability,
    TechnicianCapability,
    TechnicianCertificate,
    TechnicianCertificateKind,
    TechnicianCertificateStatus,
    TechnicianProfile,
    TechnicianVerifiedLevel,
)
from app.repositories import technician as technician_repo
from app.schemas.shell_config import ShellConfig
from app.services import technician_mutations, technician_shell
from app.services.technician_admission import (
    AdmissionGateError,
    assert_admission_for_available,
    bump_role_config_version,
    recompute_admission,
)

router = APIRouter(prefix="/technicians/me", tags=["technicians-me"])


# ─── Response / payload schemas ─────────────────────────────────────────────


class TechnicianCapabilityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    insurance_case_handler: bool
    on_site_repair: bool
    valet_service: bool
    towing_coordination: bool


class TechnicianProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    display_name: str
    tagline: str | None
    biography: str | None
    availability: TechnicianAvailability
    verified_level: TechnicianVerifiedLevel
    provider_type: ProviderType
    secondary_provider_types: list[ProviderType]
    provider_mode: str
    active_provider_type: ProviderType | None
    role_config_version: int
    business_info: dict[str, object]
    avatar_asset_id: UUID | None
    promo_video_asset_id: UUID | None
    capability: TechnicianCapabilityResponse | None


class TechnicianCertificateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    profile_id: UUID
    kind: TechnicianCertificateKind
    title: str
    status: TechnicianCertificateStatus
    media_asset_id: UUID | None
    uploaded_at: object
    verified_at: object | None
    expires_at: object | None
    reviewer_note: str | None


class ProfilePatchPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: Annotated[str, Field(min_length=1, max_length=255)] | None = None
    tagline: Annotated[str, Field(max_length=255)] | None = None
    biography: Annotated[str, Field(max_length=2000)] | None = None
    avatar_asset_id: UUID | None = None
    promo_video_asset_id: UUID | None = None


class BusinessPatchPayload(BaseModel):
    """PR 4 brief §2 — business_info JSONB alanına yazılır."""

    model_config = ConfigDict(extra="forbid")

    legal_name: Annotated[str, Field(min_length=1, max_length=255)] | None = None
    tax_number: Annotated[str, Field(min_length=10, max_length=32)] | None = None
    iban: Annotated[str, Field(min_length=15, max_length=34)] | None = None
    phone: Annotated[str, Field(min_length=7, max_length=32)] | None = None
    email: Annotated[str, Field(min_length=3, max_length=255)] | None = None
    address: Annotated[str, Field(max_length=500)] | None = None
    city_code: Annotated[str, Field(max_length=8)] | None = None
    district_label: Annotated[str, Field(max_length=80)] | None = None


class AvailabilityPatchPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    availability: TechnicianAvailability


class CapabilitiesPatchPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    insurance_case_handler: bool | None = None
    on_site_repair: bool | None = None
    valet_service: bool | None = None
    towing_coordination: bool | None = None


# ─── Helpers ────────────────────────────────────────────────────────────────


async def _get_profile_for_user(
    db: DbDep, user_id: UUID
) -> TechnicianProfile:
    stmt = select(TechnicianProfile).where(TechnicianProfile.user_id == user_id)
    profile = (await db.execute(stmt)).scalar_one_or_none()
    if profile is None:
        raise HTTPException(
            status_code=404, detail={"type": "technician_profile_missing"}
        )
    return profile


async def _get_capability(
    db: DbDep, profile_id: UUID
) -> TechnicianCapability | None:
    stmt = select(TechnicianCapability).where(
        TechnicianCapability.profile_id == profile_id
    )
    result: TechnicianCapability | None = (
        await db.execute(stmt)
    ).scalar_one_or_none()
    return result


async def _emit_auth_event(
    db: DbDep,
    user_id: UUID,
    event_type: AuthEventType,
    context: dict[str, object],
) -> None:
    event = AuthEvent(
        user_id=user_id,
        event_type=event_type,
        actor="user",
        context=context,
    )
    db.add(event)


# ─── Read endpoints ─────────────────────────────────────────────────────────


@router.get("/profile", response_model=TechnicianProfileResponse)
async def get_me_profile(
    user: CurrentTechnicianDep,
    db: DbDep,
) -> TechnicianProfileResponse:
    profile = await _get_profile_for_user(db, user.id)
    capability = await _get_capability(db, profile.id)
    return TechnicianProfileResponse.model_validate(
        {
            **profile.__dict__,
            "capability": TechnicianCapabilityResponse.model_validate(capability)
            if capability
            else None,
        }
    )


@router.get("/certificates", response_model=list[TechnicianCertificateResponse])
async def get_me_certificates(
    user: CurrentTechnicianDep,
    db: DbDep,
) -> list[TechnicianCertificateResponse]:
    profile = await _get_profile_for_user(db, user.id)
    stmt = (
        select(TechnicianCertificate)
        .where(TechnicianCertificate.profile_id == profile.id)
        .order_by(TechnicianCertificate.uploaded_at.desc())
    )
    certs = list((await db.execute(stmt)).scalars().all())
    return [TechnicianCertificateResponse.model_validate(c) for c in certs]


@router.get("/shell-config", response_model=ShellConfig)
async def get_me_shell_config(
    user: CurrentTechnicianDep,
    db: DbDep,
    redis: RedisDep,
    response: Response,
) -> ShellConfig:
    profile = await _get_profile_for_user(db, user.id)
    # admission_status enum type drift — UserApprovalStatus vs UserStatus.
    # Shell Pydantic `admission_status: UserStatus` bekliyor; `user.status`
    # canonical (PENDING/ACTIVE/SUSPENDED). `user.approval_status` technician-
    # specific detay PR 9 admin kanalında kullanılır.
    config = await technician_shell.load_shell_config(
        db,
        redis,
        profile=profile,
        admission_status=user.status,
    )
    response.headers["X-Role-Config-Version"] = str(config.role_config_version)
    return config


# ─── Simple mutations ──────────────────────────────────────────────────────


@router.patch("/profile", response_model=TechnicianProfileResponse)
async def patch_me_profile(
    payload: ProfilePatchPayload,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> TechnicianProfileResponse:
    profile = await _get_profile_for_user(db, user.id)
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(profile, key, value)
    await bump_role_config_version(db, profile.id)
    await _emit_auth_event(
        db,
        user.id,
        AuthEventType.TECHNICIAN_PROFILE_UPDATED,
        {"fields": sorted(updates.keys())},
    )
    await db.commit()
    capability = await _get_capability(db, profile.id)
    return TechnicianProfileResponse.model_validate(
        {
            **profile.__dict__,
            "capability": TechnicianCapabilityResponse.model_validate(capability)
            if capability
            else None,
        }
    )


@router.patch("/business", response_model=TechnicianProfileResponse)
async def patch_me_business(
    payload: BusinessPatchPayload,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> TechnicianProfileResponse:
    profile = await _get_profile_for_user(db, user.id)
    updates = payload.model_dump(exclude_unset=True)
    business_info = dict(profile.business_info or {})
    business_info.update(updates)
    profile.business_info = business_info

    # Business info change → admission recompute (legal_name + phone etkiler)
    admission = await recompute_admission(db, profile.id)
    if not admission.passed and profile.availability == TechnicianAvailability.AVAILABLE:
        profile.availability = TechnicianAvailability.OFFLINE

    await bump_role_config_version(db, profile.id)
    await _emit_auth_event(
        db,
        user.id,
        AuthEventType.TECHNICIAN_PROFILE_UPDATED,
        {
            "fields": sorted(updates.keys()),
            "scope": "business",
            "admission_passed": admission.passed,
        },
    )
    await _emit_auth_event(
        db,
        user.id,
        AuthEventType.TECHNICIAN_ADMISSION_RECOMPUTED,
        {
            "passed": admission.passed,
            "reasons": list(admission.reasons),
        },
    )
    await db.commit()
    capability = await _get_capability(db, profile.id)
    return TechnicianProfileResponse.model_validate(
        {
            **profile.__dict__,
            "capability": TechnicianCapabilityResponse.model_validate(capability)
            if capability
            else None,
        }
    )


@router.patch("/availability", response_model=TechnicianProfileResponse)
async def patch_me_availability(
    payload: AvailabilityPatchPayload,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> TechnicianProfileResponse:
    profile = await _get_profile_for_user(db, user.id)

    # I-PR4-8: availability='available' set için admission gate zorunlu
    if payload.availability == TechnicianAvailability.AVAILABLE:
        try:
            await assert_admission_for_available(db, profile.id)
        except AdmissionGateError as exc:
            raise HTTPException(
                status_code=409,
                detail={
                    "type": "admission_gate_unmet",
                    "reasons": list(exc.result.reasons),
                    "missing_certs": sorted(c.value for c in exc.result.missing),
                },
            ) from exc

    profile.availability = payload.availability
    # availability cache'lenmiyor (brief §5.2) → bump yok
    await _emit_auth_event(
        db,
        user.id,
        AuthEventType.TECHNICIAN_PROFILE_UPDATED,
        {"fields": ["availability"], "value": payload.availability.value},
    )
    await db.commit()
    capability = await _get_capability(db, profile.id)
    return TechnicianProfileResponse.model_validate(
        {
            **profile.__dict__,
            "capability": TechnicianCapabilityResponse.model_validate(capability)
            if capability
            else None,
        }
    )


# ─── Gün 3 payloads ────────────────────────────────────────────────────────


class ProcedureBindingPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    procedure_key: Annotated[str, Field(min_length=1, max_length=60)]
    confidence_self_declared: Decimal = Decimal("1.00")


class BrandBindingPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    brand_key: Annotated[str, Field(min_length=1, max_length=40)]
    is_authorized: bool = False
    is_premium_authorized: bool = False
    notes: Annotated[str, Field(max_length=500)] | None = None


class CoveragePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    service_domains: list[str] = Field(default_factory=list)
    procedures: list[ProcedureBindingPayload] = Field(default_factory=list)
    procedure_tags: list[Annotated[str, Field(min_length=1, max_length=120)]] = Field(
        default_factory=list
    )
    brand_coverage: list[BrandBindingPayload] = Field(default_factory=list)
    drivetrain_coverage: list[str] = Field(default_factory=list)


class ServiceAreaPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    workshop_lat: Annotated[Decimal, Field(ge=Decimal("-90"), le=Decimal("90"))]
    workshop_lng: Annotated[Decimal, Field(ge=Decimal("-180"), le=Decimal("180"))]
    service_radius_km: Annotated[int, Field(ge=1, le=500)] = 15
    city_code: Annotated[str, Field(min_length=1, max_length=8)]
    primary_district_id: UUID | None = None
    working_districts: list[UUID] = Field(default_factory=list)
    mobile_unit_count: Annotated[int, Field(ge=0, le=500)] = 0
    workshop_address: Annotated[str, Field(max_length=500)] | None = None


class ScheduleSlotPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    weekday: Annotated[int, Field(ge=0, le=6)]
    open_time: time | None = None
    close_time: time | None = None
    is_closed: bool = False
    slot_order: Annotated[int, Field(ge=0, le=10)] = 0


class SchedulePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slots: list[ScheduleSlotPayload] = Field(default_factory=list)


class CapacityPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    staff_count: Annotated[int, Field(ge=1, le=50)] = 1
    max_concurrent_jobs: Annotated[int, Field(ge=1, le=100)] = 3
    night_service: bool = False
    weekend_service: bool = False
    emergency_service: bool = False


class ProviderModePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: ProviderMode


class SwitchActiveRolePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target_provider_type: ProviderType


class CertSubmitPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: TechnicianCertificateKind
    title: Annotated[str, Field(min_length=1, max_length=255)]
    media_asset_id: UUID | None = None
    expires_at: datetime | None = None


class CertResubmitPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    media_asset_id: UUID
    title: Annotated[str, Field(min_length=1, max_length=255)] | None = None


class CoverageSnapshotResponse(BaseModel):
    service_domains: list[str]
    procedures: list[str]
    procedure_tags: list[str]
    brand_coverage: list[str]
    drivetrain_coverage: list[str]


class ProviderModeTransitionResponse(BaseModel):
    mode: ProviderMode
    admission_passed: bool
    approval_status_changed: bool
    availability_forced_offline: bool
    role_config_version: int


# ─── Gün 3 mutation endpoint'leri ──────────────────────────────────────────


@router.put(
    "/coverage",
    response_model=CoverageSnapshotResponse,
    summary="Coverage atomic replace (I-PR4-7)",
)
async def put_me_coverage(
    payload: CoveragePayload,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> CoverageSnapshotResponse:
    profile = await _get_profile_for_user(db, user.id)
    await technician_mutations.replace_coverage(
        db,
        profile_id=profile.id,
        payload=technician_mutations.CoverageInput(
            service_domains=payload.service_domains,
            procedures=[
                technician_mutations.ProcedureBinding(
                    procedure_key=p.procedure_key,
                    confidence_self_declared=p.confidence_self_declared,
                )
                for p in payload.procedures
            ],
            procedure_tags=payload.procedure_tags,
            brand_coverage=[
                technician_mutations.BrandBinding(
                    brand_key=b.brand_key,
                    is_authorized=b.is_authorized,
                    is_premium_authorized=b.is_premium_authorized,
                    notes=b.notes,
                )
                for b in payload.brand_coverage
            ],
            drivetrain_coverage=payload.drivetrain_coverage,
        ),
    )
    await _emit_auth_event(
        db,
        user.id,
        AuthEventType.TECHNICIAN_COVERAGE_REPLACED,
        {
            "domains": len(payload.service_domains),
            "procedures": len(payload.procedures),
            "brands": len(payload.brand_coverage),
        },
    )
    await db.commit()
    snapshot = await technician_mutations.load_coverage_snapshot(db, profile.id)
    return CoverageSnapshotResponse.model_validate(snapshot)


@router.put("/service-area", status_code=status.HTTP_204_NO_CONTENT)
async def put_me_service_area(
    payload: ServiceAreaPayload,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> Response:
    profile = await _get_profile_for_user(db, user.id)
    await technician_mutations.upsert_service_area(
        db,
        profile_id=profile.id,
        payload=technician_mutations.ServiceAreaInput(
            workshop_lat=payload.workshop_lat,
            workshop_lng=payload.workshop_lng,
            service_radius_km=payload.service_radius_km,
            city_code=payload.city_code,
            primary_district_id=payload.primary_district_id,
            working_districts=payload.working_districts,
            mobile_unit_count=payload.mobile_unit_count,
            workshop_address=payload.workshop_address,
        ),
    )
    await _emit_auth_event(
        db,
        user.id,
        AuthEventType.TECHNICIAN_PROFILE_UPDATED,
        {"scope": "service_area", "city": payload.city_code},
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/schedule", status_code=status.HTTP_204_NO_CONTENT)
async def put_me_schedule(
    payload: SchedulePayload,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> Response:
    profile = await _get_profile_for_user(db, user.id)
    await technician_mutations.replace_schedule(
        db,
        profile_id=profile.id,
        slots=[
            technician_mutations.ScheduleSlotInput(
                weekday=s.weekday,
                open_time=s.open_time,
                close_time=s.close_time,
                is_closed=s.is_closed,
                slot_order=s.slot_order,
            )
            for s in payload.slots
        ],
    )
    await _emit_auth_event(
        db,
        user.id,
        AuthEventType.TECHNICIAN_PROFILE_UPDATED,
        {"scope": "schedule", "slot_count": len(payload.slots)},
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/capacity", status_code=status.HTTP_204_NO_CONTENT)
async def patch_me_capacity(
    payload: CapacityPayload,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> Response:
    profile = await _get_profile_for_user(db, user.id)
    await technician_mutations.upsert_capacity(
        db,
        profile_id=profile.id,
        payload=technician_mutations.CapacityInput(
            staff_count=payload.staff_count,
            max_concurrent_jobs=payload.max_concurrent_jobs,
            night_service=payload.night_service,
            weekend_service=payload.weekend_service,
            emergency_service=payload.emergency_service,
        ),
    )
    await _emit_auth_event(
        db,
        user.id,
        AuthEventType.TECHNICIAN_PROFILE_UPDATED,
        {"scope": "capacity"},
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/provider-mode",
    response_model=ProviderModeTransitionResponse,
    summary="provider_mode transition — büyük cascade",
)
async def patch_me_provider_mode(
    payload: ProviderModePayload,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> ProviderModeTransitionResponse:
    profile = await _get_profile_for_user(db, user.id)
    try:
        result = await technician_mutations.switch_provider_mode(
            db, profile_id=profile.id, new_mode=payload.mode
        )
    except technician_mutations.InvalidProviderModeError as exc:
        raise HTTPException(
            status_code=422,
            detail={"type": "invalid_provider_mode", "message": str(exc)},
        ) from exc
    await _emit_auth_event(
        db,
        user.id,
        AuthEventType.TECHNICIAN_PROVIDER_MODE_SWITCHED,
        {
            "old_mode": result.old_mode.value,
            "new_mode": result.new_mode.value,
            "admission_passed": result.admission_passed,
            "approval_status_changed": result.approval_status_changed,
            "availability_forced_offline": result.availability_forced_offline,
        },
    )
    await db.commit()
    # Refresh profile to get new version
    await db.refresh(profile)
    return ProviderModeTransitionResponse(
        mode=result.new_mode,
        admission_passed=result.admission_passed,
        approval_status_changed=result.approval_status_changed,
        availability_forced_offline=result.availability_forced_offline,
        role_config_version=int(profile.role_config_version),
    )


@router.post(
    "/switch-active-role",
    response_model=TechnicianProfileResponse,
    summary="Multi-role kişi: active_provider_type değiştir",
)
async def post_me_switch_active_role(
    payload: SwitchActiveRolePayload,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> TechnicianProfileResponse:
    profile = await _get_profile_for_user(db, user.id)
    try:
        await technician_mutations.switch_active_role(
            db,
            profile_id=profile.id,
            target_provider_type=payload.target_provider_type,
        )
    except technician_mutations.InvalidActiveRoleError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "type": "invalid_active_role",
                "message": str(exc),
                "target": payload.target_provider_type.value,
            },
        ) from exc
    await _emit_auth_event(
        db,
        user.id,
        AuthEventType.TECHNICIAN_ACTIVE_ROLE_SWITCHED,
        {"target": payload.target_provider_type.value},
    )
    await db.commit()
    await db.refresh(profile)
    capability = await _get_capability(db, profile.id)
    return TechnicianProfileResponse.model_validate(
        {
            **profile.__dict__,
            "capability": TechnicianCapabilityResponse.model_validate(capability)
            if capability
            else None,
        }
    )


@router.post(
    "/certificates",
    response_model=TechnicianCertificateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yeni sertifika yükle",
)
async def post_me_certificate(
    payload: CertSubmitPayload,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> TechnicianCertificateResponse:
    profile = await _get_profile_for_user(db, user.id)
    cert = await technician_mutations.submit_certificate(
        db,
        profile_id=profile.id,
        kind=payload.kind,
        title=payload.title,
        media_asset_id=payload.media_asset_id,
        expires_at=payload.expires_at,
    )
    await _emit_auth_event(
        db,
        user.id,
        AuthEventType.TECHNICIAN_CERT_SUBMITTED,
        {"cert_id": str(cert.id), "kind": payload.kind.value},
    )
    await db.commit()
    return TechnicianCertificateResponse.model_validate(cert)


@router.patch(
    "/certificates/{cert_id}",
    response_model=TechnicianCertificateResponse,
    summary="Rejected sertifika için resubmit",
)
async def patch_me_certificate(
    cert_id: UUID,
    payload: CertResubmitPayload,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> TechnicianCertificateResponse:
    profile = await _get_profile_for_user(db, user.id)
    cert = await db.get(TechnicianCertificate, cert_id)
    if cert is None or cert.profile_id != profile.id:
        raise HTTPException(
            status_code=404, detail={"type": "certificate_not_found"}
        )
    try:
        cert = await technician_mutations.resubmit_certificate(
            db,
            cert_id=cert_id,
            media_asset_id=payload.media_asset_id,
            title=payload.title,
        )
    except technician_mutations.CertResubmitInvalidError as exc:
        raise HTTPException(
            status_code=409,
            detail={"type": "cert_resubmit_invalid", "message": str(exc)},
        ) from exc
    await _emit_auth_event(
        db,
        user.id,
        AuthEventType.TECHNICIAN_CERT_SUBMITTED,
        {"cert_id": str(cert.id), "scope": "resubmit"},
    )
    await db.commit()
    return TechnicianCertificateResponse.model_validate(cert)


# ─── Hotpath: capabilities patch (önceki Gün 2) ───────────────────────────


@router.patch("/capabilities", response_model=TechnicianCapabilityResponse)
async def patch_me_capabilities(
    payload: CapabilitiesPatchPayload,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> TechnicianCapabilityResponse:
    profile = await _get_profile_for_user(db, user.id)
    capability = await _get_capability(db, profile.id)
    if capability is None:
        capability = TechnicianCapability(profile_id=profile.id)
        db.add(capability)
        await db.flush()
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(capability, key, value)
    await bump_role_config_version(db, profile.id)
    await _emit_auth_event(
        db,
        user.id,
        AuthEventType.TECHNICIAN_PROFILE_UPDATED,
        {"fields": sorted(updates.keys()), "scope": "capabilities"},
    )
    await db.commit()
    return TechnicianCapabilityResponse.model_validate(capability)


# ─── Tow equipment (matching audit P0 — minimal CRUD) ─────────────────────


class TowEquipmentPayload(BaseModel):
    """PUT /technicians/me/tow-equipment body — atomic replace.

    Pilot V1 minimal CRUD: tek transaction'da tüm liste replace. V1.1'de
    bireysel add/remove opsiyonları.
    """

    model_config = ConfigDict(extra="forbid")
    equipment: list[TowEquipment] = Field(default_factory=list)


class TowEquipmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    equipment: list[TowEquipment]


@router.get(
    "/tow-equipment",
    response_model=TowEquipmentResponse,
    summary="Teknisyenin çekici ekipman listesi",
)
async def get_me_tow_equipment(
    user: CurrentTechnicianDep,
    db: DbDep,
) -> TowEquipmentResponse:
    profile = await _get_profile_for_user(db, user.id)
    equipment = await technician_repo.list_tow_equipment(db, profile.id)
    return TowEquipmentResponse(equipment=equipment)


@router.put(
    "/tow-equipment",
    response_model=TowEquipmentResponse,
    summary="Çekici ekipmanları atomic replace (I-PR4-7 pattern)",
)
async def put_me_tow_equipment(
    payload: TowEquipmentPayload,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> TowEquipmentResponse:
    profile = await _get_profile_for_user(db, user.id)
    # Deduplicate — aynı equipment iki kez gelirse tekile indir
    equipment = list(dict.fromkeys(payload.equipment))
    await technician_repo.replace_tow_equipment(
        db, profile_id=profile.id, equipment=equipment
    )
    await bump_role_config_version(db, profile.id)
    await _emit_auth_event(
        db,
        user.id,
        AuthEventType.TECHNICIAN_COVERAGE_REPLACED,
        {
            "scope": "tow_equipment",
            "count": len(equipment),
            "values": [e.value for e in equipment],
        },
    )
    await db.commit()
    return TowEquipmentResponse(equipment=equipment)
