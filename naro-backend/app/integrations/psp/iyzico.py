"""Iyzico PSP concrete (Faz B-2 — V1.1).

Sandbox credentials (IYZICO_API_KEY + IYZICO_SECRET_KEY) `.env`'de tanımlı
olduğunda aktif. Credentials boşsa (V1 default) → `NotImplementedError`.

Brief §5:
- `authorize_preauth` — 3DS WebView URL döner (create_checkout_form üzerinden)
- `capture` — pre-auth'un final tutarını tahsil et
- `refund` — partial/full iade
- `void_preauth` — hold release

**V1 default:** MockPsp kullanılır (`PSP_PROVIDER=mock`).
**V1.1 aktivasyon:** `PSP_PROVIDER=iyzico` + sandbox credentials → canlı.

**PCI DSS SAQ A:** Kart verisi asla BE'de görülmez. Kart bilgileri
Iyzico checkout form'undan (WebView) direkt Iyzico'ya gider; bize
`payment_id + token` callback'le döner.

**B-4 bayrağı:** V1'de stored card YOK — `useCardOnFile=false`. Tokenization
V1.1 sonrası (KVKK rıza).
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

try:
    import iyzipay  # type: ignore[import-untyped]

    _IYZIPAY_AVAILABLE = True
except ImportError:  # pragma: no cover
    _IYZIPAY_AVAILABLE = False

from app.integrations.psp.protocol import Psp, PspResult


class IyzicoConfigurationError(RuntimeError):
    """Credentials eksik — sandbox başvuru henüz tamamlanmamış."""


@dataclass(slots=True)
class CheckoutFormRequest:
    """3DS WebView URL isteği."""

    locale: str = "tr"
    conversation_id: str = ""
    price: str = "0.00"
    paid_price: str = "0.00"
    currency: str = "TRY"
    basket_id: str = ""
    payment_group: str = "PRODUCT"
    callback_url: str = ""
    buyer: dict[str, Any] | None = None
    shipping_address: dict[str, Any] | None = None
    billing_address: dict[str, Any] | None = None
    basket_items: list[dict[str, Any]] | None = None


class IyzicoPsp(Psp):
    """Iyzico concrete adapter.

    Iyzico SDK (`iyzipay`) sync HTTP client — thread pool'a at, request
    path'i bloke etme (brief §9 red line). Config object reuse.
    """

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        secret_key: str,
    ) -> None:
        if not _IYZIPAY_AVAILABLE:
            raise IyzicoConfigurationError("iyzipay SDK not installed")
        if not api_key or not secret_key:
            raise IyzicoConfigurationError(
                "Iyzico API key/secret required (sandbox başvuru bekleniyor)"
            )
        self._base_url = base_url
        self._options: dict[str, str] = {
            "api_key": api_key,
            "secret_key": secret_key,
            "base_url": base_url,
        }

    # ─── Protocol methods (tow + billing ortak) ─────────────────────────

    async def authorize_preauth(
        self,
        *,
        idempotency_key: str,
        customer_token: str,
        amount: Decimal,
        currency: str,
        case_id: str,
    ) -> PspResult:
        """Pre-auth hold. V1.1'de concrete — V1'de credentials yoksa raise.

        Iyzico payment/auth non-3DS token-based (stored card) veya
        3DS checkout form akışı. V1'de stored card yok (B-4), bu method
        doğrudan çağrılmaz; müşteri akışı `create_checkout_form` üzerinden
        geçer.
        """
        raise NotImplementedError(
            "authorize_preauth V1.1'de concrete — müşteri akışı "
            "create_checkout_form + webhook callback üzerinden."
        )

    async def capture(
        self,
        *,
        idempotency_key: str,
        preauth_id: str,
        amount: Decimal,
        currency: str,
    ) -> PspResult:
        """payment/auth capture endpoint."""
        payload = {
            "locale": "tr",
            "conversationId": idempotency_key,
            "paymentId": preauth_id,
            "paidPrice": str(amount),
        }
        return await self._run_sdk_call("capture", payload)

    async def refund(
        self,
        *,
        idempotency_key: str,
        capture_id: str,
        amount: Decimal,
        currency: str,
        reason: str,
    ) -> PspResult:
        """payment/refund (partial or full)."""
        payload = {
            "locale": "tr",
            "conversationId": idempotency_key,
            "paymentTransactionId": capture_id,
            "price": str(amount),
            "currency": currency,
            "ip": "127.0.0.1",  # placeholder — route'ta client IP geçilir
        }
        return await self._run_sdk_call("refund", payload)

    async def void_preauth(
        self,
        *,
        idempotency_key: str,
        preauth_id: str,
    ) -> PspResult:
        """payment/cancel — hold release."""
        payload = {
            "locale": "tr",
            "conversationId": idempotency_key,
            "paymentId": preauth_id,
            "ip": "127.0.0.1",
        }
        return await self._run_sdk_call("void", payload)

    # ─── 3DS checkout (billing-specific) ────────────────────────────────

    async def create_checkout_form(
        self, *, request: CheckoutFormRequest
    ) -> PspResult:
        """3DS WebView form URL üret. Mobile WebView'de açılır.

        Brief §5.3:
        1. Backend → Iyzico checkoutFormInitialize → token + checkoutFormContent (URL)
        2. Mobile WebView → URL yükle, 3DS flow bank ile
        3. Success → callback_url'e POST (webhook)
        """
        payload = {
            "locale": request.locale,
            "conversationId": request.conversation_id,
            "price": request.price,
            "paidPrice": request.paid_price,
            "currency": request.currency,
            "basketId": request.basket_id,
            "paymentGroup": request.payment_group,
            "callbackUrl": request.callback_url,
            "buyer": request.buyer or {},
            "shippingAddress": request.shipping_address or {},
            "billingAddress": request.billing_address or {},
            "basketItems": request.basket_items or [],
        }
        return await self._run_sdk_call("create_checkout_form", payload)

    async def get_payment_detail(self, *, payment_id: str) -> PspResult:
        """payment/detail — webhook fallback / polling."""
        payload = {"locale": "tr", "paymentId": payment_id}
        return await self._run_sdk_call("get_payment", payload)

    # ─── SDK wrapper (sync → async via thread) ──────────────────────────

    async def _run_sdk_call(
        self, operation: str, payload: dict[str, Any]
    ) -> PspResult:
        """iyzipay SDK sync — thread pool'a at."""

        def _sync_call() -> dict[str, Any]:
            if operation == "capture":
                raw = iyzipay.Payment().retrieve(payload, self._options)
            elif operation == "refund":
                raw = iyzipay.Refund().create(payload, self._options)
            elif operation == "void":
                raw = iyzipay.Cancel().create(payload, self._options)
            elif operation == "create_checkout_form":
                raw = iyzipay.CheckoutFormInitialize().create(
                    payload, self._options
                )
            elif operation == "get_payment":
                raw = iyzipay.Payment().retrieve(payload, self._options)
            else:
                raise NotImplementedError(f"operation={operation}")
            body = raw.read().decode("utf-8")
            return json.loads(body)  # type: ignore[no-any-return]

        data = await asyncio.to_thread(_sync_call)
        status = data.get("status")
        if status == "success":
            return PspResult(
                success=True,
                provider_ref=str(
                    data.get("paymentId")
                    or data.get("paymentTransactionId")
                    or data.get("token")
                    or ""
                ),
                raw=data,
            )
        return PspResult(
            success=False,
            provider_ref=None,
            raw=data,
            error_code=data.get("errorCode"),
            message=data.get("errorMessage"),
        )
