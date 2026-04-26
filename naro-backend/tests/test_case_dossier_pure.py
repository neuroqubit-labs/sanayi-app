from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.api.v1.routes import case_dossier as case_dossier_route
from app.models.case import (
    CaseOrigin,
    CaseWaitActor,
    ServiceCaseStatus,
    ServiceRequestKind,
    ServiceRequestUrgency,
    TowDispatchStage,
    TowMode,
)
from app.models.case_audit import CaseEventType, CaseTone
from app.models.case_matching import (
    CaseTechnicianMatchVisibility,
    CaseTechnicianNotificationStatus,
)
from app.models.case_process import (
    CaseApprovalKind,
    CaseApprovalPaymentState,
    CaseApprovalStatus,
)
from app.models.offer import CaseOfferStatus
from app.schemas.case_dossier import (
    AppointmentSummary,
    CaseDossierResponse,
    CaseShellSection,
    CaseWaitState,
    MaintenanceDetail,
    MatchSummary,
    NotificationSummary,
    OfferSummary,
    PaymentSnapshot,
    TimelineEventSummary,
    TowingDetail,
    TowSnapshot,
    VehicleSnapshotSection,
    ViewerContext,
    ViewerRole,
)
from app.services import case_dossier
from app.services.case_dossier_redact import (
    can_pool_technician_send_offer,
    compute_competitor_offer_average,
    redact_dossier_for_viewer,
)

NOW = datetime(2026, 4, 26, 12, 0, tzinfo=UTC)


def _offer(
    *,
    technician_user_id: UUID,
    amount: Decimal,
    status: CaseOfferStatus = CaseOfferStatus.PENDING,
    label: str = "Volkan Usta",
) -> OfferSummary:
    return OfferSummary(
        id=uuid4(),
        technician_user_id=technician_user_id,
        technician_display_label=label,
        amount=amount,
        currency="TRY",
        status=status,
        slot_proposal={"kind": "custom"},
        created_at=NOW,
    )


def _match(
    *,
    technician_user_id: UUID,
    visibility: CaseTechnicianMatchVisibility = CaseTechnicianMatchVisibility.CANDIDATE,
) -> MatchSummary:
    return MatchSummary(
        id=uuid4(),
        technician_user_id=technician_user_id,
        score=Decimal("82.00"),
        reason_label="Bu vaka türüne ve ilçeye uygun",
        visibility_state=visibility,
    )


def _timeline(
    *,
    event_type: CaseEventType,
    actor_user_id: UUID | None,
) -> TimelineEventSummary:
    return TimelineEventSummary(
        id=uuid4(),
        event_type=event_type,
        title="Timeline",
        tone=CaseTone.INFO,
        actor_user_id=actor_user_id,
        context_summary=None,
        occurred_at=NOW,
    )


