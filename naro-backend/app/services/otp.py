import secrets
from dataclasses import dataclass
from uuid import uuid4

import redis.asyncio as redis

from app.core.config import get_settings
from app.integrations.sms import SmsProvider


@dataclass(frozen=True)
class OtpChallenge:
    delivery_id: str
    expires_in_seconds: int


class OtpService:
    """Redis tabanlı tek seferlik kod üretici/doğrulayıcı.

    Anahtar düzeni:
      otp:<delivery_id>           -> {"code": "...", "channel": "sms|email", "target": "...", "role": "..."}
      otp:<delivery_id>:attempts  -> integer counter, aynı TTL ile
    """

    KEY_PREFIX = "otp"

    def __init__(self, redis_client: redis.Redis, sms: SmsProvider) -> None:
        self._redis = redis_client
        self._sms = sms
        self._settings = get_settings()

    def _generate_code(self) -> str:
        upper = 10 ** self._settings.otp_code_length
        return f"{secrets.randbelow(upper):0{self._settings.otp_code_length}d}"

    async def issue(
        self,
        *,
        channel: str,
        target: str,
        role: str,
    ) -> OtpChallenge:
        delivery_id = uuid4().hex
        code = self._generate_code()
        ttl = self._settings.otp_expire_seconds

        key = f"{self.KEY_PREFIX}:{delivery_id}"
        await self._redis.hset(
            key,
            mapping={"code": code, "channel": channel, "target": target, "role": role},
        )
        await self._redis.expire(key, ttl)

        if channel == "sms":
            await self._sms.send(target, f"Naro giriş kodunuz: {code}")
        # email kanalı ileride eklenecek

        return OtpChallenge(delivery_id=delivery_id, expires_in_seconds=ttl)

    async def verify(self, *, delivery_id: str, code: str) -> dict[str, str] | None:
        key = f"{self.KEY_PREFIX}:{delivery_id}"
        attempts_key = f"{key}:attempts"

        data = await self._redis.hgetall(key)
        if not data:
            return None

        attempts = await self._redis.incr(attempts_key)
        if attempts == 1:
            ttl = await self._redis.ttl(key)
            if ttl > 0:
                await self._redis.expire(attempts_key, ttl)

        if attempts > self._settings.otp_max_attempts:
            await self._redis.delete(key, attempts_key)
            return None

        if data.get("code") != code:
            return None

        await self._redis.delete(key, attempts_key)
        return {"channel": data["channel"], "target": data["target"], "role": data["role"]}
