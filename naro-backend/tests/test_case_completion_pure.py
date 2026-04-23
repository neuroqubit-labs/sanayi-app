"""Case completion orchestrator pure unit tests — B-P1-2.

DB integration cross-test asyncpg bloker → service-level behavior smoke
yoluyla doğrulanır. Bu test sadece module import + public API surface'i
kontrol eder.
"""

from __future__ import annotations

from app.services import case_completion


def test_try_complete_is_exported() -> None:
    assert hasattr(case_completion, "try_complete")
    assert callable(case_completion.try_complete)


def test_try_complete_module_exports() -> None:
    assert "try_complete" in case_completion.__all__
