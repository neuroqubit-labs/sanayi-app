"""Payment idempotency decorator (Faz B-2).

`with_idempotency` — PSP çağrısını sarmalayan decorator. I-BILL-4 +
I-BILL-11 enforcement:

- Key UNIQUE (PK): DB level duplicate engel
- State=success → cached response replay (I-BILL-11)
- State=pending → ConcurrentOperationError (başka request inflight)
- State=failed → retry allowed (yeni call işler)

Usage:
    result = await with_idempotency(
        db,
        key=f"capture:{case_id}:{approval_id}",
        operation=PaymentOperation.CAPTURE,
        case_id=case_id,
        provider=PaymentProvider.IYZICO,
        fn=lambda: psp.capture(...),
    )
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.psp.protocol import PspResult
from app.models.billing import (
    PaymentIdempotencyState,
    PaymentOperation,
    PaymentProvider,
)
from app.repositories import payment_idempotency as idem_repo


class ConcurrentOperationError(RuntimeError):
    """I-BILL-11: aynı idempotency_key inflight (pending) — başka çağrı çalışıyor.

    Genellikle timeout/retry öncesi beklemek gerekir; request bozuk değil.
    """

    def __init__(self, key: str) -> None:
        super().__init__(f"idempotency key in-flight: {key}")
        self.key = key


async def with_idempotency(
    db: AsyncSession,
    *,
    key: str,
    operation: PaymentOperation,
    case_id: UUID,
    provider: PaymentProvider,
    fn: Callable[[], Awaitable[PspResult]],
    request_payload: dict[str, Any] | None = None,
) -> PspResult:
    """PSP çağrısını idempotency cache ile sarmalı.

    - State=success → cached PspResult replay
    - State=pending → ConcurrentOperationError
    - State=failed → yeni call (aynı key ile mark_failed override)
    - Kayıt yoksa → pending insert + call + mark_success/failed
    """
    existing = await idem_repo.get_record(db, key)
    if existing is not None:
        if existing.state == PaymentIdempotencyState.SUCCESS:
            resp = existing.response_payload or {}
            return PspResult(
                success=True,
                provider_ref=existing.psp_ref,
                raw=dict(resp),
            )
        if existing.state == PaymentIdempotencyState.PENDING:
            raise ConcurrentOperationError(key)
        # state == FAILED → retry allowed; yeni insert değil, reset yapalım
        # (PK UNIQUE olduğu için insert ederken IntegrityError — pending'e
        # çekip yeniden yürüt)
        await idem_repo.mark_failed(
            db, idempotency_key=key, error_code="retry_reset"
        )
    else:
        await idem_repo.insert_pending(
            db,
            idempotency_key=key,
            operation=operation,
            case_id=case_id,
            psp_provider=provider,
            request_payload=request_payload,
        )

    try:
        result = await fn()
    except Exception as exc:
        await idem_repo.mark_failed(
            db, idempotency_key=key, error_code=type(exc).__name__
        )
        raise

    if result.success:
        await idem_repo.mark_success(
            db,
            idempotency_key=key,
            psp_ref=result.provider_ref or "",
            response_payload=dict(result.raw),
        )
    else:
        await idem_repo.mark_failed(
            db,
            idempotency_key=key,
            error_code=result.error_code,
            response_payload=dict(result.raw),
        )
    return result
