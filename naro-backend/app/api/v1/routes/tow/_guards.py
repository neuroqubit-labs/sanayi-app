from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case import ServiceCase, TowDispatchStage
from app.models.technician import TechnicianProfile
from app.models.tow import TowOtpEvent, TowOtpPurpose, TowOtpVerifyResult
from app.models.user import User


def _ensure_participant(case: ServiceCase, user: User) -> None:
    is_participant = user.id in {case.customer_user_id, case.assigned_technician_id}
    is_admin = user.role.value == "admin"
    if not is_participant and not is_admin:
        raise HTTPException(status_code=403, detail="not a case participant")


async def _get_tow_profile_for_user(
    db: AsyncSession, user_id: UUID
) -> TechnicianProfile:
    profile = (
        await db.execute(
            select(TechnicianProfile).where(TechnicianProfile.user_id == user_id)
        )
    ).scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=404, detail="technician profile not found")
    return profile


async def _ensure_stage_prerequisites(
    db: AsyncSession, case_id: UUID, target: TowDispatchStage
) -> None:
    if target == TowDispatchStage.LOADING:
        await _ensure_otp_verified(db, case_id, TowOtpPurpose.ARRIVAL)
    if target == TowDispatchStage.DELIVERED:
        await _ensure_otp_verified(db, case_id, TowOtpPurpose.DELIVERY)


async def _ensure_otp_verified(
    db: AsyncSession, case_id: UUID, purpose: TowOtpPurpose
) -> None:
    stmt = (
        select(TowOtpEvent.id)
        .where(
            and_(
                TowOtpEvent.case_id == case_id,
                TowOtpEvent.purpose == purpose,
                TowOtpEvent.verify_result == TowOtpVerifyResult.SUCCESS,
            )
        )
        .limit(1)
    )
    found = (await db.execute(stmt)).scalar_one_or_none()
    if found is None:
        raise HTTPException(
            status_code=422,
            detail={
                "type": "tow_otp_required",
                "purpose": purpose.value,
            },
        )
