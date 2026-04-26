"""Pure tests — public case showcase contract.

DB-bağımsız: model/table names, PII-safe snapshot ve schema alanları.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.v1.routes import cases as cases_route
from app.models.case import ServiceCaseStatus, ServiceRequestKind
from app.models.case_public_showcase import (
    CasePublicShowcase,
    CasePublicShowcaseMedia,
    CasePublicShowcaseStatus,
)
from app.schemas.technician_public import (
    PublicCaseShowcasePreview,
    TechnicianPublicView,
)


def test_showcase_model_table_names() -> None:
    assert CasePublicShowcase.__tablename__ == "case_public_showcases"
    assert CasePublicShowcaseMedia.__tablename__ == "case_public_showcase_media"


def test_showcase_status_values() -> None:
    assert CasePublicShowcaseStatus.PENDING_CUSTOMER.value == "pending_customer"
    assert CasePublicShowcaseStatus.PUBLISHED.value == "published"
    assert CasePublicShowcaseStatus.REVOKED.value == "revoked"


def test_public_profile_has_case_showcases() -> None:
    assert "case_showcases" in TechnicianPublicView.model_fields


def test_public_showcase_preview_no_pii_fields() -> None:
    fields = set(PublicCaseShowcasePreview.model_fields.keys())
    forbidden = {
        "customer_user_id",
        "technician_user_id",
        "plate",
        "vin",
        "phone",
        "email",
        "amount",
        "total_amount",
        "exact_km",
    }
    assert not (fields & forbidden)


def test_public_showcase_preview_construct() -> None:
    item = PublicCaseShowcasePreview(
        id=uuid4(),
        kind=ServiceRequestKind.MAINTENANCE,
        kind_label="Bakım işlemi",
        title="Bakım işlemi",
        summary="Periyodik bakım tamamlandı.",
        month_label="Nisan 2026",
        location_label="Kadıköy, İstanbul",
        rating=5,
        review_body="Temiz çalışıldı.",
    )
    assert item.kind == ServiceRequestKind.MAINTENANCE
    assert item.rating == 5


@pytest.mark.asyncio
async def test_customer_showcase_revoke_owner_only_and_calls_service(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    customer_id = uuid4()
    case_id = uuid4()
    showcase_id = uuid4()
    showcase = SimpleNamespace(
        id=showcase_id,
        case_id=case_id,
        kind=ServiceRequestKind.MAINTENANCE,
        status=CasePublicShowcaseStatus.PUBLISHED,
        public_snapshot={"title": "Bakım", "summary": "Temiz iş"},
    )

    class ExecuteResult:
        def scalar_one_or_none(self):
            return showcase

    class FakeDb:
        committed = False

        async def execute(self, _stmt):
            return ExecuteResult()

        async def commit(self):
            self.committed = True

    db = FakeDb()
    revoke = AsyncMock(
        return_value=SimpleNamespace(
            **{
                **showcase.__dict__,
                "status": CasePublicShowcaseStatus.REVOKED,
            }
        )
    )
    monkeypatch.setattr(
        cases_route.case_repo,
        "get_case",
        AsyncMock(
            return_value=SimpleNamespace(
                id=case_id,
                deleted_at=None,
                customer_user_id=customer_id,
                status=ServiceCaseStatus.COMPLETED,
            )
        ),
    )
    monkeypatch.setattr(
        cases_route.case_public_showcases,
        "revoke_for_actor",
        revoke,
    )
    monkeypatch.setattr(cases_route, "append_event", AsyncMock(return_value=None))

    response = await cases_route.revoke_case_showcase(
        case_id,
        cases_route.CustomerShowcaseRevokePayload(reason="istemiyorum"),
        SimpleNamespace(id=customer_id),
        db,
    )

    assert response.id == showcase_id
    assert response.status == CasePublicShowcaseStatus.REVOKED
    assert db.committed is True
    revoke.assert_awaited_once()
    assert revoke.await_args.kwargs["actor"] == "customer"


@pytest.mark.asyncio
async def test_customer_showcase_revoke_other_customer_404(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        cases_route.case_repo,
        "get_case",
        AsyncMock(
            return_value=SimpleNamespace(
                id=uuid4(),
                deleted_at=None,
                customer_user_id=uuid4(),
            )
        ),
    )

    with pytest.raises(HTTPException) as exc_info:
        await cases_route.revoke_case_showcase(
            uuid4(),
            cases_route.CustomerShowcaseRevokePayload(),
            SimpleNamespace(id=uuid4()),
            SimpleNamespace(),
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == {"type": "case_not_found"}
