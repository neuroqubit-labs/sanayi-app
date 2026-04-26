from __future__ import annotations

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.api.v1.routes import offers
from app.models.case import ServiceCaseStatus


def _offer_payload(case_id: UUID) -> offers.OfferSubmitPayload:
    return offers.OfferSubmitPayload(
        case_id=case_id,
        amount=Decimal("1250.00"),
        eta_minutes=120,
        headline="Ön takım bakım teklifi",
        delivery_mode="workshop",
        warranty_label="6 ay garanti",
    )


@pytest.mark.asyncio
async def test_offer_submit_rejects_completed_case(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    technician_id = uuid4()
    case = SimpleNamespace(
        id=uuid4(),
        deleted_at=None,
        status=ServiceCaseStatus.COMPLETED,
    )
    db = SimpleNamespace(get=AsyncMock(return_value=case))
    monkeypatch.setattr(
        offers.technician_payment_accounts,
        "require_can_receive_online_payments",
        AsyncMock(return_value=None),
    )
    get_profile = AsyncMock()
    monkeypatch.setattr(offers, "_get_technician_profile", get_profile)

    with pytest.raises(HTTPException) as exc_info:
        await offers.submit_offer_endpoint(
            _offer_payload(case.id),
            SimpleNamespace(id=technician_id),
            db,
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == {
        "type": "case_terminal",
        "status": ServiceCaseStatus.COMPLETED.value,
    }
    get_profile.assert_not_awaited()
