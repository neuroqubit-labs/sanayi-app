from fastapi import APIRouter, HTTPException, status

from app.api.v1.deps import DbDep, OtpDep
from app.core.security import create_token
from app.models.user import UserRole
from app.repositories.user import UserRepository
from app.schemas.auth import (
    OtpRequest,
    OtpRequestResponse,
    OtpVerify,
    TokenPair,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/otp/request", response_model=OtpRequestResponse)
async def request_otp(payload: OtpRequest, otp: OtpDep) -> OtpRequestResponse:
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

    challenge = await otp.issue(channel=payload.channel, target=target, role=payload.role)
    return OtpRequestResponse(
        delivery_id=challenge.delivery_id,
        expires_in_seconds=challenge.expires_in_seconds,
    )


@router.post("/otp/verify", response_model=TokenPair)
async def verify_otp(payload: OtpVerify, otp: OtpDep, db: DbDep) -> TokenPair:
    result = await otp.verify(delivery_id=payload.delivery_id, code=payload.code)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="kod geçersiz veya süresi doldu",
        )

    role = UserRole(result["role"])
    users = UserRepository(db)

    user = None
    if result["channel"] == "sms":
        user = await users.get_by_phone(result["target"])
    else:
        user = await users.get_by_email(result["target"])

    if user is None:
        if result["channel"] == "sms":
            user = await users.create(role=role, phone=result["target"])
        else:
            user = await users.create(role=role, email=result["target"])

    return TokenPair(
        access_token=create_token(str(user.id), "access", {"role": user.role.value}),
        refresh_token=create_token(str(user.id), "refresh"),
    )
