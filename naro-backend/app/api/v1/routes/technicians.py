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

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from app.api.v1.deps import CurrentTechnicianDep, DbDep, RedisDep
from app.models.auth_event import AuthEvent, AuthEventType
from app.models.technician import (
    ProviderType,
    TechnicianAvailability,
    TechnicianCapability,
    TechnicianCertificate,
    TechnicianCertificateKind,
    TechnicianCertificateStatus,
    TechnicianProfile,
    TechnicianVerifiedLevel,
)
from app.models.user import UserStatus
from app.schemas.shell_config import ShellConfig
from app.services import technician_shell
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
    admission_status = (
        user.approval_status if user.approval_status else UserStatus.PENDING
    )
    # admission_status enum type drift — UserApprovalStatus vs UserStatus
    # User model'inde user.status (UserStatus enum). Shell Pydantic
    # `admission_status: UserStatus` bekliyor. `approval_status` technician-
    # specific; user.status kullanalım.
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
