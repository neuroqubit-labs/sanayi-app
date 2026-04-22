"""PSP Protocol — authorize / capture / refund / void interface.

V1: MockPsp default. V1.1: Iyzico sandbox switch via `PSP_PROVIDER=iyzico`.
Service layer tüm çağrıları `app.repositories.tow.write_idempotency` ile wrap
eder (durable replay cache — aynı idempotency_key 24h aynı response).
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol


@dataclass(slots=True)
class PspResult:
    success: bool
    provider_ref: str | None
    raw: dict[str, object]
    error_code: str | None = None
    message: str | None = None


@dataclass(slots=True)
class CheckoutFormResult:
    """Billing 3DS checkout form — mobil WebView'e URL dönen payload."""

    checkout_url: str
    conversation_id: str
    # Iyzico 'token' — later used in get_payment_detail
    provider_token: str | None = None
    raw: dict[str, object] | None = None


class Psp(Protocol):
    """Ödeme sağlayıcı arayüzü — preauth + capture + refund + void.

    Billing 3DS flow için create_checkout_form + get_payment_detail de
    ekli (V1.1 Iyzico concrete; MockPsp dev fake).
    """

    async def authorize_preauth(
        self,
        *,
        idempotency_key: str,
        customer_token: str,
        amount: Decimal,
        currency: str,
        case_id: str,
    ) -> PspResult:
        """Pre-authorize cap_amount. Fail → PaymentDeclinedError."""
        ...

    async def capture(
        self,
        *,
        idempotency_key: str,
        preauth_id: str,
        amount: Decimal,
        currency: str,
    ) -> PspResult:
        """Capture final_amount (≤ cap)."""
        ...

    async def refund(
        self,
        *,
        idempotency_key: str,
        capture_id: str,
        amount: Decimal,
        currency: str,
        reason: str,
    ) -> PspResult:
        """Partial or full refund."""
        ...

    async def void_preauth(
        self,
        *,
        idempotency_key: str,
        preauth_id: str,
    ) -> PspResult:
        """Release authorization hold."""
        ...

    async def create_checkout_form(
        self,
        *,
        conversation_id: str,
        amount: Decimal,
        currency: str = "TRY",
        callback_url: str = "",
    ) -> CheckoutFormResult:
        """3DS WebView form URL üret (billing flow — B-4 stored card yok)."""
        ...

    async def get_payment_detail(self, *, payment_id: str) -> PspResult:
        """Webhook callback sonrası payment state doğrula."""
        ...
