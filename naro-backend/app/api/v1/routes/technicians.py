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

from app.api.v1.deps import CurrentTechnicianDep, CurrentUserDep, DbDep, RedisDep
from app.models.auth_event import AuthEvent, AuthEventType
from app.models.case import (
    ServiceCase,
    ServiceCaseStatus,
    ServiceRequestKind,
    ServiceRequestUrgency,
    TowEquipment,
)
from app.models.case_matching import (
    CaseTechnicianMatch,
    CaseTechnicianNotification,
    CaseTechnicianNotificationStatus,
)
from app.models.case_public_showcase import (
    CasePublicShowcase,
    CasePublicShowcaseStatus,
)
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
from app.models.technician_payment import (
    TechnicianPaymentAccountStatus,
    TechnicianPaymentLegalType,
)
from app.models.user import UserRole
from app.repositories import case as case_repo
from app.repositories import technician as technician_repo
from app.schemas.insurance_claim import (
    InsuranceClaimResponse,
    InsuranceClaimSubmit,
)
from app.schemas.shell_config import ShellConfig
from app.services import (
    case_matching,
    technician_mutations,
    technician_payment_accounts,
    technician_shell,
)
from app.services import insurance_claim_flow as claim_flow
from app.services.case_public_showcases import revoke_for_actor, snapshot_value
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


class TechnicianShowcaseManageItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    case_id: UUID
    kind: str
    status: CasePublicShowcaseStatus
    title: str
    summary: str
    month_label: str | None = None
    location_label: str | None = None
    rating: int | None = None


class TechnicianCaseSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    vehicle_id: UUID
    kind: ServiceRequestKind
    urgency: ServiceRequestUrgency
    status: ServiceCaseStatus
    title: str
    summary: str | None = None
    subtitle: str | None = None
    location_label: str | None = None
    estimate_amount: Decimal | None = None
    assigned_technician_id: UUID | None = None
    preferred_technician_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class TechnicianCaseNotificationResponse(BaseModel):
    id: UUID
    case_id: UUID
    case_title: str
    case_kind: ServiceRequestKind
    case_status: ServiceCaseStatus
    status: CaseTechnicianNotificationStatus
    match_badge: str | None = None
    match_reason_label: str | None = None
    has_offer_from_me: bool = False
    created_at: datetime
    updated_at: datetime


class ProfilePatchPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: Annotated[str, Field(min_length=1, max_length=255)] | None = None
    tagline: Annotated[str, Field(max_length=255)] | None = None
    biography: Annotated[str, Field(max_length=2000)] | None = None
    avatar_asset_id: UUID | None = None
    promo_video_asset_id: UUID | None = None


class ProfileBootstrapPayload(BaseModel):
    """POST /technicians/me/profile — yeni teknisyen kaydı için.

    OTP verify sonrası user yaratılır ama TechnicianProfile NULL kalır;
    onboarding wizard ilk adımdan sonra bu endpoint'i çağırarak profile
    satırını oluşturur. Diğer alanlar (business_info, capabilities,
    coverage, service_area) ayrı PATCH/PUT endpoint'leriyle doldurulur.
    """

    model_config = ConfigDict(extra="forbid")

    display_name: Annotated[str, Field(min_length=1, max_length=255)]
    provider_type: ProviderType
    provider_mode: ProviderMode = ProviderMode.BUSINESS
    secondary_provider_types: list[ProviderType] = Field(default_factory=list)
    active_provider_type: ProviderType | None = None


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


@router.get("/cases", response_model=list[TechnicianCaseSummary])
async def get_me_cases(
    user: CurrentTechnicianDep,
    db: DbDep,
) -> list[TechnicianCaseSummary]:
    cases = await case_repo.list_cases_for_technician(db, user.id)
    return [TechnicianCaseSummary.model_validate(case) for case in cases]


