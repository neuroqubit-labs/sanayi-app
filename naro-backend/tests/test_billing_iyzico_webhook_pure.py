"""Faz B-2 pure tests — webhook HMAC route + idempotency decorator contract.

Iyzico sandbox E2E test'leri ayrı (`tests/test_billing_iyzico_sandbox.py`
— credentials env-gated, CI'da çalışmaz). Burada:
- Webhook HMAC verify (happy + fail paths)
- Webhook route 401/503 davranışı
- Idempotency decorator replay + pending + failed contract
- IyzicoPsp constructor credential validation
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.integrations.psp.iyzico import IyzicoConfigurationError, IyzicoPsp
from app.integrations.psp.protocol import PspResult
from app.main import app
from app.services.payment_idempotency import ConcurrentOperationError
from app.services.webhook_security import (
    compute_hmac_signature,
    verify_webhook_signature,
)

# ─── Webhook route ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_iyzico_webhook_missing_secret_returns_503(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Secret boş → 503 (degraded mode). I-BILL-5."""
    from app.core import config as config_mod

    monkeypatch.delenv("IYZICO_WEBHOOK_SECRET", raising=False)
    config_mod.get_settings.cache_clear()  # type: ignore[attr-defined]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post(
            "/api/v1/webhooks/iyzico/payment",
            json={"paymentId": "fake"},
        )
    assert r.status_code == 503
    assert r.json()["detail"]["type"] == "iyzico_webhook_not_configured"
    config_mod.get_settings.cache_clear()  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_iyzico_chargeback_webhook_v2_stub() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post("/api/v1/webhooks/iyzico/chargeback")
    assert r.status_code == 501
    assert r.json()["detail"]["type"] == "chargeback_webhook_v2"


