from __future__ import annotations

from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.models.case import TowDispatchStage
from app.models.payment import PaymentMode, PaymentState, PaymentSubjectType
from app.schemas.payment import PaymentInitiateResponse, PaymentSnapshot
from app.schemas.tow import TowDispatchStageSchema, tow_phase, tow_stage_label


def test_payment_core_enums_cover_v1_subjects() -> None:
    assert PaymentSubjectType.TOW_CASE.value == "tow_case"
    assert PaymentSubjectType.SERVICE_CASE.value == "service_case"
    assert PaymentSubjectType.CASE_APPROVAL.value == "case_approval"
    assert PaymentSubjectType.CAMPAIGN_PURCHASE.value == "campaign_purchase"
    assert PaymentMode.PREAUTH_CAPTURE.value == "preauth_capture"
    assert PaymentMode.DIRECT_CAPTURE.value == "direct_capture"
    assert PaymentState.PAYMENT_REQUIRED.value == "payment_required"
    assert PaymentState.PREAUTH_HELD.value == "preauth_held"
    assert PaymentState.CAPTURE_REQUESTED.value == "capture_requested"
    assert PaymentState.CAPTURED.value == "captured"


def test_tow_payment_required_stage_projection() -> None:
    assert TowDispatchStage.PAYMENT_REQUIRED.value == "payment_required"
    stage = TowDispatchStageSchema.PAYMENT_REQUIRED
    assert tow_stage_label(stage) == "Ödeme bekleniyor"
    assert tow_phase(stage) == "payment"


def test_payment_dtos_are_public_safe() -> None:
    initiate_fields = set(PaymentInitiateResponse.model_fields)
    assert "checkout_url" in initiate_fields
    assert "payment_attempt_id" in initiate_fields
    assert "card_number" not in initiate_fields
    assert "cvv" not in initiate_fields

    snapshot_fields = set(PaymentSnapshot.model_fields)
    assert "state" in snapshot_fields
    assert "retryable" in snapshot_fields
    assert "card_number" not in snapshot_fields
    assert "cvv" not in snapshot_fields


def test_payment_model_and_schema_do_not_define_raw_card_fields() -> None:
    root = Path(__file__).parents[1] / "app"
    checked = [
        root / "models" / "payment.py",
        root / "schemas" / "payment.py",
    ]
    forbidden = ("card_number", "cardnumber", "cvv", "cvc")
    for path in checked:
        content = path.read_text(encoding="utf-8").lower()
        for token in forbidden:
            assert token not in content, f"{token} leaked into {path}"


def test_payment_core_normalizes_enum_and_string_values() -> None:
    from app.services import payment_core

    assert payment_core._enum_value(PaymentSubjectType.TOW_CASE) == "tow_case"
    assert payment_core._enum_value("tow_case") == "tow_case"
    assert payment_core._enum_value(PaymentMode.PREAUTH_CAPTURE) == "preauth_capture"
    assert payment_core._enum_value("payment_required") == "payment_required"


@pytest.mark.asyncio
async def test_payment_snapshot_accepts_string_backed_model_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import payment_core

    order = SimpleNamespace(
        id=uuid4(),
        state="payment_required",
        amount=Decimal("1311.00"),
        currency="TRY",
    )
    monkeypatch.setattr(
        payment_core,
        "get_payment_order",
        AsyncMock(return_value=order),
    )

    snapshot = await payment_core.payment_snapshot_for_case(
        SimpleNamespace(),  # type: ignore[arg-type]
        uuid4(),
    )

    assert snapshot is not None
    assert snapshot.state == "payment_required"
    assert snapshot.amount_label == "En fazla ₺1.311"
    assert snapshot.retryable is True
    assert snapshot.next_action == "initiate_payment"


