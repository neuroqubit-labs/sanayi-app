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
from decimal import Decimal
from typing import Any

try:
    import iyzipay  # type: ignore[import-untyped]

    _IYZIPAY_AVAILABLE = True
except ImportError:  # pragma: no cover
    _IYZIPAY_AVAILABLE = False

from app.integrations.psp.protocol import CheckoutFormResult, Psp, PspResult


class IyzicoConfigurationError(RuntimeError):
    """Credentials eksik — sandbox başvuru henüz tamamlanmamış."""


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
        # iyzipay SDK scheme kabul etmiyor — https://host → host normalize
        self._base_url = base_url.replace("https://", "").replace(
            "http://", ""
        ).rstrip("/")
        self._options: dict[str, str] = {
            "api_key": api_key,
            "secret_key": secret_key,
            "base_url": self._base_url,
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
        self,
        *,
        conversation_id: str,
        amount: Decimal,
        currency: str = "TRY",
        callback_url: str = "",
        buyer: dict[str, Any] | None = None,
        basket_items: list[dict[str, Any]] | None = None,
    ) -> CheckoutFormResult:
        """3DS WebView form URL üret (Iyzico checkoutFormInitialize).

        Brief §5.3:
        1. Backend → Iyzico checkoutFormInitialize → token + checkoutFormContent
        2. Mobile WebView → URL yükle, 3DS flow bank ile
        3. Success → callback_url'e POST (webhook)
        """
        # Default buyer — Iyzico şema zorunlu alanları için placeholder
        default_buyer: dict[str, Any] = buyer or {
            "id": f"buyer_{conversation_id[:8]}",
            "name": "Naro",
            "surname": "Musteri",
            "gsmNumber": "+905550000000",
            "email": "pilot@naro.app",
            "identityNumber": "11111111111",
            "registrationAddress": "Kayseri",
            "city": "Kayseri",
            "country": "Turkey",
        }
        default_basket_items: list[dict[str, Any]] = basket_items or [
            {
                "id": f"item_{conversation_id[:8]}",
                "name": "Naro servis",
                "category1": "Vehicle Service",
                "itemType": "VIRTUAL",
                "price": str(amount),
            }
        ]
        payload = {
            "locale": "tr",
            "conversationId": conversation_id,
            "price": str(amount),
            "paidPrice": str(amount),
            "currency": currency,
            "basketId": f"basket_{conversation_id[:12]}",
            "paymentGroup": "PRODUCT",
            "callbackUrl": callback_url,
            "buyer": default_buyer,
            "shippingAddress": {
                "contactName": default_buyer["name"],
                "city": default_buyer["city"],
                "country": default_buyer["country"],
                "address": default_buyer["registrationAddress"],
            },
            "billingAddress": {
                "contactName": default_buyer["name"],
                "city": default_buyer["city"],
                "country": default_buyer["country"],
                "address": default_buyer["registrationAddress"],
            },
            "basketItems": default_basket_items,
            "enabledInstallments": [1, 2, 3, 6, 9],
        }
        result = await self._run_sdk_call("create_checkout_form", payload)
        if not result.success:
            return CheckoutFormResult(
                checkout_url="",
                conversation_id=conversation_id,
                provider_token=None,
                raw=result.raw,
            )
        raw = result.raw or {}
        # Iyzico: paymentPageUrl veya checkoutFormContent (HTML fragment)
        checkout_url = str(raw.get("paymentPageUrl") or "")
        token = str(raw.get("token") or "")
        return CheckoutFormResult(
            checkout_url=checkout_url,
            conversation_id=conversation_id,
            provider_token=token,
            raw=dict(raw),
        )

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
