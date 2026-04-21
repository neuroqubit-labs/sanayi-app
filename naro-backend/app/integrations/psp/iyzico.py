"""Iyzico PSP adapter — V1.1 sub-sprint (stub V1'de).

`iyzipay` SDK wrap + 3DS flow + idempotency replay. V1'de `PSP_PROVIDER=mock`;
V1.1 switch için tek env var değişir, çağrı tarafı değişmez.

V1'de `NotImplementedError` döner — konfigüre edilmediği sürece çağrılmamalı.
"""

from __future__ import annotations

from decimal import Decimal

from app.integrations.psp.protocol import Psp, PspResult


class IyzicoPsp(Psp):
    def __init__(self, *, base_url: str, api_key: str, secret_key: str) -> None:
        if not api_key or not secret_key:
            raise ValueError("Iyzico credentials required")
        self._base_url = base_url
        self._api_key = api_key
        self._secret_key = secret_key

    async def authorize_preauth(
        self,
        *,
        idempotency_key: str,
        customer_token: str,
        amount: Decimal,
        currency: str,
        case_id: str,
    ) -> PspResult:
        raise NotImplementedError("Iyzico integration ships in V1.1")

    async def capture(
        self,
        *,
        idempotency_key: str,
        preauth_id: str,
        amount: Decimal,
        currency: str,
    ) -> PspResult:
        raise NotImplementedError("Iyzico integration ships in V1.1")

    async def refund(
        self,
        *,
        idempotency_key: str,
        capture_id: str,
        amount: Decimal,
        currency: str,
        reason: str,
    ) -> PspResult:
        raise NotImplementedError("Iyzico integration ships in V1.1")

    async def void_preauth(
        self,
        *,
        idempotency_key: str,
        preauth_id: str,
    ) -> PspResult:
        raise NotImplementedError("Iyzico integration ships in V1.1")
