"""Taxonomy + public view Redis cache helper.

Pattern: `shell_config:{user_id}:{version}`'i reuse — taxonomy için:
- `taxonomy:{resource}:{filter}:v1` TTL 3600s (1h)

Public technician cache:
- `tech_public:{tech_id}:{role_config_version}` TTL 300s (5m)
- `tech_feed:{cursor?}:{limit}:v1` TTL 60s (1m)

Read-only cache (taxonomy read-only, tech_public role_config_version'la
otomatik invalidate). Mutation patlamasında TTL yeter.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Sequence
from typing import Any, TypeVar
from uuid import UUID

from pydantic import BaseModel
from redis.asyncio import Redis

TAXONOMY_TTL_SECONDS = 3600
PUBLIC_PROFILE_TTL_SECONDS = 300
PUBLIC_FEED_TTL_SECONDS = 60

T = TypeVar("T", bound=BaseModel)


def taxonomy_key(resource: str, filter_: str | None = None) -> str:
    filter_part = filter_ or ""
    return f"taxonomy:{resource}:{filter_part}:v1"


def public_profile_key(tech_id: UUID, role_config_version: int) -> str:
    return f"tech_public:{tech_id}:{role_config_version}"


def public_feed_key(*, cursor: str | None, limit: int) -> str:
    cursor_part = cursor or ""
    return f"tech_feed:{cursor_part}:{limit}:v1"


async def get_cached_list(  # noqa: UP047
    redis: Redis, *, key: str, model: type[T]
) -> list[T] | None:
    raw = await redis.get(key)
    if raw is None:
        return None
    try:
        payload_str = raw if isinstance(raw, str) else raw.decode()
        items = json.loads(payload_str)
        if not isinstance(items, list):
            return None
        return [model.model_validate(item) for item in items]
    except (ValueError, json.JSONDecodeError):
        return None


async def set_cached_list(
    redis: Redis, *, key: str, items: Sequence[BaseModel], ttl: int
) -> None:
    payload = [item.model_dump(mode="json") for item in items]
    await redis.set(key, json.dumps(payload, default=str), ex=ttl)


async def get_cached_model(  # noqa: UP047
    redis: Redis, *, key: str, model: type[T]
) -> T | None:
    raw = await redis.get(key)
    if raw is None:
        return None
    try:
        payload_str = raw if isinstance(raw, str) else raw.decode()
        return model.model_validate_json(payload_str)
    except (ValueError, json.JSONDecodeError):
        return None


async def set_cached_model(
    redis: Redis, *, key: str, value: BaseModel, ttl: int
) -> None:
    await redis.set(key, value.model_dump_json(), ex=ttl)


async def fetch_or_cache_list(  # noqa: UP047
    redis: Redis,
    *,
    key: str,
    model: type[T],
    ttl: int,
    loader: Callable[[], Any],
) -> list[T]:
    """Cache-aside pattern — miss'te loader çağır + cache'e koy.

    Loader async fonksiyon; list[T] döner.
    """
    cached = await get_cached_list(redis, key=key, model=model)
    if cached is not None:
        return cached
    fresh: list[T] = await loader()
    if fresh:
        await set_cached_list(redis, key=key, items=fresh, ttl=ttl)
    return fresh
