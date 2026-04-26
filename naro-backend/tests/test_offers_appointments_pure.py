"""Pure helper tests for PR 2-3 (offers + appointments routers).

DB integration testleri pre-existing cross-test event-loop bloker nedeniyle
skip'te; bu dosya Pydantic schema + helper pure testleri içerir.
"""

from __future__ import annotations

from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.api.pagination import (
    PaginatedResponse,
    build_paginated,
    decode_cursor,
    encode_cursor,
)
from app.api.v1.routes.appointments import (
    AppointmentCounterPayload,
    AppointmentReasonPayload,
)
from app.api.v1.routes.offers import (
    _KIND_OFFER_CAP,
    OfferSubmitPayload,
    OfferWithdrawPayload,
)
from app.models.case import ServiceRequestKind
from app.schemas.appointment import AppointmentRequest

# ─── Pagination cursor helpers ─────────────────────────────────────────────


def test_cursor_roundtrip() -> None:
    from datetime import UTC, datetime

    id_ = uuid4()
    when = datetime.now(UTC)
    encoded = encode_cursor(id_=id_, sort_value=when)
    assert isinstance(encoded, str)
    decoded = decode_cursor(encoded)
    assert decoded is not None
    assert decoded["id"] == str(id_)


def test_cursor_none_input() -> None:
    assert decode_cursor(None) is None
    assert decode_cursor("") is None


def test_cursor_invalid_400() -> None:
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        decode_cursor("not-a-valid-cursor!@#")
    assert exc_info.value.status_code == 400


def test_build_paginated_no_more() -> None:
    items = ["a", "b", "c"]
    result = build_paginated(items, limit=5, cursor_fn=lambda x: x)
    assert result.items == ["a", "b", "c"]
    assert result.next_cursor is None


def test_build_paginated_has_more() -> None:
    items = ["a", "b", "c", "d", "e", "f"]  # limit+1 → more
    result = build_paginated(items, limit=5, cursor_fn=lambda x: x)
    assert result.items == ["a", "b", "c", "d", "e"]
    assert result.next_cursor == "e"


def test_paginated_response_generic() -> None:
    resp: PaginatedResponse[str] = PaginatedResponse(
        items=["x", "y"], next_cursor="z"
    )
    assert resp.items == ["x", "y"]
    assert resp.next_cursor == "z"


# ─── OfferSubmitPayload ────────────────────────────────────────────────────


def test_offer_submit_payload_happy() -> None:
    payload = OfferSubmitPayload(
        case_id=uuid4(),
        amount=Decimal("150.50"),
        eta_minutes=30,
        headline="Yağ değişimi + filtre",
        delivery_mode="pickup",
        warranty_label="6 ay garanti",
    )
    assert payload.currency == "TRY"
    assert payload.slot_is_firm is False


def test_offer_submit_negative_amount_rejected() -> None:
    with pytest.raises(ValidationError):
        OfferSubmitPayload(
            case_id=uuid4(),
            amount=Decimal("-1"),
            eta_minutes=30,
            headline="x",
            delivery_mode="pickup",
            warranty_label="6 ay",
        )


def test_offer_submit_empty_headline_rejected() -> None:
    with pytest.raises(ValidationError):
        OfferSubmitPayload(
            case_id=uuid4(),
            amount=Decimal("100"),
            eta_minutes=30,
            headline="",
            delivery_mode="pickup",
            warranty_label="6 ay",
        )


def test_offer_submit_extra_field_rejected() -> None:
    with pytest.raises(ValidationError):
        OfferSubmitPayload(
            case_id=uuid4(),
            amount=Decimal("100"),
            eta_minutes=30,
            headline="x",
            delivery_mode="pickup",
            warranty_label="6 ay",
            unknown_field=True,  # type: ignore[call-arg]
        )


def test_offer_withdraw_payload() -> None:
    p = OfferWithdrawPayload(reason="Müsait değilim")
    assert p.reason == "Müsait değilim"
    p2 = OfferWithdrawPayload()
    assert p2.reason is None


# ─── Kind offer cap matrix ────────────────────────────────────────────────


def test_kind_offer_cap_matrix() -> None:
    assert _KIND_OFFER_CAP[ServiceRequestKind.ACCIDENT] == 5
    assert _KIND_OFFER_CAP[ServiceRequestKind.BREAKDOWN] == 7
    assert _KIND_OFFER_CAP[ServiceRequestKind.MAINTENANCE] == 10
    assert ServiceRequestKind.TOWING not in _KIND_OFFER_CAP


# ─── AppointmentRequest ────────────────────────────────────────────────────


def test_appointment_request_happy() -> None:
    from datetime import UTC, datetime, timedelta

    req = AppointmentRequest(
        case_id=uuid4(),
        technician_id=uuid4(),
        slot={"kind": "custom", "dateLabel": "25 Nis", "timeWindow": "10:00"},
        note="Saat 10 uygun",
        expires_at=datetime.now(UTC) + timedelta(hours=48),
    )
    assert req.note == "Saat 10 uygun"


def test_appointment_request_extra_field_rejected() -> None:
    from datetime import UTC, datetime, timedelta

    with pytest.raises(ValidationError):
        AppointmentRequest(
            case_id=uuid4(),
            technician_id=uuid4(),
            slot={"kind": "custom"},
            expires_at=datetime.now(UTC) + timedelta(hours=48),
            junk_field=1,  # type: ignore[call-arg]
        )


def test_appointment_reason_empty_rejected() -> None:
    with pytest.raises(ValidationError):
        AppointmentReasonPayload(reason="")


def test_appointment_counter_payload() -> None:
    p = AppointmentCounterPayload(
        new_slot={"kind": "interval", "start_at": "2026-04-26T14:00:00Z"}
    )
    assert p.new_slot["kind"] == "interval"
