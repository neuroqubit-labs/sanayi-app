"""Rate limit middleware — slowapi + Redis token bucket.

Faz 10e: temel skeleton. Per-endpoint custom limits main.py ile bağlanır.
V1'de default limiter mevcut; /tow/cases POST, /tow/dispatch/response vb. için
ekstra limiter router katmanında `@limiter.limit("5/minute")` decorator'ı.
"""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address


def get_identifier(request: object) -> str:
    # Auth header varsa token prefix, yoksa IP
    try:
        auth = request.headers.get("authorization", "")  # type: ignore[attr-defined]
        if auth.startswith("Bearer "):
            return f"token:{auth[7:23]}"
    except Exception:
        pass
    return get_remote_address(request)  # type: ignore[arg-type]


def build_limiter() -> Limiter:
    return Limiter(key_func=get_identifier, default_limits=["120/minute"])
