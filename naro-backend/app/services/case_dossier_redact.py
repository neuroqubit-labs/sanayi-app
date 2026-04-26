from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from app.domain.terminal_states import CASE_SINK, CASE_TERMINAL
from app.models.case import ServiceCaseStatus
from app.models.case_audit import CaseEventType
from app.models.case_matching import CaseTechnicianMatchVisibility
from app.models.offer import ACTIVE_OFFER_STATUSES
from app.schemas.case_dossier import (
    CaseDossierResponse,
    OfferSummary,
    TimelineEventSummary,
    ViewerRole,
)
from app.schemas.review import mask_reviewer_name


def redact_dossier_for_viewer(
    dossier: CaseDossierResponse,
    *,
    viewer_user_id: UUID,
) -> CaseDossierResponse:
    redacted = dossier.model_copy(deep=True)
    if redacted.viewer.role == ViewerRole.POOL_TECHNICIAN:
        return _redact_pool_technician(redacted, viewer_user_id=viewer_user_id)
    return redacted


def compute_competitor_offer_average(
    offers: list[OfferSummary],
    *,
    viewer_user_id: UUID,
) -> tuple[Decimal | None, int]:
    competitors = [
        offer
        for offer in offers
        if offer.technician_user_id != viewer_user_id
        and offer.status in ACTIVE_OFFER_STATUSES
        and offer.amount is not None
    ]
    if not competitors:
        return None, 0
    total = sum((offer.amount for offer in competitors), Decimal("0.00"))
    return (total / len(competitors)).quantize(Decimal("0.01")), len(competitors)


def can_pool_technician_send_offer(
    *,
    case_status: ServiceCaseStatus,
    has_offer_from_me: bool,
) -> bool:
    return (
        case_status not in CASE_TERMINAL
        and case_status not in CASE_SINK
        and case_status
        in (ServiceCaseStatus.MATCHING, ServiceCaseStatus.OFFERS_READY)
        and not has_offer_from_me
    )


def mask_plate(value: str) -> str:
    compact = "".join(value.split())
    if len(compact) <= 4:
        return "***"
    return f"{compact[:2]}*** {compact[-4:]}"


def mask_location_to_district(value: str | None) -> str | None:
    if not value:
        return None
    parts = [part.strip() for part in value.split(",") if part.strip()]
    if len(parts) >= 2:
        return parts[-2]
    return parts[0] if parts else None


def _redact_pool_technician(
    dossier: CaseDossierResponse,
    *,
    viewer_user_id: UUID,
) -> CaseDossierResponse:
    dossier.vehicle.plate = mask_plate(dossier.vehicle.plate)
    dossier.vehicle.vin = None
    dossier.shell.location_label = mask_location_to_district(
        dossier.shell.location_label
    )
    if dossier.tow_snapshot is not None:
        dossier.tow_snapshot.pickup_label = mask_location_to_district(
            dossier.tow_snapshot.pickup_label
        )
        dossier.tow_snapshot.dropoff_label = mask_location_to_district(
            dossier.tow_snapshot.dropoff_label
        )

    own_matches = [
        match
        for match in dossier.matches
        if match.technician_user_id == viewer_user_id
        and match.visibility_state
        not in (
            CaseTechnicianMatchVisibility.HIDDEN,
            CaseTechnicianMatchVisibility.INVALIDATED,
        )
    ]
    dossier.viewer.other_match_count = sum(
        1
        for match in dossier.matches
        if match.technician_user_id != viewer_user_id
        and match.visibility_state != CaseTechnicianMatchVisibility.INVALIDATED
    )
    dossier.matches = own_matches

    dossier.notifications = [
        notification
        for notification in dossier.notifications
        if notification.technician_user_id == viewer_user_id
    ]
    dossier.tasks = []

    avg, count = compute_competitor_offer_average(
        dossier.offers, viewer_user_id=viewer_user_id
    )
    dossier.viewer.competitor_offer_average = avg
    dossier.viewer.competitor_offer_count = count
    dossier.offers = [
        _redact_offer_for_pool(offer, viewer_user_id=viewer_user_id)
        for offer in dossier.offers
    ]

    if dossier.assignment is not None:
        dossier.assignment.technician_display_name = mask_reviewer_name(
            dossier.assignment.technician_display_name
        )

    dossier.timeline_summary = [
        event
        for event in dossier.timeline_summary
        if _is_pool_timeline_event_visible(event, viewer_user_id=viewer_user_id)
    ]
    for event in dossier.timeline_summary:
        if event.actor_user_id != viewer_user_id:
            event.actor_user_id = None
    return dossier


def _is_pool_timeline_event_visible(
    event: TimelineEventSummary,
    *,
    viewer_user_id: UUID,
) -> bool:
    if event.event_type == CaseEventType.STATUS_UPDATE:
        return True
    notification_sent = getattr(CaseEventType, "CASE_NOTIFICATION_SENT", None)
    return (
        notification_sent is not None
        and event.event_type == notification_sent
        and event.actor_user_id == viewer_user_id
    )


def _redact_offer_for_pool(
    offer: OfferSummary,
    *,
    viewer_user_id: UUID,
) -> OfferSummary:
    if offer.technician_user_id == viewer_user_id:
        return offer
    redacted = offer.model_copy(deep=True)
    redacted.technician_display_label = mask_reviewer_name(
        offer.technician_display_label
    )
    redacted.technician_user_id = None
    redacted.amount = None
    return redacted
