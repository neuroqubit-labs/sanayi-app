"""Cursor-based pagination pattern — Faz A §12.3 ortak altyapı.

Tüm liste endpoint'leri aynı şablonu kullanır:

    @router.get("/resource")
    async def list_resource(
        cursor: str | None = Query(default=None),
        limit: int = Query(default=20, ge=1, le=50),
    ) -> PaginatedResponse[ResourceOut]:
        rows = await repo.list_after_cursor(decode_cursor(cursor), limit=limit + 1)
        return build_paginated(rows, limit, encode_cursor=lambda r: r.id.hex)

Cursor = opaque base64url(JSON {id, created_at}). Stateless, fail-safe: geçersiz
cursor → 400. Limit default 20, max 50.
"""

from __future__ import annotations

import base64
import json
from collections.abc import Callable
from datetime import datetime
from typing import Annotated, Generic, TypeVar
from uuid import UUID

from fastapi import HTTPException, Query, status
from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):  # noqa: UP046
    """Pydantic Generic[T] subclass — PEP 695 `class X[T]` syntax Pydantic
    v2 ile henüz uyumlu değil; explicit Generic kullanılır."""

    items: list[T]
    next_cursor: str | None = None


def encode_cursor(*, id_: UUID | str, sort_value: datetime | int | str | None) -> str:
    """Opaque cursor — base64url(json)."""
    payload = {
        "id": str(id_),
        "sort": sort_value.isoformat() if isinstance(sort_value, datetime) else sort_value,
    }
    raw = json.dumps(payload, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def decode_cursor(cursor: str | None) -> dict[str, object] | None:
    """Opaque cursor çöz; invalid → 400."""
    if cursor is None or cursor == "":
        return None
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        raw = base64.urlsafe_b64decode(padded.encode())
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            raise ValueError("cursor payload must be object")
        return payload
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"type": "invalid_cursor", "message": str(exc)},
        ) from exc


def build_paginated(  # noqa: UP047
    rows: list[T],
    *,
    limit: int,
    cursor_fn: Callable[[T], str],
) -> PaginatedResponse[T]:
    """`rows` uzunluğu limit+1 ise son elemanı next_cursor için kullan + kırp."""
    has_more = len(rows) > limit
    items = rows[:limit]
    next_cursor = cursor_fn(items[-1]) if has_more and items else None
    return PaginatedResponse(items=items, next_cursor=next_cursor)


# ─── Query dep shortcut ────────────────────────────────────────────────────

CursorQuery = Annotated[str | None, Query(description="Opaque pagination cursor")]
LimitQuery = Annotated[int, Query(ge=1, le=50, description="Max items")]