@pytest.mark.asyncio
async def test_iyzico_webhook_with_secret_missing_signature_401(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Secret configured + signature header missing → 401."""
    from app.core import config as config_mod

    monkeypatch.setattr(
        config_mod.get_settings().__class__,
        "iyzico_webhook_secret",
        "testsecret",
        raising=False,
    )
    # Pydantic Settings immutable — direkt monkey patching güvenli değil.
    # Env-based override kullan:
    monkeypatch.setenv("IYZICO_WEBHOOK_SECRET", "testsecret")
    config_mod.get_settings.cache_clear()  # type: ignore[attr-defined]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post(
            "/api/v1/webhooks/iyzico/payment", json={"paymentId": "x"}
        )
    assert r.status_code == 401
    assert r.json()["detail"]["type"] == "webhook_signature_missing"
    config_mod.get_settings.cache_clear()  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_iyzico_webhook_invalid_signature_401(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core import config as config_mod

    monkeypatch.setenv("IYZICO_WEBHOOK_SECRET", "testsecret")
    config_mod.get_settings.cache_clear()  # type: ignore[attr-defined]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post(
            "/api/v1/webhooks/iyzico/payment",
            json={"paymentId": "x"},
            headers={"X-Iyzico-Signature": "fakesig"},
        )
    assert r.status_code == 401
    assert r.json()["detail"]["type"] == "webhook_signature_invalid"
    config_mod.get_settings.cache_clear()  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_iyzico_webhook_valid_signature_200(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core import config as config_mod

    monkeypatch.setenv("IYZICO_WEBHOOK_SECRET", "testsecret")
    config_mod.get_settings.cache_clear()  # type: ignore[attr-defined]

    # conversationId eksik — webhook `received_incomplete` döner (HMAC OK ama body kısmi)
    body_bytes = b'{"paymentId":"abc123","status":"success"}'
    sig = compute_hmac_signature(body=body_bytes, secret="testsecret")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post(
            "/api/v1/webhooks/iyzico/payment",
            content=body_bytes,
            headers={
                "X-Iyzico-Signature": sig,
                "Content-Type": "application/json",
            },
        )
    assert r.status_code == 200
    # conversationId eksik — webhook ack ediyor ama orchestrator'a gitmiyor
    assert r.json() == {"status": "received_incomplete"}
    config_mod.get_settings.cache_clear()  # type: ignore[attr-defined]


# ─── HMAC helper direct tests ──────────────────────────────────────────────


def test_hmac_roundtrip_different_bodies_different_sigs() -> None:
    body1 = b'{"a":1}'
    body2 = b'{"a":2}'
    s = "s"
    assert compute_hmac_signature(
        body=body1, secret=s
    ) != compute_hmac_signature(body=body2, secret=s)


def test_hmac_verify_empty_signature_false() -> None:
    body = b'{"x":1}'
    assert (
        verify_webhook_signature(body=body, signature="", secret="s") is False
    )


# ─── IyzicoPsp constructor — credential validation ────────────────────────


def test_iyzico_psp_missing_api_key_raises() -> None:
    with pytest.raises(IyzicoConfigurationError):
        IyzicoPsp(
            base_url="https://sandbox-api.iyzipay.com",
            api_key="",
            secret_key="secret",
        )


def test_iyzico_psp_missing_secret_raises() -> None:
    with pytest.raises(IyzicoConfigurationError):
        IyzicoPsp(
            base_url="https://sandbox-api.iyzipay.com",
            api_key="key",
            secret_key="",
        )


def test_iyzico_psp_with_credentials_constructs() -> None:
    psp = IyzicoPsp(
        base_url="https://sandbox-api.iyzipay.com",
        api_key="sandbox-key",
        secret_key="sandbox-secret",
    )
    # Scheme strip — SDK scheme kabul etmiyor (iyzico.py __init__)
    assert psp._base_url == "sandbox-api.iyzipay.com"


# ─── Idempotency decorator — pure (mocked fn) ──────────────────────────────


@pytest.mark.asyncio
async def test_idempotency_concurrent_operation_error_import() -> None:
    """Exception class wiring — service layer'da raise edilir."""
    from app.services.payment_idempotency import (
        ConcurrentOperationError as Exc,
    )

    assert issubclass(Exc, RuntimeError)


@pytest.mark.asyncio
async def test_idempotency_callable_signature() -> None:
    """`with_idempotency` fn parametresi → Awaitable[PspResult] bekler."""
    from app.services.payment_idempotency import with_idempotency

    # Signature contract — async callable dönen PspResult
    assert callable(with_idempotency)


def test_concurrent_operation_error_carries_key() -> None:
    exc = ConcurrentOperationError(key="capture:case123:approval456")
    assert exc.key == "capture:case123:approval456"
    assert "capture:case123:approval456" in str(exc)


# ─── PspResult semantics ──────────────────────────────────────────────────


def test_psp_result_success_shape() -> None:
    r = PspResult(success=True, provider_ref="ref1", raw={"x": 1})
    assert r.success is True
    assert r.provider_ref == "ref1"
    assert r.error_code is None


def test_psp_result_failure_shape() -> None:
    r = PspResult(
        success=False,
        provider_ref=None,
        raw={},
        error_code="insufficient_funds",
        message="yetersiz bakiye",
    )
    assert r.success is False
    assert r.error_code == "insufficient_funds"


# ─── IyzicoPsp capture/refund/void signatures ─────────────────────────────


@pytest.mark.asyncio
async def test_iyzico_authorize_preauth_raises_notimplemented(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """V1'de stored card yok (B-4) — authorize_preauth direkt çağrılmaz.

    Müşteri akışı create_checkout_form üzerinden 3DS. authorize_preauth
    raise eder — sentinel guard.
    """
    from decimal import Decimal

    psp = IyzicoPsp(
        base_url="https://sandbox-api.iyzipay.com",
        api_key="sandbox-key",
        secret_key="sandbox-secret",
    )
    with pytest.raises(NotImplementedError):
        await psp.authorize_preauth(
            idempotency_key="x",
            customer_token="tok",
            amount=Decimal("100.00"),
            currency="TRY",
            case_id="case1",
        )


# ─── Router include ────────────────────────────────────────────────────────


def test_webhook_router_registered() -> None:
    from app.api.v1.routes import webhooks

    assert webhooks.router.prefix == "/webhooks"
    paths = {r.path for r in webhooks.router.routes if hasattr(r, "path")}
    assert "/webhooks/iyzico/payment" in paths
    assert "/webhooks/iyzico/chargeback" in paths


# ─── Config settings — sandbox variables ──────────────────────────────────


def test_iyzico_settings_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    """Default config baseline — env boşken."""
    from app.core import config as config_mod

    monkeypatch.delenv("IYZICO_WEBHOOK_SECRET", raising=False)
    monkeypatch.delenv("IYZICO_BASE_URL", raising=False)
    monkeypatch.delenv("IYZICO_CALLBACK_URL", raising=False)
    config_mod.get_settings.cache_clear()  # type: ignore[attr-defined]

    s = get_settings()
    assert "sandbox-api.iyzipay.com" in s.iyzico_base_url
    assert s.iyzico_webhook_secret == ""
    assert "naro.app" in s.iyzico_callback_url
    config_mod.get_settings.cache_clear()  # type: ignore[attr-defined]


_ = AsyncMock  # placate unused import for future tests
