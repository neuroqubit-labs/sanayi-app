"""MockPsp — V1 default. Deterministic; env ile fail rate ayarlanabilir.

Test/dev için `MOCK_PSP_FAIL_RATIO=0.0..1.0` (default 0 = always success).
Idempotency key tabanlı deterministic — aynı key aynı success/fail döner.
"""

from __future__ import annotations

import hashlib
import os
from decimal import Decimal
from uuid import uuid4

from app.integrations.psp.protocol import Psp, PspResult


class MockPsp(Psp):
    def __init__(self, fail_ratio: float = 0.0) -> None:
        self._fail_ratio = fail_ratio

    async def authorize_preauth(
        self,
        *,
        idempotency_key: str,
        customer_token: str,
        amount: Decimal,
        currency: str,
        case_id: str,
    ) -> PspResult:
        if self._should_fail(idempotency_key):
            return PspResult(
                success=False,
                provider_ref=None,
                raw={"reason": "mock_decline"},
                error_code="MOCK_DECLINED",
                message="Mock PSP declined this key",
            )
        return PspResult(
            success=True,
            provider_ref=f"mock_pa_{uuid4().hex[:12]}",
            raw={
                "operation": "preauth",
                "amount": str(amount),
                "currency": currency,
                "case_id": case_id,
            },
        )

    async def capture(
        self,
        *,
        idempotency_key: str,
        preauth_id: str,
        amount: Decimal,
        currency: str,
    ) -> PspResult:
        if self._should_fail(idempotency_key):
            return PspResult(
                success=False,
                provider_ref=None,
                raw={"reason": "mock_capture_fail", "preauth_id": preauth_id},
                error_code="MOCK_CAPTURE_FAIL",
            )
        return PspResult(
            success=True,
            provider_ref=f"mock_cap_{uuid4().hex[:12]}",
            raw={
                "operation": "capture",
                "preauth_id": preauth_id,
                "amount": str(amount),
                "currency": currency,
            },
        )

    async def refund(
        self,
        *,
        idempotency_key: str,
        capture_id: str,
        amount: Decimal,
        currency: str,
        reason: str,
    ) -> PspResult:
        return PspResult(
            success=True,
            provider_ref=f"mock_rf_{uuid4().hex[:12]}",
            raw={
                "operation": "refund",
                "capture_id": capture_id,
                "amount": str(amount),
                "currency": currency,
                "reason": reason,
            },
        )

    async def void_preauth(
        self,
        *,
        idempotency_key: str,
        preauth_id: str,
    ) -> PspResult:
        return PspResult(
            success=True,
            provider_ref=f"mock_void_{uuid4().hex[:12]}",
            raw={"operation": "void", "preauth_id": preauth_id},
        )

    def _should_fail(self, key: str) -> bool:
        if self._fail_ratio <= 0:
            return False
        digest = int(hashlib.sha256(key.encode()).hexdigest()[:8], 16)
        return (digest % 1000) / 1000.0 < self._fail_ratio


def build_mock_psp() -> MockPsp:
    fail_ratio = float(os.environ.get("MOCK_PSP_FAIL_RATIO", "0"))
    return MockPsp(fail_ratio=fail_ratio)
