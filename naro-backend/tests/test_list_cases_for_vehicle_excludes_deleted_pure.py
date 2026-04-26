from __future__ import annotations

from typing import Any
from uuid import uuid4

import pytest

from app.repositories import case as case_repo


class _FakeScalarResult:
    def all(self) -> list[object]:
        return []


class _FakeResult:
    def scalars(self) -> _FakeScalarResult:
        return _FakeScalarResult()


class _FakeSession:
    def __init__(self) -> None:
        self.statement: Any | None = None

    async def execute(self, stmt: Any) -> _FakeResult:
        self.statement = stmt
        return _FakeResult()


@pytest.mark.asyncio
async def test_list_cases_for_vehicle_excludes_deleted_cases() -> None:
    session = _FakeSession()

    result = await case_repo.list_cases_for_vehicle(session, uuid4())  # type: ignore[arg-type]

    assert result == []
    assert session.statement is not None
    compiled = str(session.statement.compile(compile_kwargs={"literal_binds": False}))
    assert "service_cases.vehicle_id" in compiled
    assert "service_cases.deleted_at IS NULL" in compiled
