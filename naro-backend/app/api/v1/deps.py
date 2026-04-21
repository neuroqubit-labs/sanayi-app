from collections.abc import AsyncGenerator
from typing import Annotated
from uuid import UUID

import redis.asyncio as redis
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.security import validate_access_token
from app.db.session import get_db
from app.integrations.sms import SmsProvider, get_sms_provider
from app.models.user import User
from app.repositories.user import UserRepository
from app.services.otp import OtpService

SettingsDep = Annotated[Settings, Depends(get_settings)]
DbDep = Annotated[AsyncSession, Depends(get_db)]


async def get_redis(settings: SettingsDep) -> AsyncGenerator[redis.Redis, None]:
    client = redis.from_url(settings.redis_url, decode_responses=True)
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

    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]