def _dossier(
    *,
    role: ViewerRole,
    viewer_user_id: UUID,
    kind: ServiceRequestKind = ServiceRequestKind.MAINTENANCE,
    status: ServiceCaseStatus = ServiceCaseStatus.MATCHING,
    closed_at: datetime | None = None,
    tow_snapshot: TowSnapshot | None = None,
    matches: list[MatchSummary] | None = None,
    offers: list[OfferSummary] | None = None,
    timeline: list[TimelineEventSummary] | None = None,
) -> CaseDossierResponse:
    if kind == ServiceRequestKind.TOWING:
        kind_detail = TowingDetail(
            kind=ServiceRequestKind.TOWING,
            tow_mode=TowMode.IMMEDIATE,
            tow_stage=TowDispatchStage.SEARCHING,
            pickup_label="Kayseri, Kocasinan, Sahabiye",
            dropoff_label="Kayseri, Melikgazi, Sanayi",
        )
        tow_snapshot = tow_snapshot or TowSnapshot(
            tow_mode=TowMode.IMMEDIATE,
            tow_stage=TowDispatchStage.SEARCHING,
            pickup_label="Kayseri, Kocasinan, Sahabiye",
            dropoff_label="Kayseri, Melikgazi, Sanayi",
        )
    else:
        kind_detail = MaintenanceDetail(
            kind=ServiceRequestKind.MAINTENANCE,
            maintenance_category="periodic",
        )
    return CaseDossierResponse(
        shell=CaseShellSection(
            id=uuid4(),
            kind=kind,
            status=status,
            urgency=ServiceRequestUrgency.PLANNED,
            origin=CaseOrigin.CUSTOMER,
            title="Vaka",
            subtitle=None,
            summary="Özet",
            location_label="Kayseri, Kocasinan, Sahabiye",
            wait_state=CaseWaitState(actor=CaseWaitActor.SYSTEM),
            created_at=NOW,
            updated_at=NOW,
            closed_at=closed_at,
        ),
        vehicle=VehicleSnapshotSection(
            plate="38 ABC 123",
            make="Volkswagen",
            model="Passat",
            year=2018,
            fuel_type="diesel",
            vin="WVZZZ3CZJE000001",
            current_km=120000,
        ),
        kind_detail=kind_detail,
        matches=matches or [],
        notifications=[
            NotificationSummary(
                id=uuid4(),
                technician_user_id=viewer_user_id,
                status=CaseTechnicianNotificationStatus.SENT,
                created_at=NOW,
            )
        ],
        offers=offers or [],
        appointment=AppointmentSummary(
            id=uuid4(),
            status="pending",
            slot={"kind": "custom"},
            slot_kind="custom",
            source="offer_accept",
        ),
        approvals=[
            {
                "id": uuid4(),
                "kind": CaseApprovalKind.PARTS_REQUEST,
                "title": "Parça onayı",
                "description": "Açıklama",
                "amount": Decimal("500.00"),
                "currency": "TRY",
                "status": CaseApprovalStatus.PENDING,
                "payment_state": CaseApprovalPaymentState.REQUIRED,
                "created_at": NOW,
            }
        ],
        payment_snapshot=PaymentSnapshot(estimate_amount=Decimal("1000.00")),
        tow_snapshot=tow_snapshot,
        timeline_summary=timeline or [],
        viewer=ViewerContext(role=role, has_offer_from_me=False),
    )


def test_customer_sees_full_dossier_for_own_case() -> None:
    tech = uuid4()
    dossier = _dossier(
        role=ViewerRole.CUSTOMER,
        viewer_user_id=uuid4(),
        offers=[_offer(technician_user_id=tech, amount=Decimal("1000.00"))],
        matches=[_match(technician_user_id=tech)],
    )

    redacted = redact_dossier_for_viewer(dossier, viewer_user_id=uuid4())

    assert redacted.vehicle.plate == "38 ABC 123"
    assert redacted.vehicle.vin == "WVZZZ3CZJE000001"
    assert redacted.offers[0].amount == Decimal("1000.00")
    assert redacted.matches[0].technician_user_id == tech


