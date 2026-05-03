"""Production security response headers.

OWASP minimum set:
- Strict-Transport-Security: HTTPS-only enforcement (browser memory)
- X-Content-Type-Options: MIME sniffing'i kapat
- X-Frame-Options: clickjacking koruması (Naro UI iframe-embed yok)
- Referrer-Policy: cross-origin referrer leak engeli

CSP eklenmedi: API endpoint'ler tarayıcı tarafından doğrudan render edilmiyor;
swagger /docs için varsayılan FastAPI CSP yeterli.

Development'ta noop — dev tools/Swagger UI için dar CSP gibi yan etkiler
istemiyoruz.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: object, *, enabled: bool = True) -> None:
        super().__init__(app)  # type: ignore[arg-type]
        self._enabled = enabled

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        response = await call_next(request)
        if not self._enabled:
            return response

        headers = response.headers
        headers.setdefault(
            "Strict-Transport-Security",
            "max-age=63072000; includeSubDomains",
        )
        headers.setdefault("X-Content-Type-Options", "nosniff")
        headers.setdefault("X-Frame-Options", "DENY")
        headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        return response
