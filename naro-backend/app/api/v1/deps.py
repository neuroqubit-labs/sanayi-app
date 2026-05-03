from collections.abc import AsyncGenerator
from typing import Annotated
from uuid import UUID

import redis.asyncio as redis
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.security import validate_access_token
from app.db.session import get_db
from app.integrations.psp import Psp, get_psp
from app.integrations.sms import SmsProvider, get_sms_provider
from app.models.technician import ProviderType, TechnicianCapability, TechnicianProfile
from app.models.user import User, UserApprovalStatus, UserRole, UserStatus
from app.repositories.user import UserRepository
from app.services.otp import OtpService

SettingsDep = Annotated[Settings, Depends(get_settings)]
DbDep = Annotated[AsyncSession, Depends(get_db)]


async def get_redis(settings: SettingsDep) -> AsyncGenerator[redis.Redis, None]:
    client: redis.Redis = redis.from_url(  # type: ignore[no-untyped-call]
        settings.redis_url, decode_responses=True
    )
    try:
        yield client
    finally:
        await client.aclose()


RedisDep = Annotated[redis.Redis, Depends(get_redis)]


def get_sms() -> SmsProvider:
    return get_sms_provider()


SmsDep = Annotated[SmsProvider, Depends(get_sms)]


def get_otp_service(redis_client: RedisDep, sms: SmsDep) -> OtpService:
    return OtpService(redis_client=redis_client, sms=sms)


OtpDep = Annotated[OtpService, Depends(get_otp_service)]

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: DbDep,
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="authentication required",
        )

    try:
        payload = validate_access_token(credentials.credentials)
        subject = payload.get("sub")
        if not isinstance(subject, str):
            raise ValueError("invalid token subject")
        user_id = UUID(subject)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    user = await UserRepository(db).get_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="user not found",
        )

    # Soft-deleted hesabın eski access token'ı (refresh revoke edilmiş ama
    # JWT TTL henüz dolmamış) yine de API'a erişmesin — KVKK + App Store/Play
    # policy gereği silinen hesap derhal API'dan kopmalı.
    if user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="account deleted",
        )

    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


# ─── Faz 10 — Role guards ───────────────────────────────────────────────────


async def require_customer(user: CurrentUserDep) -> User:
    if user.role != UserRole.CUSTOMER or user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="customer role required")
    return user


async def require_technician(user: CurrentUserDep) -> User:
    if user.role != UserRole.TECHNICIAN or user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="technician role required")
    if user.approval_status != UserApprovalStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="technician not approved")
    return user


async def require_tow_technician(
    user: Annotated[User, Depends(require_technician)],
    db: DbDep,
) -> User:
    """Tow-capable technician: provider_type=cekici AND capabilities.towing=true."""
    row = (
        await db.execute(
            select(TechnicianProfile, TechnicianCapability)
            .join(
                TechnicianCapability,
                TechnicianCapability.profile_id == TechnicianProfile.id,
            )
            .where(TechnicianProfile.user_id == user.id)
        )
    ).first()
    if row is None:
        raise HTTPException(status_code=403, detail="technician profile missing")
    profile, capability = row
    if profile.provider_type != ProviderType.CEKICI:
        raise HTTPException(status_code=403, detail="not a tow technician")
    if not capability.towing_coordination:
        raise HTTPException(status_code=403, detail="towing_coordination capability required")
    return user


async def require_admin(user: CurrentUserDep) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="admin role required")
    return user


CustomerDep = Annotated[User, Depends(require_customer)]
TechnicianDep = Annotated[User, Depends(require_technician)]
TowTechnicianDep = Annotated[User, Depends(require_tow_technician)]
AdminDep = Annotated[User, Depends(require_admin)]
# Brief §12.1 aliases — semantically explicit
CurrentCustomerDep = CustomerDep
CurrentTechnicianDep = TechnicianDep
CurrentAdminDep = AdminDep


def get_psp_dep() -> Psp:
    return get_psp()


PspDep = Annotated[Psp, Depends(get_psp_dep)]