def test_production_rejects_mock_psp(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import config as config_mod

    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("PAYMENT_PLATFORM_MODEL", "marketplace")
    monkeypatch.setenv("PSP_PROVIDER", "mock")
    config_mod.get_settings.cache_clear()  # type: ignore[attr-defined]
    with pytest.raises(ValueError, match="PSP_PROVIDER=mock"):
        config_mod.get_settings()
    config_mod.get_settings.cache_clear()  # type: ignore[attr-defined]


def test_production_requires_marketplace_payment_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core import config as config_mod

    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("PAYMENT_PLATFORM_MODEL", "standard_sandbox")
    monkeypatch.setenv("PSP_PROVIDER", "iyzico")
    monkeypatch.setenv("IYZICO_API_KEY", "sandbox-key")
    monkeypatch.setenv("IYZICO_SECRET_KEY", "sandbox-secret")
    monkeypatch.setenv("IYZICO_CALLBACK_URL", "https://example.test/cb")
    config_mod.get_settings.cache_clear()  # type: ignore[attr-defined]
    with pytest.raises(ValueError, match="PAYMENT_PLATFORM_MODEL=marketplace"):
        config_mod.get_settings()
    config_mod.get_settings.cache_clear()  # type: ignore[attr-defined]


def test_production_iyzico_requires_checkout_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core import config as config_mod

    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("PAYMENT_PLATFORM_MODEL", "marketplace")
    monkeypatch.setenv("PSP_PROVIDER", "iyzico")
    monkeypatch.setenv("IYZICO_API_KEY", "")
    monkeypatch.setenv("IYZICO_SECRET_KEY", "")
    monkeypatch.setenv("IYZICO_CALLBACK_URL", "")
    config_mod.get_settings.cache_clear()  # type: ignore[attr-defined]
    with pytest.raises(ValueError, match="IYZICO_API_KEY"):
        config_mod.get_settings()
    config_mod.get_settings.cache_clear()  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_tow_preauth_replay_does_not_start_second_dispatch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.models.case import ServiceCase, TowMode
    from app.models.case_subtypes import TowCase
    from app.services import payment_core

    case_id = uuid4()
    customer_id = uuid4()
    order = SimpleNamespace(
        id=uuid4(),
        subject_type=PaymentSubjectType.TOW_CASE,
        subject_id=case_id,
        amount=Decimal("1200.00"),
    )
    case = SimpleNamespace(id=case_id, customer_user_id=customer_id)
    tow_case = SimpleNamespace(
        tow_mode=TowMode.IMMEDIATE,
        tow_stage=TowDispatchStage.SEARCHING,
        scheduled_at=None,
    )

    class FakeSession:
        async def get(self, model: object, item_id: object) -> object | None:
            if model is ServiceCase:
                return case
            if model is TowCase:
                return tow_case
            return None

    monkeypatch.setattr(
        payment_core.tow_repo,
        "get_settlement_by_case",
        AsyncMock(return_value=SimpleNamespace(id=uuid4())),
    )
    monkeypatch.setattr(
        payment_core.tow_repo,
        "update_settlement_state",
        AsyncMock(return_value=None),
    )
    monkeypatch.setattr(
        payment_core.tow_repo,
        "update_tow_stage_with_lock",
        AsyncMock(return_value=False),
    )
    dispatch = AsyncMock()
    monkeypatch.setattr(payment_core.tow_dispatch, "initiate_dispatch", dispatch)
    monkeypatch.setattr(payment_core, "append_event", AsyncMock(return_value=None))

    await payment_core._mark_tow_preauth_held(
        FakeSession(),  # type: ignore[arg-type]
        order,  # type: ignore[arg-type]
        provider_ref="pay-1",
        psp_response={},
        redis=None,
    )

    dispatch.assert_not_called()


@pytest.mark.asyncio
async def test_scheduled_tow_preauth_before_due_waits_for_scheduled_dispatch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from datetime import UTC, datetime, timedelta

    from app.models.case import ServiceCase, TowMode
    from app.models.case_subtypes import TowCase
    from app.services import payment_core

    case_id = uuid4()
    customer_id = uuid4()
    order = SimpleNamespace(
        id=uuid4(),
        subject_type=PaymentSubjectType.TOW_CASE,
        subject_id=case_id,
        amount=Decimal("1200.00"),
    )
    case = SimpleNamespace(id=case_id, customer_user_id=customer_id, status=None)
    tow_case = SimpleNamespace(
        tow_mode=TowMode.SCHEDULED,
        tow_stage=TowDispatchStage.PAYMENT_REQUIRED,
        scheduled_at=datetime.now(UTC) + timedelta(hours=2),
    )

    class FakeSession:
        async def get(self, model: object, item_id: object) -> object | None:
            if model is ServiceCase:
                return case
            if model is TowCase:
                return tow_case
            return None

    monkeypatch.setattr(
        payment_core.tow_repo,
        "get_settlement_by_case",
        AsyncMock(return_value=SimpleNamespace(id=uuid4())),
    )
    monkeypatch.setattr(
        payment_core.tow_repo,
        "update_settlement_state",
        AsyncMock(return_value=None),
    )
    update_stage = AsyncMock(return_value=True)
    monkeypatch.setattr(
        payment_core.tow_repo,
        "update_tow_stage_with_lock",
        update_stage,
    )
    dispatch = AsyncMock()
    monkeypatch.setattr(payment_core.tow_dispatch, "initiate_dispatch", dispatch)
    monkeypatch.setattr(payment_core, "append_event", AsyncMock(return_value=None))

    await payment_core._mark_tow_preauth_held(
        FakeSession(),  # type: ignore[arg-type]
        order,  # type: ignore[arg-type]
        provider_ref="pay-1",
        psp_response={},
        redis=None,
    )

    assert tow_case.tow_stage == TowDispatchStage.SCHEDULED_WAITING
    assert update_stage.call_args.kwargs["to_stage"] == TowDispatchStage.SCHEDULED_WAITING
    dispatch.assert_not_called()


@pytest.mark.asyncio
async def test_late_success_for_abandoned_attempt_voids_even_if_order_already_held(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import payment_core

    attempt = SimpleNamespace(
        id=uuid4(),
        order_id=uuid4(),
        state=PaymentState.CANCELLED,
        provider_conversation_id="conv-1",
        provider_payment_id=None,
        completed_at=None,
        raw_response=None,
    )
    order = SimpleNamespace(
        id=attempt.order_id,
        state=PaymentState.PREAUTH_HELD,
        case_id=uuid4(),
        subject_id=uuid4(),
        subject_type=PaymentSubjectType.TOW_CASE,
    )

    class FakeResult:
        def __init__(self, item: object | None) -> None:
            self.item = item

        def scalar_one_or_none(self) -> object | None:
            return self.item

    class FakeSession:
        def __init__(self) -> None:
            self.calls = 0

        async def execute(self, stmt: object) -> FakeResult:
            self.calls += 1
            return FakeResult(attempt if self.calls == 1 else order)

    psp = SimpleNamespace(
        get_payment_detail=AsyncMock(
            return_value=SimpleNamespace(
                success=True,
                raw={"status": "success"},
                provider_ref="preauth-abandoned",
            ),
        ),
        void_preauth=AsyncMock(return_value=SimpleNamespace(raw={"status": "voided"})),
    )
    monkeypatch.setattr(payment_core, "append_event", AsyncMock(return_value=None))

    handled = await payment_core.process_payment_callback(
        FakeSession(),  # type: ignore[arg-type]
        conversation_id="conv-1",
        payment_id="pay-1",
        psp=psp,  # type: ignore[arg-type]
    )

    assert handled is True
    psp.void_preauth.assert_awaited_once()
    assert order.state == PaymentState.PREAUTH_HELD
    assert attempt.raw_response["void_result"] == {"status": "voided"}
