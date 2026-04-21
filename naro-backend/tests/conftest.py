"""Test fixtures — pytest-asyncio session-scoped event loop + engine dispose.

Amaç: pytest-asyncio `auto` mode her teste yeni event_loop açar; `AsyncSessionLocal`
modül seviyesinde tek engine tutar → asyncpg `Future attached to different loop`
cross-test hatası. Session-scoped event_loop + per-session engine dispose ile çöz.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio

from app.db.session import engine


@pytest.fixture(scope="session")
def event_loop() -> AsyncIterator[asyncio.AbstractEventLoop]:
    """Tek event loop session boyunca — asyncpg engine stabil kalır."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _dispose_engine_at_session_end() -> AsyncIterator[None]:
    yield
    await engine.dispose()
