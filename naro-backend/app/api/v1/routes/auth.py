"""Auth router — OTP + OAuth + session/account management.

Faz 9 — OTP session persist fix, token rotation, OAuth endpoints,
session list/revoke, logout, account soft delete.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict

from app.api.v1.deps import CurrentUserDep, DbDep, OtpDep
from app.models.auth_event import AuthEventType
from app.models.auth_identity import AuthIdentityProvider
from app.repositories.user import UserRepository
from app.schemas.auth import (
    OtpRequest,
    OtpRequestResponse,
    OtpVerify,
    OtpVerifyResponse,
    RefreshRequest,
    TokenPair,
)
from app.services.auth_events import append_auth_event
from app.services.token_rotation import (
    InvalidRefreshTokenError,
    RefreshTokenReuseAttackError,
    issue_initial_session,
    rotate_refresh_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class LogoutResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    revoked: int


def _extract_client(request: Request) -> tuple[str | None, str | None, str | None]:
    ip = request.client.host if request.client else None
    ua = request.headers.get("User-Agent")
    device = request.headers.get("X-Device-Label")
    return ip, ua, device


@router.post("/otp/request", response_model=OtpRequestResponse)
async def request_otp(
    payload: OtpRequest,
    otp: OtpDep,
    db: DbDep,
    request: Request,
) -> OtpRequestResponse:
    if payload.channel == "sms":
        if not payload.phone:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="phone zorunlu",
            )
        target = payload.phone
    else:
        if not payload.email:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="email zorunlu",
            )
        target = payload.email

    challenge = await otp.issue(
        channel=payload.channel, target=target, role=payload.role
    )
    ip, ua, _ = _extract_client(request)
    await append_auth_event(
        db,
        event_type=AuthEventType.OTP_REQUESTED,
        target=target,
        ip_address=ip,
        user_agent=ua,
        context={
            "channel": payload.channel,
            "role": payload.role,
            "delivery_id": challenge.delivery_id,
        },
    )
    await db.commit()
    return OtpRequestResponse(
        delivery_id=challenge.delivery_id,
        expires_in_seconds=challenge.expires_in_seconds,
    )


@router.post("/otp/verify", response_model=OtpVerifyResponse)
async def verify_otp(
    payload: OtpVerify,
    otp: OtpDep,
    db: DbDep,
    request: Request,
) -> OtpVerifyResponse:
    result = await otp.verify(delivery_id=payload.delivery_id, code=payload.code)
    ip, ua, device = _extract_client(request)

    if not result:
        await append_auth_event(
            db,
            event_type=AuthEventType.OTP_FAILED,
            ip_address=ip,
            user_agent=ua,
            context={"delivery_id": payload.delivery_id},
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="kod geçersiz veya süresi doldu",
        )

    from sqlalchemy import select

    from app.models.technician import TechnicianProfile
    from app.models.user import UserRole

    role = UserRole(result["role"])
    users_repo = UserRepository(db)
    target_value = result["target"]

    if result["channel"] == "sms":
        user = await users_repo.get_by_phone(target_value)
        issued_via = AuthIdentityProvider.OTP_PHONE
    else:
        user = await users_repo.get_by_email(target_value)
        issued_via = AuthIdentityProvider.OTP_EMAIL

    is_new_user = user is None
    if user is None:
        if result["channel"] == "sms":
            user = await users_repo.create(role=role, phone=target_value)
        else:
            user = await users_repo.create(role=role, email=target_value)

    # Profile_completed: mobile routing matrisi onboarding/tabs kararı için.
    # - Technician: TechnicianProfile satırı var mı
    # - Customer: User.full_name dolu mu (boş → kısa profil ekranı gerekli)
    if user.role == UserRole.TECHNICIAN:
        profile_exists = (
            await db.execute(
                select(TechnicianProfile.id).where(
                    TechnicianProfile.user_id == user.id,
                    TechnicianProfile.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        profile_completed = profile_exists is not None
    else:
        profile_completed = bool(user.full_name and user.full_name.strip())

    # Session persist + token pair (Faz 9a FIX)
    pair = await issue_initial_session(
        db,
        user_id=user.id,
        issued_via=issued_via,
        ip_address=ip,
        user_agent=ua,
        device_label=device,
    )

    await append_auth_event(
        db,
        event_type=AuthEventType.OTP_VERIFIED,
        user_id=user.id,
        target=target_value,
        ip_address=ip,
        user_agent=ua,
        context={"channel": result["channel"], "role": role.value},
    )
    await append_auth_event(
        db,
        event_type=AuthEventType.LOGIN_SUCCESS,
        user_id=user.id,
        ip_address=ip,
        user_agent=ua,
        context={"via": issued_via.value},
    )

    await db.commit()

    return OtpVerifyResponse(
        access_token=pair.access_token,
        refresh_token=pair.refresh_token,
        user_id=user.id,
        role=user.role,
        approval_status=user.approval_status,
        is_new_user=is_new_user,
        profile_completed=profile_completed,
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh(
    payload: RefreshRequest, db: DbDep, request: Request
) -> TokenPair:
    ip, ua, _ = _extract_client(request)
    try:
        pair = await rotate_refresh_token(
            db,
            refresh_token_raw=payload.refresh_token,
            ip_address=ip,
            user_agent=ua,
        )
    except RefreshTokenReuseAttackError as exc:
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="refresh token reused — session revoked",
        ) from exc
    except InvalidRefreshTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    await db.commit()
    return TokenPair(
        access_token=pair.access_token,
        refresh_token=pair.refresh_token,
    )


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    user: CurrentUserDep, db: DbDep, request: Request
) -> LogoutResponse:
    """Şu anki access token ile ilişkili son aktif session'ı revoke et.

    Not: Access token → session mapping için JWT'de session_id claim yok;
    bu yüzden kullanıcının tüm aktif session'ları için daha kesin sonuç
    `/auth/logout_all`'dır. Bu endpoint yalnızca en son açılan session'ı revoke eder.
    """
    from datetime import UTC, datetime

    from sqlalchemy import and_, select, update

    from app.models.auth import AuthSession

    ip, ua, _ = _extract_client(request)
    stmt = (
        select(AuthSession)
        .where(
            and_(
                AuthSession.user_id == user.id,
                AuthSession.revoked_at.is_(None),
            )
        )
        .order_by(AuthSession.issued_at.desc())
        .limit(1)
    )
    target = (await db.execute(stmt)).scalar_one_or_none()
    revoked = 0
    if target is not None:
        await db.execute(
            update(AuthSession)
            .where(AuthSession.id == target.id)
            .values(revoked_at=datetime.now(UTC))
        )
        revoked = 1
        await append_auth_event(
            db,
            event_type=AuthEventType.LOGOUT,
            user_id=user.id,
            session_id=target.id,
            ip_address=ip,
            user_agent=ua,
        )
    await db.commit()
    return LogoutResponse(revoked=revoked)


@router.post("/logout_all", response_model=LogoutResponse)
async def logout_all(
    user: CurrentUserDep, db: DbDep, request: Request
) -> LogoutResponse:
    from app.repositories.auth import revoke_all_sessions_for_user

    ip, ua, _ = _extract_client(request)
    # Önce aktif sayısını al (audit context için)
    from sqlalchemy import and_, func, select

    from app.models.auth import AuthSession

    count_stmt = select(func.count()).select_from(AuthSession).where(
        and_(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None))
    )
    count = int((await db.execute(count_stmt)).scalar_one() or 0)

    await revoke_all_sessions_for_user(db, user.id)
    await append_auth_event(
        db,
        event_type=AuthEventType.LOGOUT_ALL,
        user_id=user.id,
        ip_address=ip,
        user_agent=ua,
        context={"revoked_count": count},
    )
    await db.commit()
    return LogoutResponse(revoked=count)
