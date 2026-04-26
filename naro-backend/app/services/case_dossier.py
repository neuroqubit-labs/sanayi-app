from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.terminal_states import CASE_SINK, CASE_TERMINAL
from app.models.appointment import Appointment, AppointmentSource
from app.models.case import ServiceCase, ServiceRequestKind
from app.models.case_artifact import CaseAttachment, CaseDocument, CaseEvidenceItem
from app.models.case_audit import CaseEvent, CaseTone
from app.models.case_matching import (
    CaseTechnicianMatch,
    CaseTechnicianNotification,
)
from app.models.case_process import CaseApproval
from app.models.case_subtypes import (
    AccidentCase,
    BreakdownCase,
    MaintenanceCase,
    TowCase,
)
from app.models.offer import CaseOffer, CaseOfferStatus
from app.models.payment import PaymentOrder, PaymentState
from app.models.tow import TowFareSettlement
from app.models.user import User, UserRole
from app.repositories import case as case_repo
from app.schemas.case_dossier import (
    AccidentDetail,
    AppointmentSummary,
    ApprovalSummary,
    AssignmentSummary,
    BreakdownDetail,
    CaseAttachmentSummary,
    CaseDocumentSummary,
    CaseDossierResponse,
    CaseEvidenceSummary,
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
from app.services import case_matching
from app.services.case_dossier_redact import (
    can_pool_technician_send_offer,
    redact_dossier_for_viewer,
)


class CaseDossierError(Exception):
    pass


class CaseNotFoundError(CaseDossierError):
    pass


class NotPermittedError(CaseDossierError):
    pass


async def assemble_dossier(
    session: AsyncSession,
    *,
    case_id: UUID,
    viewer_user_id: UUID,
    viewer_role: UserRole,
    timeline_limit: int = 20,
) -> CaseDossierResponse:
    case, subtype = await case_repo.get_case_with_subtype(session, case_id)
    if case is None or case.deleted_at is not None:
        raise CaseNotFoundError(str(case_id))

    dossier_role = await _resolve_viewer_role(
        session,
        case=case,
        viewer_user_id=viewer_user_id,
        viewer_role=viewer_role,
    )
    if dossier_role is None:
        raise NotPermittedError(str(case_id))

    matches = await _load_matches(session, case.id)
    notifications = await _load_notifications(session, case.id)
    offers = await _load_offers(session, case.id)
    appointment = await _load_appointment(session, case.id)
    approvals = await _load_approvals(session, case.id)
    attachments = await _load_attachments(session, case.id)
    evidence = await _load_evidence(session, case.id)
    documents = await _load_documents(session, case.id)
    timeline = await _load_timeline(session, case.id, limit=timeline_limit)
    payment_orders = await _load_payment_orders(session, case.id)
    settlement = await _load_tow_settlement(session, case.id)
    users = await _load_related_users(
        session, case=case, offers=offers, timeline=timeline
    )

    viewer_ctx = await _build_viewer_context(
        session,
        case=case,
        viewer_user_id=viewer_user_id,
        role=dossier_role,
    )
    dossier = CaseDossierResponse(
        shell=_build_shell(case),
        vehicle=_build_vehicle(subtype),
        kind_detail=_build_kind_detail(case, subtype),
        attachments=[_attachment_summary(item) for item in attachments],
        evidence=[_evidence_summary(item) for item in evidence],
        documents=[_document_summary(item) for item in documents],
        matches=[_match_summary(item) for item in matches],
        notifications=[_notification_summary(item) for item in notifications],
        offers=[_offer_summary(item, users) for item in offers],
        appointment=_appointment_summary(appointment),
        assignment=_assignment_summary(case, offers, users),
        approvals=[_approval_summary(item) for item in approvals],
        payment_snapshot=_payment_snapshot(case, payment_orders),
        tow_snapshot=_tow_snapshot(case, subtype, settlement),
        timeline_summary=[_timeline_summary(item) for item in timeline],
        viewer=viewer_ctx,
    )
    return redact_dossier_for_viewer(dossier, viewer_user_id=viewer_user_id)


async def _resolve_viewer_role(
    session: AsyncSession,
    *,
    case: ServiceCase,
    viewer_user_id: UUID,
    viewer_role: UserRole,
) -> ViewerRole | None:
    if case.customer_user_id == viewer_user_id:
        return ViewerRole.CUSTOMER
    if viewer_role != UserRole.TECHNICIAN:
        return None
    if case.assigned_technician_id == viewer_user_id:
        return ViewerRole.ASSIGNED_TECHNICIAN
    if await _can_view_as_pool_technician(session, case=case, user_id=viewer_user_id):
        return ViewerRole.POOL_TECHNICIAN
    return None


async def _can_view_as_pool_technician(
    session: AsyncSession,
    *,
    case: ServiceCase,
    user_id: UUID,
) -> bool:
    if case.kind == ServiceRequestKind.TOWING:
        return False
    if case.status not in case_repo.POOL_VISIBLE_STATUSES:
        return False
    profile = await case_matching._get_profile_for_user(session, user_id)
    if profile is None:
        return False
    return case_matching.profile_matches_case_kind(case.kind, profile)


async def _load_matches(
    session: AsyncSession, case_id: UUID
) -> list[CaseTechnicianMatch]:
    rows = await session.execute(
        select(CaseTechnicianMatch)
        .where(
            CaseTechnicianMatch.case_id == case_id,
            CaseTechnicianMatch.invalidated_at.is_(None),
        )
        .order_by(CaseTechnicianMatch.score.desc(), CaseTechnicianMatch.computed_at.desc())
    )
    return list(rows.scalars().all())


async def _load_notifications(
    session: AsyncSession, case_id: UUID
) -> list[CaseTechnicianNotification]:
    rows = await session.execute(
        select(CaseTechnicianNotification)
        .where(CaseTechnicianNotification.case_id == case_id)
        .order_by(CaseTechnicianNotification.created_at.desc())
    )
    return list(rows.scalars().all())


async def _load_offers(session: AsyncSession, case_id: UUID) -> list[CaseOffer]:
    rows = await session.execute(
        select(CaseOffer)
        .where(CaseOffer.case_id == case_id)
        .order_by(CaseOffer.submitted_at.desc(), CaseOffer.id.desc())
    )
    return list(rows.scalars().all())


async def _load_appointment(
    session: AsyncSession, case_id: UUID
) -> Appointment | None:
    return (
        await session.execute(
            select(Appointment)
            .where(Appointment.case_id == case_id)
            .order_by(Appointment.requested_at.desc(), Appointment.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def _load_approvals(
    session: AsyncSession, case_id: UUID
) -> list[CaseApproval]:
    rows = await session.execute(
        select(CaseApproval)
        .where(CaseApproval.case_id == case_id)
        .order_by(CaseApproval.requested_at.desc(), CaseApproval.id.desc())
    )
    return list(rows.scalars().all())


async def _load_attachments(
    session: AsyncSession, case_id: UUID
) -> list[CaseAttachment]:
    rows = await session.execute(
        select(CaseAttachment)
        .where(CaseAttachment.case_id == case_id)
        .order_by(CaseAttachment.created_at.desc(), CaseAttachment.id.desc())
    )
    return list(rows.scalars().all())


async def _load_evidence(
    session: AsyncSession, case_id: UUID
) -> list[CaseEvidenceItem]:
    rows = await session.execute(
        select(CaseEvidenceItem)
        .where(CaseEvidenceItem.case_id == case_id)
        .order_by(CaseEvidenceItem.created_at.desc(), CaseEvidenceItem.id.desc())
    )
    return list(rows.scalars().all())


async def _load_documents(
    session: AsyncSession, case_id: UUID
) -> list[CaseDocument]:
    rows = await session.execute(
        select(CaseDocument)
        .where(CaseDocument.case_id == case_id)
        .order_by(CaseDocument.created_at.desc(), CaseDocument.id.desc())
    )
    return list(rows.scalars().all())


async def _load_timeline(
    session: AsyncSession, case_id: UUID, *, limit: int
) -> list[CaseEvent]:
    rows = await session.execute(
        select(CaseEvent)
        .where(CaseEvent.case_id == case_id)
        .order_by(CaseEvent.created_at.desc(), CaseEvent.id.desc())
        .limit(limit)
    )
    return list(rows.scalars().all())


async def _load_payment_orders(
    session: AsyncSession, case_id: UUID
) -> list[PaymentOrder]:
    rows = await session.execute(
        select(PaymentOrder)
        .where(PaymentOrder.case_id == case_id)
        .order_by(PaymentOrder.updated_at.desc(), PaymentOrder.id.desc())
    )
    return list(rows.scalars().all())


async def _load_tow_settlement(
    session: AsyncSession, case_id: UUID
) -> TowFareSettlement | None:
    return (
        await session.execute(
            select(TowFareSettlement).where(TowFareSettlement.case_id == case_id)
        )
    ).scalar_one_or_none()


async def _load_related_users(
    session: AsyncSession,
    *,
    case: ServiceCase,
    offers: list[CaseOffer],
    timeline: list[CaseEvent],
) -> dict[UUID, User]:
    user_ids = {offer.technician_id for offer in offers}
    user_ids.update(
        event.actor_user_id for event in timeline if event.actor_user_id is not None
    )
    if case.assigned_technician_id is not None:
        user_ids.add(case.assigned_technician_id)
    if not user_ids:
        return {}
    rows = await session.execute(select(User).where(User.id.in_(user_ids)))
    return {user.id: user for user in rows.scalars().all()}


async def _build_viewer_context(
    session: AsyncSession,
    *,
    case: ServiceCase,
    viewer_user_id: UUID,
    role: ViewerRole,
) -> ViewerContext:
    context = {}
    if role in (ViewerRole.POOL_TECHNICIAN, ViewerRole.ASSIGNED_TECHNICIAN):
        context = (
            await case_matching.context_for_cases(
                session,
                case_ids=[case.id],
                technician_user_id=viewer_user_id,
            )
        ).get(case.id, {})
    has_offer = bool(context.get("has_offer_from_me", False))
    return ViewerContext(
        role=role,
        is_matched_to_me=bool(context.get("is_matched_to_me", False)),
        match_reason_label=context.get("match_reason_label"),  # type: ignore[arg-type]
        match_badge=context.get("match_badge"),  # type: ignore[arg-type]
        is_notified_to_me=bool(context.get("is_notified_to_me", False)),
        has_offer_from_me=has_offer,
        can_send_offer=(
            role == ViewerRole.POOL_TECHNICIAN
            and can_pool_technician_send_offer(
                case_status=case.status, has_offer_from_me=has_offer
            )
        ),
        can_notify_to_me=(
            role == ViewerRole.CUSTOMER
            and case.assigned_technician_id is None
            and case.status not in CASE_TERMINAL
            and case.status not in CASE_SINK
        ),
    )


def _build_shell(case: ServiceCase) -> CaseShellSection:
    return CaseShellSection(
        id=case.id,
        kind=case.kind,
        status=case.status,
        urgency=case.urgency,
        origin=case.origin,
        title=case.title,
        subtitle=case.subtitle,
        summary=case.summary,
        location_label=case.location_label,
        wait_state=CaseWaitState(
            actor=case.wait_state_actor,
            label=case.wait_state_label,
            description=case.wait_state_description,
        ),
        created_at=case.created_at,
        updated_at=case.updated_at,
        closed_at=case.closed_at,
    )


def _build_vehicle(subtype: object | None) -> VehicleSnapshotSection:
    return VehicleSnapshotSection(
        plate=str(getattr(subtype, "snapshot_plate", "")),
        make=getattr(subtype, "snapshot_make", None),
        model=getattr(subtype, "snapshot_model", None),
        year=getattr(subtype, "snapshot_year", None),
        fuel_type=getattr(subtype, "snapshot_fuel_type", None),
        vin=getattr(subtype, "snapshot_vin", None),
        current_km=getattr(subtype, "snapshot_current_km", None),
    )


def _build_kind_detail(
    case: ServiceCase, subtype: object | None
) -> AccidentDetail | BreakdownDetail | MaintenanceDetail | TowingDetail:
    if case.kind == ServiceRequestKind.ACCIDENT and isinstance(subtype, AccidentCase):
        return AccidentDetail(
            kind=ServiceRequestKind.ACCIDENT,
            damage_area=subtype.damage_area,
            damage_severity=subtype.damage_severity,
            counterparty_count=subtype.counterparty_count,
            counterparty_note=subtype.counterparty_note,
            kasko_selected=subtype.kasko_selected,
            sigorta_selected=subtype.sigorta_selected,
            kasko_brand=subtype.kasko_brand,
            sigorta_brand=subtype.sigorta_brand,
            ambulance_contacted=subtype.ambulance_contacted,
            report_method=subtype.report_method,
            emergency_acknowledged=subtype.emergency_acknowledged,
        )
    if case.kind == ServiceRequestKind.BREAKDOWN and isinstance(subtype, BreakdownCase):
        return BreakdownDetail(
            kind=ServiceRequestKind.BREAKDOWN,
            breakdown_category=subtype.breakdown_category,
            symptoms=subtype.symptoms,
            vehicle_drivable=subtype.vehicle_drivable,
            on_site_repair_requested=subtype.on_site_repair_requested,
            valet_requested=subtype.valet_requested,
            pickup_preference=subtype.pickup_preference,
            price_preference=subtype.price_preference,
        )
    if case.kind == ServiceRequestKind.MAINTENANCE and isinstance(subtype, MaintenanceCase):
        return MaintenanceDetail(
            kind=ServiceRequestKind.MAINTENANCE,
            maintenance_category=subtype.maintenance_category,
            maintenance_detail=subtype.maintenance_detail,
            maintenance_tier=subtype.maintenance_tier,
            service_style_preference=subtype.service_style_preference,
            mileage_km=subtype.mileage_km,
            valet_requested=subtype.valet_requested,
            pickup_preference=subtype.pickup_preference,
            price_preference=subtype.price_preference,
        )
    if case.kind == ServiceRequestKind.TOWING and isinstance(subtype, TowCase):
        return TowingDetail(
            kind=ServiceRequestKind.TOWING,
            tow_mode=subtype.tow_mode,
            tow_stage=subtype.tow_stage,
            required_equipment=subtype.tow_required_equipment,
            incident_reason=subtype.incident_reason,
            scheduled_at=subtype.scheduled_at,
            pickup_label=subtype.pickup_address,
            dropoff_label=subtype.dropoff_address,
            parent_case_id=subtype.parent_case_id,
        )
    raise CaseNotFoundError(f"case subtype missing for {case.kind.value}")


def _attachment_summary(item: CaseAttachment) -> CaseAttachmentSummary:
    return CaseAttachmentSummary(
        id=item.id,
        kind=item.kind,
        title=item.title,
        subtitle=item.subtitle,
        status_label=item.status_label,
        media_asset_id=item.media_asset_id,
        created_at=item.created_at,
    )


def _evidence_summary(item: CaseEvidenceItem) -> CaseEvidenceSummary:
    return CaseEvidenceSummary(
        id=item.id,
        kind=item.kind,
        title=item.title,
        subtitle=item.subtitle,
        actor=item.actor,
        source_label=item.source_label,
        status_label=item.status_label,
        media_asset_id=item.media_asset_id,
        created_at=item.created_at,
    )


def _document_summary(item: CaseDocument) -> CaseDocumentSummary:
    return CaseDocumentSummary(
        id=item.id,
        kind=item.kind,
        title=item.title,
        subtitle=item.subtitle,
        source_label=item.source_label,
        status_label=item.status_label,
        media_asset_id=item.media_asset_id,
        created_at=item.created_at,
    )


def _match_summary(item: CaseTechnicianMatch) -> MatchSummary:
    return MatchSummary(
        id=item.id,
        technician_user_id=item.technician_user_id,
        score=item.score,
        reason_label=item.reason_label,
        visibility_state=item.visibility_state,
    )


def _notification_summary(item: CaseTechnicianNotification) -> NotificationSummary:
    return NotificationSummary(
        id=item.id,
        technician_user_id=item.technician_user_id,
        status=item.status,
        created_at=item.created_at,
        seen_at=item.seen_at,
        responded_at=item.responded_at,
    )


def _offer_summary(item: CaseOffer, users: dict[UUID, User]) -> OfferSummary:
    user = users.get(item.technician_id)
    return OfferSummary(
        id=item.id,
        technician_user_id=item.technician_id,
        technician_display_label=user.full_name if user else None,
        amount=item.amount,
        currency=item.currency,
        status=item.status,
        slot_proposal=item.slot_proposal,
        created_at=item.submitted_at,
    )


def _appointment_summary(item: Appointment | None) -> AppointmentSummary | None:
    if item is None:
        return None
    return AppointmentSummary(
        id=item.id,
        status=item.status,
        slot=item.slot,
        slot_kind=item.slot_kind,
        source=AppointmentSource(item.source),
        counter_proposal=item.counter_proposal,
        expires_at=item.expires_at,
    )


def _assignment_summary(
    case: ServiceCase,
    offers: list[CaseOffer],
    users: dict[UUID, User],
) -> AssignmentSummary | None:
    if case.assigned_technician_id is None:
        return None
    accepted_offer = next(
        (
            offer
            for offer in offers
            if offer.technician_id == case.assigned_technician_id
            and offer.status == CaseOfferStatus.ACCEPTED
        ),
        None,
    )
    user = users.get(case.assigned_technician_id)
    return AssignmentSummary(
        technician_user_id=case.assigned_technician_id,
        technician_display_name=user.full_name if user and user.full_name else "Usta",
        accepted_offer_id=accepted_offer.id if accepted_offer else None,
        assigned_at=accepted_offer.accepted_at if accepted_offer and accepted_offer.accepted_at else case.updated_at,
    )


def _approval_summary(item: CaseApproval) -> ApprovalSummary:
    return ApprovalSummary(
        id=item.id,
        kind=item.kind,
        title=item.title,
        description=item.description,
        amount=item.amount,
        currency=item.currency,
        status=item.status,
        payment_state=item.payment_state,
        created_at=item.requested_at,
    )


def _payment_snapshot(
    case: ServiceCase, payment_orders: list[PaymentOrder]
) -> PaymentSnapshot:
    return PaymentSnapshot(
        billing_state=case.billing_state,
        estimate_amount=case.estimate_amount,
        total_amount=case.total_amount,
        preauth_held=_sum_order_amounts(payment_orders, PaymentState.PREAUTH_HELD),
        captured=_sum_order_amounts(payment_orders, PaymentState.CAPTURED),
        refunded=_sum_order_amounts(payment_orders, PaymentState.REFUNDED),
        last_event_at=max((order.updated_at for order in payment_orders), default=None),
    )


def _sum_order_amounts(
    payment_orders: list[PaymentOrder], state: PaymentState
) -> Decimal | None:
    total = sum(
        (order.amount for order in payment_orders if order.state == state),
        Decimal("0.00"),
    )
    return total if total > 0 else None


def _tow_snapshot(
    case: ServiceCase,
    subtype: object | None,
    settlement: TowFareSettlement | None,
) -> TowSnapshot | None:
    if case.kind != ServiceRequestKind.TOWING or not isinstance(subtype, TowCase):
        return None
    return TowSnapshot(
        tow_mode=subtype.tow_mode,
        tow_stage=subtype.tow_stage,
        scheduled_at=subtype.scheduled_at,
        pickup_label=subtype.pickup_address,
        dropoff_label=subtype.dropoff_address,
        quote=subtype.tow_fare_quote,
        preauth_amount=settlement.cap_amount if settlement and settlement.preauth_id else None,
        captured_amount=settlement.final_amount if settlement else None,
    )


def _timeline_summary(item: CaseEvent) -> TimelineEventSummary:
    return TimelineEventSummary(
        id=item.id,
        event_type=item.event_type,
        title=item.title,
        tone=CaseTone(item.tone),
        actor_user_id=item.actor_user_id,
        context_summary=_context_summary(item.context),
        occurred_at=item.created_at,
    )


def _context_summary(context: dict[str, object]) -> str | None:
    summary = context.get("summary") or context.get("message") or context.get("reason")
    return summary if isinstance(summary, str) and summary.strip() else None