@router.get(
    "/case-notifications",
    response_model=list[TechnicianCaseNotificationResponse],
)
async def get_me_case_notifications(
    user: CurrentTechnicianDep,
    db: DbDep,
) -> list[TechnicianCaseNotificationResponse]:
    stmt = (
        select(CaseTechnicianNotification, ServiceCase, CaseTechnicianMatch)
        .join(ServiceCase, ServiceCase.id == CaseTechnicianNotification.case_id)
        .outerjoin(
            CaseTechnicianMatch,
            CaseTechnicianMatch.id == CaseTechnicianNotification.match_id,
        )
        .where(
            CaseTechnicianNotification.technician_user_id == user.id,
            ServiceCase.deleted_at.is_(None),
            CaseTechnicianNotification.status.not_in(
                (
                    CaseTechnicianNotificationStatus.DISMISSED,
                    CaseTechnicianNotificationStatus.EXPIRED,
                )
            ),
        )
        .order_by(CaseTechnicianNotification.created_at.desc())
        .limit(50)
    )
    rows = list((await db.execute(stmt)).all())
    context = await case_matching.context_for_cases(
        db,
        case_ids=[case.id for _, case, _ in rows],
        technician_user_id=user.id,
    )
    return [
        TechnicianCaseNotificationResponse(
            id=notification.id,
            case_id=case.id,
            case_title=case.title,
            case_kind=case.kind,
            case_status=case.status,
            status=notification.status,
            match_badge=str(
                context.get(case.id, {}).get("match_badge") or "Size bildirildi"
            ),
            match_reason_label=match.reason_label if match else None,
            has_offer_from_me=bool(
                context.get(case.id, {}).get("has_offer_from_me")
            ),
            created_at=notification.created_at,
            updated_at=notification.updated_at,
        )
        for notification, case, match in rows
    ]


