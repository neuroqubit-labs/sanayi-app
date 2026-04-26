"""Müşteri vaka oluşturma + listeleme + cancel endpoint'leri (brief §2.2).

- POST   /cases                (müşteri: create)
- GET    /cases/{id}           (participant: detay)
- GET    /cases/me             (müşteri: açık vakalar)
- POST   /cases/{id}/cancel    (müşteri/admin: iptal)

Draft endpoint'leri (POST/GET/DELETE /cases/drafts/*) ayrı brief kapsamında.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import func, select

from app.api.v1.deps import (
    CurrentTechnicianDep,
    CurrentUserDep,
    CustomerDep,
    DbDep,
    RedisDep,
    SettingsDep,
)
from app.integrations.storage import build_storage_gateway
from app.models.case import (
    CaseWaitActor,
    ServiceCase,
    ServiceCaseStatus,
    ServiceRequestKind,
)
from app.models.case_artifact import CaseAttachmentKind
from app.models.case_audit import CaseEventType, CaseTone
from app.models.case_matching import CaseTechnicianNotificationStatus
from app.models.case_public_showcase import (
    CasePublicShowcase,
    CasePublicShowcaseStatus,
)
from app.models.case_subtypes import (
    AccidentCase,
    BreakdownCase,
    MaintenanceCase,
    TowCase,
)
from app.models.media import MediaAsset, MediaStatus
from app.models.offer import ACTIVE_OFFER_STATUSES, CaseOffer
from app.models.technician import TechnicianProfile
from app.models.user import User, UserRole, UserStatus
from app.repositories import appointment as appointment_repo
from app.repositories import case as case_repo
from app.repositories import offer as offer_repo
from app.schemas.case_document import (
    CaseDocumentItem,
    CaseDocumentListResponse,
    CaseEventItem,
    CaseEventListResponse,
)
from app.schemas.case_dossier import MatchNotifyState
from app.schemas.case_process import CaseEvidenceItemResponse
from app.schemas.case_thread import CaseNotesPayload
from app.schemas.service_request import ServiceRequestDraftCreate
from app.services import (
    approval_flow,
    case_create,
    case_documents,
    case_matching,
    case_public_showcases,
)
from app.services import evidence as evidence_service
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
    vehicle_id: UUID
    kind: ServiceRequestKind
    status: ServiceCaseStatus
    urgency: str
    workflow_blueprint: str
    title: str
    summary: str | None = None
    location_label: str | None = None
    created_at: datetime
    updated_at: datetime
    active_offer_count: int = 0
    has_active_offers: bool = False


class VehicleSnapshotResponse(BaseModel):
    """Immutable vehicle snapshot — case create anında alınır."""

    plate: str
    make: str | None = None
    model: str | None = None
    year: int | None = None
    fuel_type: str | None = None
    vin: str | None = None
    current_km: int | None = None


class CaseNextAction(BaseModel):
    """QA tur 2 P1-1 fix: role-aware next action projection.

    B-P2-1 wait_state alanlarından derive (actor/label/description) +
    okuyan role'e göre `waiting_on_me` bayrağı. FE L3-P0-2 next_action
    kartında render eder (wait_state direkt tüketmek yerine).
    """

    actor: CaseWaitActor
    label: str | None = None
    description: str | None = None
    waiting_on_me: bool = False


class CustomerShowcaseRevokePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str | None = Field(default=None, max_length=500)


class CustomerShowcaseItem(BaseModel):
    id: UUID
    case_id: UUID
    kind: str
    status: CasePublicShowcaseStatus
    title: str
    summary: str
    month_label: str | None = None
    location_label: str | None = None
    rating: int | None = None


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
    # QA tur 2 P1-1 — 4 projection alanı (B-P2-1/B-P1-E mevcut veri, read
    # path eksikti).
    next_action: CaseNextAction | None = None
    wait_state_actor: CaseWaitActor | None = None
    wait_state_label: str | None = None
    wait_state_description: str | None = None
    estimate_amount: Decimal | None = None
    assigned_technician_id: UUID | None = None


class StatusUpdatePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    note: str = Field(min_length=1, max_length=2000)


class CaseEvidencePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=255)
    kind: CaseAttachmentKind
    source_label: str = Field(default="Usta uygulaması", min_length=1, max_length=255)
    status_label: str = Field(default="Yüklendi", min_length=1, max_length=255)
    subtitle: str | None = Field(default=None, max_length=255)
    media_asset_id: UUID | None = None
    task_id: UUID | None = None
    milestone_id: UUID | None = None
    approval_id: UUID | None = None
    requirement_id: str | None = Field(default=None, max_length=64)


class CaseTechnicianNotifyPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    technician_profile_id: UUID | None = None
    technician_id: UUID | None = None
    note: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _require_target(self) -> CaseTechnicianNotifyPayload:
        if self.technician_profile_id is None and self.technician_id is None:
            raise ValueError("technician_profile_id_required")
        return self


class CaseTechnicianNotifyResponse(BaseModel):
    notification_id: UUID
    match_id: UUID | None = None
    case_id: UUID
    technician_profile_id: UUID
    technician_id: UUID
    status: CaseTechnicianNotificationStatus
    notify_state: MatchNotifyState
    match_badge: str
    match_reason_label: str


async def _resolve_notify_technician_target(
    db: DbDep,
    *,
    technician_profile_id: UUID | None,
    technician_id: UUID | None,
) -> tuple[UUID, UUID]:
    """Resolve public profile id or technician user id for notify flow.

    Customer-facing public technician screens are keyed by
    `technician_profiles.id`; the notification/matching ledger is keyed by
    technician `users.id`. Accept both here so a profile id never leaks into
    assignment, offer, or notification semantics.
    """
    if technician_profile_id is not None:
        profile = await db.get(TechnicianProfile, technician_profile_id)
        if profile is None or profile.deleted_at is not None:
            raise HTTPException(
                status_code=404, detail={"type": "technician_profile_not_found"}
            )
        owner = await db.get(User, profile.user_id)
        if (
            owner is None
            or owner.role != UserRole.TECHNICIAN
            or owner.status != UserStatus.ACTIVE
        ):
            raise HTTPException(
                status_code=404, detail={"type": "technician_profile_not_found"}
            )
        return owner.id, profile.id

    assert technician_id is not None
    technician = await db.get(User, technician_id)
    if technician is not None:
        if technician.role != UserRole.TECHNICIAN:
            raise HTTPException(
                status_code=404, detail={"type": "technician_profile_not_found"}
            )
        profile = (
            await db.execute(
                select(TechnicianProfile).where(
                    TechnicianProfile.user_id == technician.id,
                    TechnicianProfile.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if profile is None:
            raise HTTPException(
                status_code=404, detail={"type": "technician_profile_not_found"}
            )
        return technician.id, profile.id

    profile = await db.get(TechnicianProfile, technician_id)
    if profile is None or profile.deleted_at is not None:
        raise HTTPException(
            status_code=404, detail={"type": "technician_profile_not_found"}
        )
    owner = await db.get(User, profile.user_id)
    if (
        owner is None
        or owner.role != UserRole.TECHNICIAN
        or owner.status != UserStatus.ACTIVE
    ):
        raise HTTPException(
            status_code=404, detail={"type": "technician_profile_not_found"}
        )
    return owner.id, profile.id


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
    redis: RedisDep,
) -> CaseCreateResponse:
    try:
        result = await case_create.create_case(db, user_id=user.id, draft=draft)
        if draft.kind == ServiceRequestKind.TOWING:
            await case_create.start_tow_operations(
                db,
                case=result.case,
                draft=draft,
                actor_user_id=user.id,
                redis=redis,
            )
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
    case_ids = [case.id for case in cases]
    active_offer_counts: dict[UUID, int] = {}
    if case_ids:
        rows = await db.execute(
            select(CaseOffer.case_id, func.count(CaseOffer.id))
            .where(
                CaseOffer.case_id.in_(case_ids),
                CaseOffer.status.in_(tuple(ACTIVE_OFFER_STATUSES)),
            )
            .group_by(CaseOffer.case_id)
        )
        active_offer_counts = {
            case_id: int(count) for case_id, count in rows.all()
        }
    return [
        CaseSummaryResponse.model_validate(case).model_copy(
            update={
                "active_offer_count": active_offer_counts.get(case.id, 0),
                "has_active_offers": active_offer_counts.get(case.id, 0) > 0,
            }
        )
        for case in cases
    ]


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
    next_action = _build_next_action(case, user.role)
    return CaseDetailResponse(
        id=case.id,
        vehicle_id=case.vehicle_id,
        kind=case.kind,
        status=case.status,
        urgency=case.urgency.value,
        workflow_blueprint=case.workflow_blueprint,
        title=case.title,
        summary=case.summary,
        location_label=case.location_label,
        created_at=case.created_at,
        updated_at=case.updated_at,
        vehicle_snapshot=_vehicle_snapshot_view(subtype),
        subtype=_subtype_view(subtype, case),
        parent_case_id=parent_case_id,
        linked_tow_case_ids=linked_tow_case_ids,
        customer_notes=notes,
        next_action=next_action,
        wait_state_actor=case.wait_state_actor,
        wait_state_label=case.wait_state_label,
        wait_state_description=case.wait_state_description,
        estimate_amount=case.estimate_amount,
        assigned_technician_id=case.assigned_technician_id,
    )


@router.post(
    "/{case_id}/showcase/revoke",
    response_model=CustomerShowcaseItem,
    summary="Müşteri public vitrin iznini geri çeker",
)
async def revoke_case_showcase(
    case_id: UUID,
    payload: CustomerShowcaseRevokePayload,
    user: CustomerDep,
    db: DbDep,
) -> CustomerShowcaseItem:
    case = await case_repo.get_case(db, case_id)
    if (
        case is None
        or case.deleted_at is not None
        or case.customer_user_id != user.id
    ):
        raise HTTPException(status_code=404, detail={"type": "case_not_found"})
    showcase = (
        await db.execute(
            select(CasePublicShowcase).where(
                CasePublicShowcase.case_id == case.id,
                CasePublicShowcase.customer_user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if showcase is None:
        raise HTTPException(
            status_code=404, detail={"type": "showcase_not_found"}
        )
    showcase = await case_public_showcases.revoke_for_actor(
        db, showcase=showcase, actor="customer"
    )
    await append_event(
        db,
        case_id=case.id,
        event_type=CaseEventType.STATUS_UPDATE,
        title="Vitrin izni geri çekildi",
        tone=CaseTone.WARNING,
        actor_user_id=user.id,
        context={"reason": payload.reason} if payload.reason else {},
    )
    await db.commit()
    snapshot = dict(showcase.public_snapshot or {})
    return CustomerShowcaseItem(
        id=showcase.id,
        case_id=showcase.case_id,
        kind=showcase.kind.value,
        status=showcase.status,
        title=str(
            case_public_showcases.snapshot_value(snapshot, "title")
            or showcase.kind.value
        ),
        summary=str(
            case_public_showcases.snapshot_value(snapshot, "summary")
            or "Vaka özeti"
        ),
        month_label=case_public_showcases.snapshot_value(snapshot, "month_label"),
        location_label=case_public_showcases.snapshot_value(
            snapshot, "location_label"
        ),
        rating=case_public_showcases.snapshot_value(snapshot, "rating"),
    )


@router.post(
    "/{case_id}/notify-technicians",
    response_model=CaseTechnicianNotifyResponse,
    summary="Müşteri vakayı belirli ustaya bildirir",
)
async def notify_technician_for_case(
    case_id: UUID,
    payload: CaseTechnicianNotifyPayload,
    user: CustomerDep,
    db: DbDep,
) -> CaseTechnicianNotifyResponse:
    case = await case_repo.get_case(db, case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(status_code=404, detail={"type": "case_not_found"})
    if case.customer_user_id != user.id:
        raise HTTPException(status_code=403, detail={"type": "not_case_owner"})
    if case.kind == ServiceRequestKind.TOWING:
        raise HTTPException(
            status_code=422,
            detail={"type": "tow_case_cannot_be_notified_to_technician"},
        )
    if case.assigned_technician_id is not None:
        raise HTTPException(
            status_code=409, detail={"type": "case_already_assigned"}
        )
    if case.status not in (
        ServiceCaseStatus.MATCHING,
        ServiceCaseStatus.OFFERS_READY,
    ):
        raise HTTPException(
            status_code=422,
            detail={
                "type": "case_not_open_for_notification",
                "case_status": case.status.value,
            },
        )

    technician_user_id, technician_profile_id = await _resolve_notify_technician_target(
        db,
        technician_profile_id=payload.technician_profile_id,
        technician_id=payload.technician_id,
    )

    try:
        notification = await case_matching.notify_case_to_technician(
            db,
            case=case,
            customer_user_id=user.id,
            technician_user_id=technician_user_id,
            note=payload.note,
        )
    except ValueError as exc:
        error_type = str(exc)
        status_code = 404 if error_type == "technician_profile_not_found" else 422
        if error_type == "case_notification_limit_reached":
            status_code = 409
        raise HTTPException(status_code=status_code, detail={"type": error_type}) from exc

    context = await case_matching.context_for_cases(
        db,
        case_ids=[case.id],
        technician_user_id=technician_user_id,
    )
    await append_event(
        db,
        case_id=case.id,
        event_type=CaseEventType.STATUS_UPDATE,
        title="Vaka ustaya bildirildi",
        tone=CaseTone.INFO,
        actor_user_id=user.id,
        context={
            "technician_id": str(technician_user_id),
            "technician_profile_id": str(technician_profile_id),
            "compat_technician_id": str(payload.technician_id)
            if payload.technician_id
            else None,
            "notification_id": str(notification.id),
            "match_id": str(notification.match_id) if notification.match_id else None,
        },
    )
    await db.commit()
    item = context.get(case.id, {})
    return CaseTechnicianNotifyResponse(
        notification_id=notification.id,
        match_id=notification.match_id,
        case_id=case.id,
        technician_profile_id=technician_profile_id,
        technician_id=technician_user_id,
        status=notification.status,
        notify_state=MatchNotifyState.ALREADY_NOTIFIED,
        match_badge=str(item.get("match_badge") or "Ustaya bildirildi"),
        match_reason_label=str(
            item.get("match_reason_label")
            or "Usta teklif gönderirse randevuya geçebilirsin"
        ),
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
    next_action = _build_next_action(case, user.role)
    return CaseDetailResponse(
        id=case.id,
        vehicle_id=case.vehicle_id,
        kind=case.kind,
        status=case.status,
        urgency=case.urgency.value,
        workflow_blueprint=case.workflow_blueprint,
        title=case.title,
        summary=case.summary,
        location_label=case.location_label,
        created_at=case.created_at,
        updated_at=case.updated_at,
        vehicle_snapshot=_vehicle_snapshot_view(subtype),
        subtype=_subtype_view(subtype, case),
        parent_case_id=parent_case_id,
        linked_tow_case_ids=linked_tow_case_ids,
        customer_notes=case.customer_notes,
        next_action=next_action,
        wait_state_actor=case.wait_state_actor,
        wait_state_label=case.wait_state_label,
        wait_state_description=case.wait_state_description,
        estimate_amount=case.estimate_amount,
        assigned_technician_id=case.assigned_technician_id,
    )


@router.post(
    "/{case_id}/status-updates",
    response_model=CaseEventItem,
    summary="Teknisyen süreç güncellemesi paylaşır",
)
async def create_status_update(
    case_id: UUID,
    payload: StatusUpdatePayload,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> CaseEventItem:
    case = await case_repo.get_case(db, case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(status_code=404, detail={"type": "case_not_found"})
    _assert_assigned_technician(case, user_id=user.id)
    note = " ".join(payload.note.strip().split())
    event = await append_event(
        db,
        case_id=case.id,
        event_type=CaseEventType.STATUS_UPDATE,
        title="Usta süreç güncellemesi paylaştı",
        body=note,
        tone=CaseTone.INFO,
        actor_user_id=user.id,
        context={"source": "technician_app"},
    )
    await db.commit()
    return CaseEventItem(
        id=event.id,
        type=event.event_type,
        title=event.title,
        body=event.body,
        tone=CaseTone(event.tone),
        actor_user_id=event.actor_user_id,
        actor_role="technician",
        context=event.context,
        created_at=event.created_at,
    )


@router.post(
    "/{case_id}/evidence",
    response_model=CaseEvidenceItemResponse,
    summary="Teknisyen vaka kanıtı ekler",
)
async def create_case_evidence(
    case_id: UUID,
    payload: CaseEvidencePayload,
    user: CurrentTechnicianDep,
    db: DbDep,
) -> CaseEvidenceItemResponse:
    case = await case_repo.get_case(db, case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(status_code=404, detail={"type": "case_not_found"})
    _assert_assigned_technician(case, user_id=user.id)

    if payload.media_asset_id is not None:
        asset = await db.get(MediaAsset, payload.media_asset_id)
        if asset is None or asset.deleted_at is not None:
            raise HTTPException(
                status_code=404, detail={"type": "media_asset_not_found"}
            )
        if asset.uploaded_by_user_id != user.id:
            raise HTTPException(
                status_code=403, detail={"type": "media_asset_not_owned"}
            )
        if asset.status not in {
            MediaStatus.PROCESSING,
            MediaStatus.READY,
            MediaStatus.UPLOADED,
        }:
            raise HTTPException(
                status_code=422,
                detail={
                    "type": "media_asset_not_ready",
                    "status": asset.status.value,
                },
            )
        if asset.linked_case_id is not None and asset.linked_case_id != case.id:
            raise HTTPException(
                status_code=409,
                detail={"type": "media_asset_already_linked"},
            )
        asset.linked_case_id = case.id

    evidence = await evidence_service.add_evidence_to_case(
        db,
        case_id=case.id,
        title=payload.title,
        kind=payload.kind,
        actor="technician",
        source_label=payload.source_label,
        status_label=payload.status_label,
        subtitle=payload.subtitle,
        media_asset_id=payload.media_asset_id,
        task_id=payload.task_id,
        milestone_id=payload.milestone_id,
        approval_id=payload.approval_id,
        requirement_id=payload.requirement_id,
    )
    await db.commit()
    return CaseEvidenceItemResponse.model_validate(evidence)


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
    # QA tur 2 P1-2 fix: cancel 500 robustness —
    # 1) transition + cascade row updates atomic → commit
    # 2) cascade event emit ayrı blok, try/except + log (non-fatal)
    # 3) status 200 dönüş garanti.
    import logging

    from app.services.case_lifecycle import transition_case_status

    _logger = logging.getLogger("cancel_case_endpoint")

    # (1) Status transition via authority (wait_state projection B-P2-1
    # alignment) + cascade row updates.
    await transition_case_status(
        db,
        case.id,
        ServiceCaseStatus.CANCELLED,
        actor_user_id=user.id,
    )
    cascaded_offers = await offer_repo.reject_all_pending_for_case(db, case.id)
    cascaded_appts = await appointment_repo.cancel_all_for_case(db, case.id)
    cascaded_approvals = await approval_flow.reject_all_pending_for_case(
        db, case.id
    )
    # QA tur 2 P0-3 fix: linked tow cascade — accident/breakdown parent
    # iptal edildiğinde child tow case'leri de TERMINAL'e taşı (system
    # actor, fee 0). Faz 2 tow_case.parent_case_id reverse lookup.
    cascaded_tow_case_ids: list[UUID] = []
    if case.kind in (
        ServiceRequestKind.ACCIDENT,
        ServiceRequestKind.BREAKDOWN,
    ):
        linked_tow_ids = await case_repo.list_linked_tow_case_ids(db, case.id)
        for child_tow_case_id in linked_tow_ids:
            moved = await _cancel_linked_tow_case(
                db, child_tow_case_id, actor_user_id=user.id
            )
            if moved:
                cascaded_tow_case_ids.append(child_tow_case_id)

    await db.commit()
    await db.refresh(case)

    # (2) Cascade event emit — non-fatal. Herhangi bir emit fail olursa
    # log + devam; müşteri cancel başarılı (200) dönmeye devam eder.
    try:
        for offer_id in cascaded_offers:
            await append_event(
                db,
                case_id=case.id,
                event_type=CaseEventType.OFFER_AUTO_REJECTED,
                title="Teklif otomatik reddedildi (vaka iptal)",
                tone=CaseTone.NEUTRAL,
                actor_user_id=user.id,
                context={"offer_id": str(offer_id), "reason": "case_cancelled"},
            )
        for appt_id in cascaded_appts:
            await append_event(
                db,
                case_id=case.id,
                event_type=CaseEventType.APPOINTMENT_AUTO_CANCELLED,
                title="Randevu otomatik iptal edildi (vaka iptal)",
                tone=CaseTone.NEUTRAL,
                actor_user_id=user.id,
                context={
                    "appointment_id": str(appt_id),
                    "reason": "case_cancelled",
                },
            )
        for approval_id in cascaded_approvals:
            await append_event(
                db,
                case_id=case.id,
                event_type=CaseEventType.APPROVAL_AUTO_REJECTED,
                title="Onay otomatik reddedildi (vaka iptal)",
                tone=CaseTone.NEUTRAL,
                actor_user_id=user.id,
                context={
                    "approval_id": str(approval_id),
                    "reason": "case_cancelled",
                },
            )
        # QA tur 2 P0-3: linked tow cascade event'leri — hem parent'a hem
        # child tow shell'e CANCELLED emit (child timeline de dahil).
        for child_tow_case_id in cascaded_tow_case_ids:
            await append_event(
                db,
                case_id=case.id,
                event_type=CaseEventType.CANCELLED,
                title="Bağlı çekici talebi otomatik iptal edildi",
                tone=CaseTone.NEUTRAL,
                actor_user_id=user.id,
                context={
                    "linked_tow_case_id": str(child_tow_case_id),
                    "reason": "parent_case_cancelled",
                },
            )
            await append_event(
                db,
                case_id=child_tow_case_id,
                event_type=CaseEventType.CANCELLED,
                title="Çekici talebi otomatik iptal edildi (ana vaka iptal)",
                tone=CaseTone.WARNING,
                actor_user_id=user.id,
                context={
                    "parent_case_id": str(case.id),
                    "reason": "parent_case_cancelled",
                },
            )
        await db.commit()
    except Exception:  # cancel itself already committed — emit is best-effort
        _logger.exception(
            "cascade event emit failed for case=%s (cancel already committed)",
            case.id,
        )
        await db.rollback()
    return CaseSummaryResponse.model_validate(case)


# ─── Helpers ────────────────────────────────────────────────────────────────


def _build_next_action(
    case: ServiceCase, role: UserRole
) -> CaseNextAction | None:
    """QA tur 2 P1-1: wait_state → role-aware next_action projection.

    waiting_on_me = aktör = okuyanın rolü. Admin asla waiting_on_me
    (admin audit perspektifinde izler).
    """
    actor = case.wait_state_actor
    if actor is None:
        return None
    role_actor_map = {
        UserRole.CUSTOMER: CaseWaitActor.CUSTOMER,
        UserRole.TECHNICIAN: CaseWaitActor.TECHNICIAN,
    }
    expected_actor = role_actor_map.get(role)
    waiting_on_me = expected_actor is not None and actor == expected_actor
    return CaseNextAction(
        actor=actor,
        label=case.wait_state_label,
        description=case.wait_state_description,
        waiting_on_me=waiting_on_me,
    )


def _assert_participant(case: ServiceCase, *, user_id: UUID, role: UserRole) -> None:
    if role == UserRole.ADMIN:
        return
    participant_ids = {case.customer_user_id, case.assigned_technician_id}
    if user_id not in participant_ids:
        raise HTTPException(
            status_code=403, detail={"type": "not_case_participant"}
        )


def _assert_assigned_technician(case: ServiceCase, *, user_id: UUID) -> None:
    if case.assigned_technician_id != user_id:
        raise HTTPException(
            status_code=403, detail={"type": "not_assigned_technician"}
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
    case: ServiceCase | None = None,
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
            "assigned_technician_id": _assigned_tech_str(case),
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
            "assigned_technician_id": _assigned_tech_str(case),
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
            "assigned_technician_id": _assigned_tech_str(case),
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
            "assigned_technician_id": _assigned_tech_str(case),
        }
    return None


def _assigned_tech_str(case: ServiceCase | None) -> str | None:
    """QA tur 3 P1-1: case.assigned_technician_id UUID → str (subtype JSON)."""
    if case is None or case.assigned_technician_id is None:
        return None
    return str(case.assigned_technician_id)


# ─── Documents + Events (İş 5 — FE engine.ts blocker) ──────────────────


@router.get(
    "/{case_id}/documents",
    response_model=CaseDocumentListResponse,
    summary="Vaka belgeleri (participant-only)",
)
async def list_case_documents(
    case_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
    settings: SettingsDep,
) -> CaseDocumentListResponse:
    case = await case_repo.get_case(db, case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(status_code=404, detail={"type": "case_not_found"})
    _assert_participant(case, user_id=user.id, role=user.role)
    storage = build_storage_gateway(settings)
    views = await case_documents.list_documents(
        db, case_id=case_id, storage=storage
    )
    items = [
        CaseDocumentItem(
            id=v.asset.id,
            kind=case_documents.classify_document_kind(v.asset.purpose),
            title=v.asset.original_filename or v.asset.object_key,
            signed_url=v.signed_url,
            uploader_role=v.uploader_role,
            uploader_user_id=v.asset.uploaded_by_user_id,
            uploaded_at=v.asset.uploaded_at or v.asset.created_at,
            size_bytes=v.asset.size_bytes,
            mime_type=v.asset.mime_type,
            antivirus_verdict=case_documents.antivirus_verdict(
                v.asset.antivirus_verdict
            ),
        )
        for v in views
    ]
    return CaseDocumentListResponse(items=items)


@router.get(
    "/{case_id}/events",
    response_model=CaseEventListResponse,
    summary="Vaka timeline (participant-only, cursor ASC)",
)
async def list_case_events(
    case_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
    cursor: str | None = Query(default=None),
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> CaseEventListResponse:
    case = await case_repo.get_case(db, case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(status_code=404, detail={"type": "case_not_found"})
    _assert_participant(case, user_id=user.id, role=user.role)
    try:
        page = await case_documents.list_events(
            db, case_id=case_id, limit=limit, cursor=cursor
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail={"type": "invalid_cursor"}
        ) from exc
    items = [
        CaseEventItem(
            id=event.id,
            type=event.event_type,
            title=event.title,
            body=event.body,
            tone=CaseTone(event.tone),
            actor_user_id=event.actor_user_id,
            actor_role=actor_role,
            context=event.context,
            created_at=event.created_at,
        )
        for event, actor_role in page.items
    ]
    return CaseEventListResponse(items=items, next_cursor=page.next_cursor)


# QA tur 2 P0-3 — linked tow cascade helper
from datetime import UTC  # noqa: E402

from sqlalchemy import update as _update  # noqa: E402

from app.models.case import TowDispatchStage as _TowStage  # noqa: E402
from app.models.case_subtypes import TowCase as _TowCaseModel  # noqa: E402


async def _cancel_linked_tow_case(
    db: DbDep, tow_case_id: UUID, *, actor_user_id: UUID
) -> bool:
    """Parent cascade tow iptali — fee 0, system actor, minimal
    state mutation. `tow_lifecycle.cancel_case` full path (settlement,
    refund, fee compute) kullanılmıyor çünkü parent cascade semantic
    farklı: customer'a yeni charge yok, refund yok, sadece stage +
    shell TERMINAL'e geçer.
    """
    tow = await db.get(_TowCaseModel, tow_case_id)
    child_case = await db.get(ServiceCase, tow_case_id)
    if tow is None or child_case is None:
        return False
    if child_case.status in (
        ServiceCaseStatus.COMPLETED,
        ServiceCaseStatus.CANCELLED,
        ServiceCaseStatus.ARCHIVED,
    ):
        return False
    # Tow stage her ne olursa olsun CANCELLED'e çek (parent cascade'de
    # allowed transitions bypass — system actor full fare gerekli değil).
    await db.execute(
        _update(_TowCaseModel)
        .where(_TowCaseModel.case_id == tow_case_id)
        .values(tow_stage=_TowStage.CANCELLED)
    )
    # Shell CANCELLED (transition_case_status authority, wait_state temizler).
    from app.services.case_lifecycle import transition_case_status as _tr

    await _tr(
        db, tow_case_id, ServiceCaseStatus.CANCELLED, actor_user_id=actor_user_id
    )
    # Occupancy lock release (assigned_technician_id varsa)
    if child_case.assigned_technician_id:
        from app.repositories import tow as _tow_repo

        await _tow_repo.release_technician_offer(
            db, child_case.assigned_technician_id
        )
    child_case.closed_at = datetime.now(UTC)
    return True
