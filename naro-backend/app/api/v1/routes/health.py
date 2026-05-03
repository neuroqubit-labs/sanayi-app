"""Liveness + readiness probe'ları.

- `/health` → liveness; sadece process ayakta mı. Hızlı, bağımlılık check'i yok.
- `/ready`  → readiness; DB + Redis bağlanabilir mi, alembic head migration
   uygulanmış mı. Rolling restart'ta load balancer bunu izler. Bağımlılıklardan
   biri patlarsa 503 döner; trafik kesilir.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from pathlib import Path

import redis.asyncio as redis
from fastapi import APIRouter, Response, status
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import engine

router = APIRouter(tags=["health"])
_logger = logging.getLogger("naro.health")

_READY_TIMEOUT_SECONDS = 2.0


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


async def _check_db() -> tuple[bool, str | None]:
    try:
        async with asyncio.timeout(_READY_TIMEOUT_SECONDS):
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        return True, None
    except Exception as exc:  # bağlanılamaz → ready değil
        return False, f"{type(exc).__name__}: {exc}"


async def _check_redis() -> tuple[bool, str | None]:
    settings = get_settings()
    client: redis.Redis = redis.from_url(  # type: ignore[no-untyped-call]
        settings.redis_url, decode_responses=False
    )
    try:
        async with asyncio.timeout(_READY_TIMEOUT_SECONDS):
            pong = await client.ping()
        return bool(pong), None
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"
    finally:
        with contextlib.suppress(Exception):
            await client.aclose()


def _expected_alembic_head() -> str | None:
    """alembic/versions/ içindeki en son revision_id'yi heuristic olarak çıkar.

    Migration dosyası adı `<timestamp>_<idx>_<slug>.py` formatında; revision
    field'ı dosya içinde `revision = "..."`. Tüm dosyaları tarayıp `down_revision`
    set'inde olmayanı head sayarız. Hata yutulur — ready check sertleşmez.
    """

    try:
        versions = Path(__file__).resolve().parents[3] / "alembic" / "versions"
        revisions: dict[str, str | None] = {}
        for path in versions.glob("*.py"):
            text_blob = path.read_text(encoding="utf-8", errors="ignore")
            rev: str | None = None
            down: str | None = None
            for line in text_blob.splitlines():
                stripped = line.strip()
                if stripped.startswith("revision = ") and rev is None:
                    rev = stripped.split("=", 1)[1].strip().strip("\"'") or None
                if stripped.startswith("down_revision = ") and down is None:
                    raw = stripped.split("=", 1)[1].strip()
                    down = None if raw == "None" else raw.strip("\"'") or None
            if rev:
                revisions[rev] = down
        children = {d for d in revisions.values() if d}
        heads = [r for r in revisions if r not in children]
        if len(heads) == 1:
            return heads[0]
        return None
    except Exception:
        return None


async def _check_alembic() -> tuple[bool, str | None]:
    expected = _expected_alembic_head()
    if expected is None:
        return True, "skipped (head undetermined)"
    try:
        async with asyncio.timeout(_READY_TIMEOUT_SECONDS):
            async with engine.connect() as conn:
                row = (
                    await conn.execute(
                        text("SELECT version_num FROM alembic_version LIMIT 1")
                    )
                ).first()
        applied = row[0] if row else None
        if applied != expected:
            return False, f"applied={applied} expected={expected}"
        return True, None
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"


@router.get("/ready")
async def ready(response: Response) -> dict[str, object]:
    db_ok, db_err = await _check_db()
    redis_ok, redis_err = await _check_redis()
    alembic_ok, alembic_msg = await _check_alembic()

    checks = {
        "db": {"ok": db_ok, "error": db_err},
        "redis": {"ok": redis_ok, "error": redis_err},
        "alembic": {"ok": alembic_ok, "info": alembic_msg},
    }
    overall = db_ok and redis_ok and alembic_ok

    if not overall:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        _logger.warning("readiness probe failed: %s", checks)

    return {"status": "ready" if overall else "not_ready", "checks": checks}
