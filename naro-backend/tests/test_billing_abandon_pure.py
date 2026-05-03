"""Faz 1 abandon + reconcile pure tests.

Test scope:
- abandon_pending_preauth — ESTIMATE no-op, PREAUTH_REQUESTED → ESTIMATE,
  PREAUTH_HELD → PaymentAbandonNotAllowedError.
- mark_preauth_timeout — non-PREAUTH_REQUESTED no-op, PREAUTH_REQUESTED →
  PREAUTH_FAILED.
- billing_reconcile worker — no candidates short-circuit.

Pure: SimpleNamespace + AsyncMock; fake AsyncSession ile DB sızdırmadan
service kontratı doğrulanır.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest


class _FakeSession:
    """Minimal AsyncSession stub. flush + execute no-op; commit yutar."""

    def __init__(self) -> None:
        self.flush_calls = 0
        self.commit_calls = 0

    async def flush(self) -> None:
        self.flush_calls += 1

    async def commit(self) -> None:
        self.commit_calls += 1

    async def execute(self, stmt: object) -> object:
        del stmt

        class _Inner:
            def all(self) -> list[object]:
                return []

        class _Empty:
            def scalars(self) -> object:
                return _Inner()

        return _Empty()


# ─── abandon_pending_preauth ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_abandon_estimate_state_is_noop(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import case_billing

    case = SimpleNamespace(id=uuid4(), billing_state="estimate")
    monkeypatch.setattr(
        case_billing, "append_event", AsyncMock(return_value=None)
    )

    changed = await case_billing.abandon_pending_preauth(
        _FakeSession(),  # type: ignore[arg-type]
        case=case,
    )
    assert changed is False
    # State değişmedi
    assert case.billing_state == "estimate"


@pytest.mark.asyncio
async def test_abandon_preauth_held_raises_not_allowed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """PREAUTH_HELD/CAPTURED → /cancel-billing kullan, abandon yasak."""
    from app.services import case_billing

    case = SimpleNamespace(id=uuid4(), billing_state="preauth_held")
    monkeypatch.setattr(
        case_billing, "append_event", AsyncMock(return_value=None)
    )

    with pytest.raises(case_billing.PaymentAbandonNotAllowedError):
        await case_billing.abandon_pending_preauth(
            _FakeSession(),  # type: ignore[arg-type]
            case=case,
        )


@pytest.mark.asyncio
async def test_abandon_preauth_requested_transitions_to_estimate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Happy path — state değişir + idempotency mark_failed çağrılır."""
    from app.services import case_billing

    case = SimpleNamespace(id=uuid4(), billing_state="preauth_requested")

    # Idempotency repo'da 1 PENDING record var (initial)
    pending_record = SimpleNamespace(
        idempotency_key=f"authorize:{case.id}:initial",
        state=case_billing.PaymentIdempotencyState.PENDING,
    )

    async def fake_count(session: object, case_id: object) -> int:
        return 1  # initial only

    async def fake_get_record(session: object, key: str) -> object | None:
        if key == f"authorize:{case.id}:initial":
            return pending_record
        return None

    mark_failed = AsyncMock(return_value=None)
    monkeypatch.setattr(
        case_billing.idem_repo, "count_authorize_attempts", fake_count
    )
    monkeypatch.setattr(
        case_billing.idem_repo, "get_record", fake_get_record
    )
    monkeypatch.setattr(
        case_billing.idem_repo, "mark_failed", mark_failed
    )
    monkeypatch.setattr(
        case_billing, "append_event", AsyncMock(return_value=None)
    )

    changed = await case_billing.abandon_pending_preauth(
        _FakeSession(),  # type: ignore[arg-type]
        case=case,
    )
    assert changed is True
    assert case.billing_state == "estimate"
    # Pending kayıt CUSTOMER_ABANDONED ile FAILED'e çekildi
    mark_failed.assert_awaited()
    call = mark_failed.await_args
    assert call.kwargs["error_code"] == "CUSTOMER_ABANDONED"


# ─── mark_preauth_timeout ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_mark_preauth_timeout_skips_non_preauth_requested(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Idempotent skip — başka işlem state'i taşımışsa no-op."""
    from app.services import case_billing

    case = SimpleNamespace(id=uuid4(), billing_state="preauth_held")
    monkeypatch.setattr(
        case_billing, "append_event", AsyncMock(return_value=None)
    )

    changed = await case_billing.mark_preauth_timeout(
        _FakeSession(),  # type: ignore[arg-type]
        case=case,
        stale_minutes=180,
    )
    assert changed is False
    assert case.billing_state == "preauth_held"


@pytest.mark.asyncio
async def test_mark_preauth_timeout_transitions_to_failed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import case_billing

    case = SimpleNamespace(id=uuid4(), billing_state="preauth_requested")

    async def fake_count(session: object, case_id: object) -> int:
        return 0

    async def fake_get_record(session: object, key: str) -> object | None:
        return None  # hiç kayıt yok

    monkeypatch.setattr(
        case_billing.idem_repo, "count_authorize_attempts", fake_count
    )
    monkeypatch.setattr(
        case_billing.idem_repo, "get_record", fake_get_record
    )
    monkeypatch.setattr(
        case_billing.idem_repo, "mark_failed", AsyncMock(return_value=None)
    )
    monkeypatch.setattr(
        case_billing, "append_event", AsyncMock(return_value=None)
    )

    changed = await case_billing.mark_preauth_timeout(
        _FakeSession(),  # type: ignore[arg-type]
        case=case,
        stale_minutes=125,
    )
    assert changed is True
    assert case.billing_state == "preauth_failed"


# ─── billing_reconcile worker ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_billing_reconcile_no_candidates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Eligible vaka yoksa worker erken çıkar (commit + return)."""
    from app.workers import billing_reconcile as worker

    fake_session = _FakeSession()

    async def fake_get_db():  # type: ignore[no-untyped-def]
        yield fake_session

    monkeypatch.setattr(worker, "get_db", fake_get_db)

    await worker.billing_reconcile(ctx={})

    assert fake_session.commit_calls == 1


def test_billing_reconcile_threshold_is_two_hours() -> None:
    """V1 timeout eşiği 2 saat — webhook normalde dakikalar içinde gelir,
    2 saat üstü pending kesin kayıp say."""
    from app.workers import billing_reconcile as worker

    assert worker.PREAUTH_TIMEOUT_THRESHOLD.total_seconds() == 2 * 3600


def test_billing_reconcile_registered_in_worker_settings() -> None:
    """ARQ cron registry'de billing_reconcile kayıtlı olmalı."""
    from app.workers import settings as worker_settings

    cron_fns = {
        getattr(c, "coroutine", None) for c in worker_settings.WorkerSettings.cron_jobs
    }
    from app.workers.billing_reconcile import billing_reconcile

    assert billing_reconcile in cron_fns