@router.post(
    "/insurance-claims",
    response_model=InsuranceClaimResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_me_insurance_claim(
    payload: InsuranceClaimSubmit,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> InsuranceClaimResponse:
    case = await case_repo.get_case(db, payload.case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(status_code=404, detail={"type": "case_not_found"})
    if case.assigned_technician_id != user.id:
        raise HTTPException(
            status_code=403, detail={"type": "not_assigned_technician"}
        )
    if case.kind != ServiceRequestKind.ACCIDENT:
        raise HTTPException(
            status_code=422, detail={"type": "case_kind_not_accident"}
        )

    profile = await _get_profile_for_user(db, user.id)
    try:
        claim = await claim_flow.submit_claim(
            db,
            case_id=payload.case_id,
            policy_number=payload.policy_number,
            insurer=payload.insurer,
            coverage_kind=payload.coverage_kind,
            estimate_amount=payload.estimate_amount,
            policy_holder_name=payload.policy_holder_name,
            policy_holder_phone=payload.policy_holder_phone,
            currency=payload.currency,
            notes=payload.notes,
            insurer_claim_reference=payload.insurer_claim_reference,
            created_by_user_id=user.id,
            created_by_snapshot_name=profile.display_name,
        )
    except claim_flow.ClaimAlreadyActiveError as exc:
        raise HTTPException(
            status_code=409, detail={"type": "claim_already_active"}
        ) from exc
    except claim_flow.InvalidCaseKindError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "type": "invalid_case_kind",
                "expected": "accident",
                "actual": exc.actual_kind,
            },
        ) from exc
    except claim_flow.ClaimNotFoundError as exc:
        raise HTTPException(status_code=404, detail={"type": "case_not_found"}) from exc

    await db.commit()
    await db.refresh(claim)
    return InsuranceClaimResponse.model_validate(claim)


@router.get("/showcases", response_model=list[TechnicianShowcaseManageItem])
async def get_me_showcases(
    user: CurrentTechnicianDep,
    db: DbDep,
) -> list[TechnicianShowcaseManageItem]:
    profile = await _get_profile_for_user(db, user.id)
    stmt = (
        select(CasePublicShowcase)
        .where(CasePublicShowcase.technician_profile_id == profile.id)
        .order_by(
            CasePublicShowcase.created_at.desc(),
            CasePublicShowcase.id.asc(),
        )
        .limit(50)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    items: list[TechnicianShowcaseManageItem] = []
    for row in rows:
        snapshot = dict(row.public_snapshot or {})
        items.append(
            TechnicianShowcaseManageItem(
                id=row.id,
                case_id=row.case_id,
                kind=row.kind.value,
                status=row.status,
                title=str(snapshot_value(snapshot, "title") or row.kind.value),
                summary=str(snapshot_value(snapshot, "summary") or "Vaka özeti"),
                month_label=snapshot_value(snapshot, "month_label"),
                location_label=snapshot_value(snapshot, "location_label"),
                rating=snapshot_value(snapshot, "rating"),
            )
        )
    return items


@router.post(
    "/showcases/{showcase_id}/revoke",
    response_model=TechnicianShowcaseManageItem,
)
async def revoke_me_showcase(
    showcase_id: UUID,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> TechnicianShowcaseManageItem:
    profile = await _get_profile_for_user(db, user.id)
    stmt = select(CasePublicShowcase).where(
        CasePublicShowcase.id == showcase_id,
        CasePublicShowcase.technician_profile_id == profile.id,
    )
    showcase = (await db.execute(stmt)).scalar_one_or_none()
    if showcase is None:
        raise HTTPException(status_code=404, detail={"type": "showcase_not_found"})
    showcase = await revoke_for_actor(db, showcase=showcase, actor="technician")
    await db.commit()
    snapshot = dict(showcase.public_snapshot or {})
    return TechnicianShowcaseManageItem(
        id=showcase.id,
        case_id=showcase.case_id,
        kind=showcase.kind.value,
        status=showcase.status,
        title=str(snapshot_value(snapshot, "title") or showcase.kind.value),
        summary=str(snapshot_value(snapshot, "summary") or "Vaka özeti"),
        month_label=snapshot_value(snapshot, "month_label"),
        location_label=snapshot_value(snapshot, "location_label"),
        rating=snapshot_value(snapshot, "rating"),
    )


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


@router.post(
    "/profile",
    response_model=TechnicianProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_me_profile(
    payload: ProfileBootstrapPayload,
    user: CurrentUserDep,
    db: DbDep,
) -> TechnicianProfileResponse:
    """Onboarding wizard ilk submit'i — yeni teknisyenin TechnicianProfile
    satırını oluşturur. OTP verify sonrası User var ama profile NULL idi.

    Auth: CurrentUserDep (require_technician kullanılmıyor — yeni başvuruda
    approval_status NULL olacağından require_technician 403 atar). Role
    kontrolünü burada yapıyoruz: yalnız role=technician ilerleyebilir;
    customer için 403.
    """
    if user.role != UserRole.TECHNICIAN:
        raise HTTPException(
            status_code=403,
            detail={"type": "technician_role_required"},
        )

    existing = (
        await db.execute(
            select(TechnicianProfile).where(TechnicianProfile.user_id == user.id)
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail={"type": "profile_exists", "profile_id": str(existing.id)},
        )

    profile = TechnicianProfile(
        user_id=user.id,
        display_name=payload.display_name.strip(),
        availability=TechnicianAvailability.OFFLINE,
        verified_level=TechnicianVerifiedLevel.BASIC,
        provider_type=payload.provider_type,
        secondary_provider_types=list(payload.secondary_provider_types),
        provider_mode=payload.provider_mode,
        active_provider_type=payload.active_provider_type,
        business_info={},
    )
    db.add(profile)
    await db.flush()

    capability = TechnicianCapability(
        profile_id=profile.id,
        insurance_case_handler=False,
        on_site_repair=False,
        valet_service=False,
        towing_coordination=False,
    )
    db.add(capability)

    await bump_role_config_version(db, profile.id)
    await _emit_auth_event(
        db,
        user.id,
        AuthEventType.TECHNICIAN_PROFILE_UPDATED,
        {
            "scope": "bootstrap",
            "provider_type": payload.provider_type.value,
            "provider_mode": payload.provider_mode.value,
        },
    )
    await db.commit()
    await db.refresh(profile)
    return TechnicianProfileResponse.model_validate(
        {
            **profile.__dict__,
            "capability": TechnicianCapabilityResponse.model_validate(capability),
        }
    )


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


class PaymentAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID | None = None
    technician_user_id: UUID
    provider: str
    status: TechnicianPaymentAccountStatus
    legal_type: TechnicianPaymentLegalType | None = None
    legal_name: str | None = None
    tax_number_ref: str | None = None
    iban_ref: str | None = None
    authorized_person_name: str | None = None
    address_snapshot: dict[str, object] = Field(default_factory=dict)
    business_snapshot: dict[str, object] = Field(default_factory=dict)
    can_receive_online_payments: bool
    sub_merchant_key: str | None = None
    submitted_at: datetime | None = None
    reviewed_at: datetime | None = None
    reviewer_note: str | None = None


class PaymentAccountDraftPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    legal_type: TechnicianPaymentLegalType | None = None
    legal_name: Annotated[str, Field(min_length=1, max_length=255)] | None = None
    tax_number_ref: Annotated[str, Field(min_length=4, max_length=80)] | None = None
    iban_ref: Annotated[str, Field(min_length=8, max_length=80)] | None = None
    authorized_person_name: Annotated[str, Field(max_length=255)] | None = None
    address_snapshot: dict[str, object] = Field(default_factory=dict)
    business_snapshot: dict[str, object] = Field(default_factory=dict)


def _payment_account_response(
    user_id: UUID,
    account: object | None,
) -> PaymentAccountResponse:
    if account is None:
        return PaymentAccountResponse(
            technician_user_id=user_id,
            provider="mock",
            status=TechnicianPaymentAccountStatus.NOT_STARTED,
            can_receive_online_payments=False,
        )
    return PaymentAccountResponse.model_validate(account)


@router.get(
    "/payment-account",
    response_model=PaymentAccountResponse,
    summary="Teknisyen ödeme hesabı durumu",
)
async def get_me_payment_account(
    user: CurrentTechnicianDep,
    db: DbDep,
) -> PaymentAccountResponse:
    account = await technician_payment_accounts.get_payment_account(db, user.id)
    return _payment_account_response(user.id, account)


@router.put(
    "/payment-account/draft",
    response_model=PaymentAccountResponse,
    summary="Teknisyen ödeme hesabı taslağını kaydet",
)
async def put_me_payment_account_draft(
    payload: PaymentAccountDraftPayload,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> PaymentAccountResponse:
    account = await technician_payment_accounts.save_payment_account_draft(
        db,
        technician_user_id=user.id,
        legal_type=payload.legal_type,
        legal_name=payload.legal_name,
        tax_number_ref=payload.tax_number_ref,
        iban_ref=payload.iban_ref,
        authorized_person_name=payload.authorized_person_name,
        address_snapshot=payload.address_snapshot,
        business_snapshot=payload.business_snapshot,
    )
    await _emit_auth_event(
        db,
        user.id,
        AuthEventType.TECHNICIAN_PROFILE_UPDATED,
        {"scope": "payment_account", "status": "draft"},
    )
    await db.commit()
    return PaymentAccountResponse.model_validate(account)


@router.post(
    "/payment-account/submit",
    response_model=PaymentAccountResponse,
    summary="Teknisyen ödeme hesabını doğrulamaya gönder",
)
async def post_me_payment_account_submit(
    user: CurrentTechnicianDep,
    db: DbDep,
) -> PaymentAccountResponse:
    account = await technician_payment_accounts.submit_payment_account(db, user.id)
    await _emit_auth_event(
        db,
        user.id,
        AuthEventType.TECHNICIAN_PROFILE_UPDATED,
        {
            "scope": "payment_account",
            "status": account.status.value,
            "can_receive_online_payments": account.can_receive_online_payments,
        },
    )
    await db.commit()
    return PaymentAccountResponse.model_validate(account)


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