@pytest.mark.asyncio
async def test_other_customer_gets_404(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        case_dossier_route.case_dossier,
        "assemble_dossier",
        AsyncMock(side_effect=case_dossier.NotPermittedError("nope")),
    )

    with pytest.raises(HTTPException) as exc_info:
        await case_dossier_route.get_case_dossier(
            uuid4(),
            SimpleNamespace(id=uuid4(), role="customer"),
            SimpleNamespace(),
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == {"type": "case_not_found"}


def test_pool_technician_sees_pii_redacted() -> None:
    tech = uuid4()
    dossier = _dossier(role=ViewerRole.POOL_TECHNICIAN, viewer_user_id=tech)

    redacted = redact_dossier_for_viewer(dossier, viewer_user_id=tech)

    assert redacted.vehicle.plate == "38*** C123"
    assert redacted.vehicle.vin is None
    assert redacted.shell.location_label == "Kocasinan"


def test_assigned_technician_sees_extended_with_pii_safe_customer_info() -> None:
    tech = uuid4()
    dossier = _dossier(
        role=ViewerRole.ASSIGNED_TECHNICIAN,
        viewer_user_id=tech,
        offers=[_offer(technician_user_id=tech, amount=Decimal("1200.00"))],
    )

    redacted = redact_dossier_for_viewer(dossier, viewer_user_id=tech)

    assert redacted.vehicle.plate == "38 ABC 123"
    assert redacted.vehicle.vin == "WVZZZ3CZJE000001"
    assert redacted.offers[0].amount == Decimal("1200.00")


def test_pool_technician_sees_only_own_match_in_matches_list() -> None:
    own = uuid4()
    other = uuid4()
    dossier = _dossier(
        role=ViewerRole.POOL_TECHNICIAN,
        viewer_user_id=own,
        matches=[_match(technician_user_id=own), _match(technician_user_id=other)],
    )

    redacted = redact_dossier_for_viewer(dossier, viewer_user_id=own)

    assert len(redacted.matches) == 1
    assert redacted.matches[0].technician_user_id == own


def test_other_match_count_is_computed_for_pool_technician() -> None:
    own = uuid4()
    dossier = _dossier(
        role=ViewerRole.POOL_TECHNICIAN,
        viewer_user_id=own,
        matches=[
            _match(technician_user_id=own),
            _match(technician_user_id=uuid4()),
            _match(technician_user_id=uuid4()),
        ],
    )

    redacted = redact_dossier_for_viewer(dossier, viewer_user_id=own)

    assert redacted.viewer.other_match_count == 2


def test_match_visibility_hidden_filtered_for_pool_technician() -> None:
    own = uuid4()
    dossier = _dossier(
        role=ViewerRole.POOL_TECHNICIAN,
        viewer_user_id=own,
        matches=[
            _match(
                technician_user_id=own,
                visibility=CaseTechnicianMatchVisibility.HIDDEN,
            )
        ],
    )

    redacted = redact_dossier_for_viewer(dossier, viewer_user_id=own)

    assert redacted.matches == []


def test_customer_sees_all_offer_amounts_clear() -> None:
    offers = [
        _offer(technician_user_id=uuid4(), amount=Decimal("1000.00")),
        _offer(technician_user_id=uuid4(), amount=Decimal("1500.00")),
    ]
    dossier = _dossier(
        role=ViewerRole.CUSTOMER, viewer_user_id=uuid4(), offers=offers
    )

    redacted = redact_dossier_for_viewer(dossier, viewer_user_id=uuid4())

    assert [offer.amount for offer in redacted.offers] == [
        Decimal("1000.00"),
        Decimal("1500.00"),
    ]


def test_assigned_technician_sees_all_offer_amounts_clear() -> None:
    viewer = uuid4()
    offers = [
        _offer(technician_user_id=viewer, amount=Decimal("1000.00")),
        _offer(technician_user_id=uuid4(), amount=Decimal("1500.00")),
    ]
    dossier = _dossier(
        role=ViewerRole.ASSIGNED_TECHNICIAN, viewer_user_id=viewer, offers=offers
    )

    redacted = redact_dossier_for_viewer(dossier, viewer_user_id=viewer)

    assert [offer.amount for offer in redacted.offers] == [
        Decimal("1000.00"),
        Decimal("1500.00"),
    ]


def test_pool_technician_sees_only_own_offer_amount() -> None:
    viewer = uuid4()
    competitor = uuid4()
    dossier = _dossier(
        role=ViewerRole.POOL_TECHNICIAN,
        viewer_user_id=viewer,
        offers=[
            _offer(technician_user_id=viewer, amount=Decimal("1000.00")),
            _offer(technician_user_id=competitor, amount=Decimal("1500.00")),
        ],
    )

    redacted = redact_dossier_for_viewer(dossier, viewer_user_id=viewer)

    assert redacted.offers[0].amount == Decimal("1000.00")
    assert redacted.offers[1].amount is None
    assert redacted.offers[1].technician_user_id is None


def test_pool_technician_competitor_average_excludes_self() -> None:
    viewer = uuid4()
    offers = [
        _offer(technician_user_id=viewer, amount=Decimal("1000.00")),
        _offer(technician_user_id=uuid4(), amount=Decimal("1500.00")),
        _offer(technician_user_id=uuid4(), amount=Decimal("2500.00")),
    ]

    avg, count = compute_competitor_offer_average(
        offers, viewer_user_id=viewer
    )

    assert avg == Decimal("2000.00")
    assert count == 2


def test_pool_technician_competitor_average_excludes_withdrawn_rejected() -> None:
    viewer = uuid4()
    offers = [
        _offer(technician_user_id=uuid4(), amount=Decimal("1000.00")),
        _offer(
            technician_user_id=uuid4(),
            amount=Decimal("9999.00"),
            status=CaseOfferStatus.WITHDRAWN,
        ),
        _offer(
            technician_user_id=uuid4(),
            amount=Decimal("8888.00"),
            status=CaseOfferStatus.REJECTED,
        ),
        _offer(
            technician_user_id=uuid4(),
            amount=Decimal("7777.00"),
            status=CaseOfferStatus.EXPIRED,
        ),
    ]

    avg, count = compute_competitor_offer_average(
        offers, viewer_user_id=viewer
    )

    assert avg == Decimal("1000.00")
    assert count == 1


def test_competitor_average_none_when_no_other_offers() -> None:
    viewer = uuid4()

    avg, count = compute_competitor_offer_average(
        [_offer(technician_user_id=viewer, amount=Decimal("1000.00"))],
        viewer_user_id=viewer,
    )

    assert avg is None
    assert count == 0


def test_competitor_average_equals_single_competitor_amount() -> None:
    viewer = uuid4()
    avg, count = compute_competitor_offer_average(
        [_offer(technician_user_id=uuid4(), amount=Decimal("1234.56"))],
        viewer_user_id=viewer,
    )

    assert avg == Decimal("1234.56")
    assert count == 1


def test_kind_towing_includes_tow_snapshot() -> None:
    dossier = _dossier(
        role=ViewerRole.CUSTOMER,
        viewer_user_id=uuid4(),
        kind=ServiceRequestKind.TOWING,
    )

    assert dossier.tow_snapshot is not None
    assert dossier.tow_snapshot.tow_stage == TowDispatchStage.SEARCHING


def test_kind_maintenance_excludes_tow_snapshot() -> None:
    dossier = _dossier(role=ViewerRole.CUSTOMER, viewer_user_id=uuid4())

    assert dossier.tow_snapshot is None


def test_terminal_case_dossier_returns_with_closed_at_set() -> None:
    dossier = _dossier(
        role=ViewerRole.CUSTOMER,
        viewer_user_id=uuid4(),
        status=ServiceCaseStatus.COMPLETED,
        closed_at=NOW,
    )

    assert dossier.shell.status == ServiceCaseStatus.COMPLETED
    assert dossier.shell.closed_at == NOW


@pytest.mark.asyncio
async def test_soft_deleted_case_returns_404(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        case_dossier_route.case_dossier,
        "assemble_dossier",
        AsyncMock(side_effect=case_dossier.CaseNotFoundError("missing")),
    )

    with pytest.raises(HTTPException) as exc_info:
        await case_dossier_route.get_case_dossier(
            uuid4(),
            SimpleNamespace(id=uuid4(), role="customer"),
            SimpleNamespace(),
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == {"type": "case_not_found"}


def test_viewer_context_can_send_offer_true_for_pool_technician_open_case() -> None:
    assert can_pool_technician_send_offer(
        case_status=ServiceCaseStatus.MATCHING,
        has_offer_from_me=False,
    )
    assert not can_pool_technician_send_offer(
        case_status=ServiceCaseStatus.COMPLETED,
        has_offer_from_me=False,
    )
    assert not can_pool_technician_send_offer(
        case_status=ServiceCaseStatus.MATCHING,
        has_offer_from_me=True,
    )


@pytest.mark.parametrize(
    "case_status",
    (
        ServiceCaseStatus.COMPLETED,
        ServiceCaseStatus.CANCELLED,
        ServiceCaseStatus.ARCHIVED,
    ),
)
def test_viewer_context_can_send_offer_false_when_terminal(
    case_status: ServiceCaseStatus,
) -> None:
    viewer = uuid4()
    dossier = _dossier(
        role=ViewerRole.POOL_TECHNICIAN,
        viewer_user_id=viewer,
        status=case_status,
        closed_at=NOW,
    )

    dossier.viewer.can_send_offer = can_pool_technician_send_offer(
        case_status=dossier.shell.status,
        has_offer_from_me=dossier.viewer.has_offer_from_me,
    )

    assert dossier.viewer.can_send_offer is False


def test_pool_timeline_filter_only_allowed_events() -> None:
    viewer = uuid4()
    hidden_actor = uuid4()
    dossier = _dossier(
        role=ViewerRole.POOL_TECHNICIAN,
        viewer_user_id=viewer,
        timeline=[
            _timeline(
                event_type=CaseEventType.STATUS_UPDATE,
                actor_user_id=hidden_actor,
            ),
            _timeline(event_type=CaseEventType.OFFER_RECEIVED, actor_user_id=viewer),
            _timeline(
                event_type=CaseEventType.PAYMENT_CAPTURED,
                actor_user_id=hidden_actor,
            ),
        ],
    )

    redacted = redact_dossier_for_viewer(dossier, viewer_user_id=viewer)

    assert [event.event_type for event in redacted.timeline_summary] == [
        CaseEventType.STATUS_UPDATE,
    ]
    assert redacted.timeline_summary[0].actor_user_id is None
