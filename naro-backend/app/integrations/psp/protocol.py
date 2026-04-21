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


class Psp(Protocol):
    """Ödeme sağlayıcı arayüzü — preauth + capture + refund + void."""

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
