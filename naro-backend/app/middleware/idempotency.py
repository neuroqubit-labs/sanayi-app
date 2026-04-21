"""HTTP Idempotency-Key middleware — Redis replay cache (24h TTL).

- Sadece mutating methods (POST/PUT/PATCH/DELETE) için aktif.
- `Idempotency-Key` header + user_id kombinasyonu cache key.
- İlk çağrı → response kaydedilir; aynı key + 24h → cached response döner.

Service-layer PSP idempotency (`tow_payment_idempotency` tablosu) bu katmandan
bağımsızdır; HTTP layer sadece aynı response'u replay eder.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from redis.asyncio import Redis
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse

IDEMPOTENCY_KEY_HEADER = "Idempotency-Key"
REPLAY_TTL_SECONDS = 24 * 60 * 60
MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


class IdempotencyMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: object, *, redis_factory: Callable[[], Redis]):
        super().__init__(app)  # type: ignore[arg-type]
        self._redis_factory = redis_factory

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if request.method not in MUTATING_METHODS:
            return await call_next(request)

        idem_key = request.headers.get(IDEMPOTENCY_KEY_HEADER)
        if not idem_key:
            return await call_next(request)

        auth = request.headers.get("authorization", "")
        actor_hash = hashlib.sha256(auth.encode()).hexdigest()[:16]
        cache_key = f"idem:{request.method}:{request.url.path}:{actor_hash}:{idem_key}"

        redis = self._redis_factory()
        try:
            cached = await redis.get(cache_key)
            if cached is not None:
                payload = json.loads(cached)
                return StarletteResponse(
                    content=payload["body"],
                    status_code=payload["status"],
                    headers={**payload.get("headers", {}), "X-Idempotent-Replay": "true"},
                    media_type=payload.get("media_type", "application/json"),
                )

            response = await call_next(request)
            if response.status_code < 500:
                body_bytes = b""
                async for chunk in response.body_iterator:  # type: ignore[attr-defined]
                    body_bytes += chunk
                payload = {
                    "status": response.status_code,
                    "body": body_bytes.decode("utf-8", errors="replace"),
                    "headers": dict(response.headers),
                    "media_type": response.media_type,
                }
                await redis.set(cache_key, json.dumps(payload), ex=REPLAY_TTL_SECONDS)
                return StarletteResponse(
                    content=body_bytes,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type,
                )
            return response
        finally:
            await redis.aclose()
