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


def _alembic_versions_dir() -> Path | None:
    """alembic/versions yolunu container/local/test'te robust bul.

    Aramada öncelik:
      1. NARO_ALEMBIC_VERSIONS env (override)
      2. Bu dosyadan yukarı tırmanarak `alembic/versions` ilk eşleşme
         (Container `/app/alembic/versions`, repo `naro-backend/alembic/versions`)
      3. CWD altındaki `alembic/versions`
    """

    import os

    explicit = os.environ.get("NARO_ALEMBIC_VERSIONS")
    if explicit:
        path = Path(explicit)
        if path.is_dir():
            return path

    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / "alembic" / "versions"
        if candidate.is_dir():
            return candidate

    cwd_candidate = Path.cwd() / "alembic" / "versions"
    if cwd_candidate.is_dir():
        return cwd_candidate
    return None


def _expected_alembic_head() -> str | None:
    """alembic/versions içindeki tek head revision_id'yi çıkar.

    Migration dosyalarında `revision = "..."` ve `down_revision = "..."` alanları
    parse edilir; başka revision'ın `down_revision`'ı olmayan = head. Birden çok
    head varsa None döner — ready False değil "skipped" olur.
    """

    try:
        versions = _alembic_versions_dir()
        if versions is None:
            return None
        import re

        # Alembic 1.13+ migration template: `revision: str = "..."` (type annotated).
        # Eski format `revision = "..."` da olabilir; ikisini de yakala.
        rev_re = re.compile(r"^\s*revision(?:\s*:\s*[^=]+)?\s*=\s*[\"']([^\"']+)[\"']")
        down_re = re.compile(r"^\s*down_revision(?:\s*:\s*[^=]+)?\s*=\s*(.+)")
        revisions: dict[str, str | None] = {}
        for path in versions.glob("*.py"):
            text_blob = path.read_text(encoding="utf-8", errors="ignore")
            rev: str | None = None
            down: str | None = None
            for line in text_blob.splitlines():
                if rev is None:
                    m = rev_re.match(line)
                    if m:
                        rev = m.group(1)
                if down is None:
                    m = down_re.match(line)
                    if m:
                        raw = m.group(1).strip()
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
