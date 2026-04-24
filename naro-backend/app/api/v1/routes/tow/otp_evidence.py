from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.api.v1.deps import CurrentUserDep, DbDep, RedisDep, TowTechnicianDep
from app.models.case import ServiceCase, ServiceRequestKind
from app.models.case_artifact import CaseAttachmentKind
from app.models.media import MediaAsset, MediaStatus
from app.models.tow import TowOtpDelivery, TowOtpPurpose, TowOtpRecipient
from app.schemas.tow import TowOtpIssueInput, TowOtpVerifyInput
from app.services import evidence as case_evidence_svc
from app.services import tow_evidence as evidence_svc

from ._guards import _ensure_participant

router = APIRouter()


@router.post(
    "/cases/{case_id}/otp/issue",
    summary="Arrival/delivery OTP ver (teknisyen tarafı)",
)
async def issue_otp(
    case_id: UUID,
    payload: TowOtpIssueInput,
    tech: TowTechnicianDep,
    db: DbDep,
    redis: RedisDep,
) -> dict[str, object]:
    case = await db.get(ServiceCase, case_id)
    if case is None or case.assigned_technician_id != tech.id:
        raise HTTPException(status_code=404, detail="not assigned")
    issued = await evidence_svc.issue_otp(
        db,
        redis=redis,
        case_id=case.id,
        purpose=TowOtpPurpose(payload.purpose),
        recipient=TowOtpRecipient(payload.recipient),
        delivered_via=TowOtpDelivery.SMS,
        issued_by_user_id=tech.id,
    )
    await db.commit()
    return {
        "otp_id": str(issued.otp_id),
        "expires_at": issued.expires_at_iso,
        # Code returned only in-response for dev; V1.1 SMS delivery only
        "code": issued.code,
    }


# ─── 8. OTP verify ──────────────────────────────────────────────────────────


@router.post(
    "/cases/{case_id}/otp/verify",
    summary="OTP doğrula",
)
async def verify_otp(
    case_id: UUID,
    payload: TowOtpVerifyInput,
    user: CurrentUserDep,
    db: DbDep,
    redis: RedisDep,
) -> dict[str, object]:
    case = await db.get(ServiceCase, case_id)
    if case is None or case.kind != ServiceRequestKind.TOWING:
        raise HTTPException(status_code=404, detail="tow case not found")
    _ensure_participant(case, user)

    try:
        ok = await evidence_svc.verify_otp(
            db,
            redis=redis,
            case_id=case_id,
            purpose=TowOtpPurpose(payload.purpose),
            submitted_code=payload.code,
        )
    except (
        evidence_svc.OtpExpiredError,
        evidence_svc.OtpInvalidError,
        evidence_svc.OtpMaxAttemptsError,
        evidence_svc.OtpAlreadyVerifiedError,
    ) as exc:
        raise HTTPException(
            status_code=422,
            detail={"type": "tow_otp_invalid", "message": str(exc)},
        ) from exc
    await db.commit()
    return {"verified": ok}

@router.post(
    "/cases/{case_id}/evidence",
    summary="Kanıt kaydı (fotoğraf link)",
)
async def add_evidence(
    case_id: UUID,
    user: CurrentUserDep,
    db: DbDep,
    kind: str = Query(..., description="customer_pre_state | tech_arrival | tech_loading | tech_delivery"),
    media_asset_id: Annotated[UUID | None, Query()] = None,
) -> dict[str, object]:
    case = await db.get(ServiceCase, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")
    _ensure_participant(case, user)
    if kind not in {
        "customer_pre_state",
        "tech_arrival",
        "tech_loading",
        "tech_delivery",
    }:
        raise HTTPException(
            status_code=422,
            detail={"type": "invalid_tow_evidence_kind", "kind": kind},
        )
    if kind.startswith("tech_") and case.assigned_technician_id != user.id:
        raise HTTPException(status_code=403, detail="technician evidence requires assignment")
    if media_asset_id is None:
        raise HTTPException(
            status_code=422,
            detail={"type": "tow_evidence_media_required", "kind": kind},
        )

    asset = await db.get(MediaAsset, media_asset_id)
    if asset is None or asset.deleted_at is not None:
        raise HTTPException(status_code=404, detail={"type": "media_asset_not_found"})
    if asset.uploaded_by_user_id != user.id:
        raise HTTPException(status_code=403, detail={"type": "media_asset_not_owned"})
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

    labels = {
        "customer_pre_state": "Araç ilk durum fotoğrafı",
        "tech_arrival": "Çekici varış fotoğrafı",
        "tech_loading": "Yükleme fotoğrafı",
        "tech_delivery": "Teslim fotoğrafı",
    }
    evidence = await case_evidence_svc.add_evidence_to_case(
        db,
        case_id=case.id,
        title=labels[kind],
        kind=CaseAttachmentKind.PHOTO,
        actor="technician" if kind.startswith("tech_") else "customer",
        source_label=f"tow:{kind}",
        status_label="Yüklendi",
        media_asset_id=media_asset_id,
    )
    await db.commit()
    return {
        "id": str(evidence.id),
        "case_id": str(case.id),
        "kind": kind,
        "media_asset_id": str(media_asset_id) if media_asset_id else None,
        "created_at": evidence.created_at.isoformat() if evidence.created_at else None,
    }
