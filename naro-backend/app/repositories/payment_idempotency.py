"""Payment idempotency repository (Faz B-2).

Generic PSP retry cache — aynı idempotency_key 24h aynı response'u verir.
Network partition / timeout durumunda çift charge engeli.

State machine:
  pending (inflight) → success (terminal)
  pending (inflight) → failed (terminal — retry allowed)

Tow'dan ayrı (tow_payment_idempotency settlement-scoped). Bu case-scoped,
multi-operation (authorize/capture/refund/void).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import (
    PaymentIdempotency,
    PaymentIdempotencyState,
    PaymentOperation,
    PaymentProvider,
)


async def get_record(
    session: AsyncSession, idempotency_key: str
) -> PaymentIdempotency | None:
    stmt = select(PaymentIdempotency).where(
        PaymentIdempotency.idempotency_key == idempotency_key
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def count_authorize_attempts(
    session: AsyncSession, case_id: UUID
) -> int:
    """B-P0-3 fix: retry-aware idempotency key için mevcut authorize:*
    attempt sayısı. Yeni retry key = `authorize:{case_id}:retry_{N}` ile
    sonraki attempt.
    """
    stmt = select(PaymentIdempotency).where(
        PaymentIdempotency.case_id == case_id,
        PaymentIdempotency.operation == PaymentOperation.AUTHORIZE,
    )
    rows = list((await session.execute(stmt)).scalars().all())
    return len(rows)


async def insert_pending(
    session: AsyncSession,
    *,
    idempotency_key: str,
    operation: PaymentOperation,
    case_id: UUID,
    psp_provider: PaymentProvider,
    request_payload: dict[str, Any] | None = None,
) -> PaymentIdempotency:
    record = PaymentIdempotency(
        idempotency_key=idempotency_key,
        operation=operation,
        case_id=case_id,
        psp_provider=psp_provider,
        request_payload=request_payload,
        state=PaymentIdempotencyState.PENDING,
    )
    session.add(record)
    await session.flush()
    return record


async def mark_success(
    session: AsyncSession,
    *,
    idempotency_key: str,
    psp_ref: str,
    response_payload: dict[str, Any] | None = None,
) -> None:
    await session.execute(
        update(PaymentIdempotency)
        .where(PaymentIdempotency.idempotency_key == idempotency_key)
        .values(
            state=PaymentIdempotencyState.SUCCESS,
            psp_ref=psp_ref,
            response_payload=response_payload,
            completed_at=datetime.now(UTC),
        )
    )


async def mark_failed(
    session: AsyncSession,
    *,
    idempotency_key: str,
    error_code: str | None = None,
    response_payload: dict[str, Any] | None = None,
) -> None:
    await session.execute(
        update(PaymentIdempotency)
        .where(PaymentIdempotency.idempotency_key == idempotency_key)
        .values(
            state=PaymentIdempotencyState.FAILED,
            response_payload={
                **(response_payload or {}),
                "error_code": error_code,
            },
            completed_at=datetime.now(UTC),
        )
    )
