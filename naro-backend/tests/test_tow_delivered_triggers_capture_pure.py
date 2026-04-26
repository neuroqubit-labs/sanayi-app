from __future__ import annotations

import logging
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.api.v1.routes.tow import dispatch as tow_dispatch_route
from app.models.tow import TowSettlementStatus


@pytest.mark.asyncio
async def test_delivered_capture_uses_quoted_amount(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    case = SimpleNamespace(id=uuid4())
    settlement = SimpleNamespace(
        preauth_id="preauth_123",
        state=TowSettlementStatus.PRE_AUTH_HOLDING,
        quoted_amount=Decimal("1250.00"),
        cap_amount=Decimal("1500.00"),
    )
    monkeypatch.setattr(
        tow_dispatch_route.tow_repo,
        "get_settlement_by_case",
        AsyncMock(return_value=settlement),
    )
    capture_final = AsyncMock()
    monkeypatch.setattr(
        tow_dispatch_route.payment_svc, "capture_final", capture_final
    )

    actor_user_id = uuid4()
    captured = await tow_dispatch_route._capture_delivered_settlement_if_ready(
        SimpleNamespace(),  # type: ignore[arg-type]
        case=case,  # type: ignore[arg-type]
        psp=SimpleNamespace(),  # type: ignore[arg-type]
        actor_user_id=actor_user_id,
    )

    assert captured is True
    capture_final.assert_awaited_once()
    assert capture_final.await_args.kwargs["case"] == case
    assert capture_final.await_args.kwargs["actual_amount"] == Decimal("1250.00")
    assert capture_final.await_args.kwargs["actor_user_id"] == actor_user_id


@pytest.mark.asyncio
async def test_delivered_capture_skips_when_preauth_missing(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    case = SimpleNamespace(id=uuid4())
    settlement = SimpleNamespace(
        preauth_id=None,
        state=TowSettlementStatus.PRE_AUTH_HOLDING,
        quoted_amount=Decimal("1250.00"),
        cap_amount=Decimal("1500.00"),
    )
    monkeypatch.setattr(
        tow_dispatch_route.tow_repo,
        "get_settlement_by_case",
        AsyncMock(return_value=settlement),
    )
    capture_final = AsyncMock()
    monkeypatch.setattr(
        tow_dispatch_route.payment_svc, "capture_final", capture_final
    )

    caplog.set_level(logging.INFO, logger=tow_dispatch_route.__name__)
    captured = await tow_dispatch_route._capture_delivered_settlement_if_ready(
        SimpleNamespace(),  # type: ignore[arg-type]
        case=case,  # type: ignore[arg-type]
        psp=SimpleNamespace(),  # type: ignore[arg-type]
        actor_user_id=uuid4(),
    )

    assert captured is False
    capture_final.assert_not_awaited()
    assert "preauth missing" in caplog.text


@pytest.mark.asyncio
async def test_delivered_capture_is_route_level_idempotent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    case = SimpleNamespace(id=uuid4())
    settlement = SimpleNamespace(
        id=uuid4(),
        preauth_id="preauth_123",
        state=TowSettlementStatus.FINAL_CHARGED,
        quoted_amount=Decimal("1250.00"),
        cap_amount=Decimal("1500.00"),
    )
    monkeypatch.setattr(
        tow_dispatch_route.tow_repo,
        "get_settlement_by_case",
        AsyncMock(return_value=settlement),
    )
    capture_final = AsyncMock()
    monkeypatch.setattr(
        tow_dispatch_route.payment_svc, "capture_final", capture_final
    )

    captured = await tow_dispatch_route._capture_delivered_settlement_if_ready(
        SimpleNamespace(),  # type: ignore[arg-type]
        case=case,  # type: ignore[arg-type]
        psp=SimpleNamespace(),  # type: ignore[arg-type]
        actor_user_id=uuid4(),
    )

    assert captured is False
    capture_final.assert_not_awaited()
