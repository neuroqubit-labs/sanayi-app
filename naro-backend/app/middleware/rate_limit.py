"""Rate limit middleware — slowapi + Redis token bucket.

Limiter app.state üzerinden tek instance; route decorator'ları
`@limiter.limit("5/minute")` veya benzeri kullanır. Disable, test ortamında
veya `RATE_LIMIT_ENABLED=false` env ile yapılır.

Kritik POST endpoint'lerinde abuse koruması:
- /auth/otp/request, /auth/otp/verify (brute force + spam)
- /users/me/push-tokens (token registry spam)
- /tow/cases (vaka açma flood)
- /tow/dispatch/response (operatöre spam onay)
"""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import Settings


def get_identifier(request: object) -> str:
    """Token varsa per-token, yoksa per-IP key."""

    try:
        auth = request.headers.get("authorization", "")  # type: ignore[attr-defined]
        if auth.startswith("Bearer "):
            return f"token:{auth[7:23]}"
    except Exception:
        pass
    return get_remote_address(request)  # type: ignore[arg-type]


def build_limiter(settings: Settings) -> Limiter:
    return Limiter(
        key_func=get_identifier,
        default_limits=[settings.rate_limit_default],
        enabled=settings.rate_limit_enabled,
        headers_enabled=True,
    )


_limiter: Limiter | None = None


def get_limiter() -> Limiter:
    """Module-level singleton — route decorator'ları import time okur.

    main.create_app içinde `app.state.limiter = get_limiter()` ile bağlanır;
    decorator'lı route'lar bu instance'ı paylaşır.
    """

    global _limiter
    if _limiter is None:
        from app.core.config import get_settings

        _limiter = build_limiter(get_settings())
    return _limiter
