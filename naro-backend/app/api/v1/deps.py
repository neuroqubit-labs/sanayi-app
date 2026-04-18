from collections.abc import AsyncGenerator
from typing import Annotated

import redis.asyncio as redis
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.integrations.sms import SmsProvider, get_sms_provider
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
