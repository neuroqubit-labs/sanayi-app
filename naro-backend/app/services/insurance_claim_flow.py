"""Insurance claim state machine — submit/accept/reject/mark_paid atomic flow.

State machine:
    submitted ──┬─→ accepted ──→ paid    (terminal)
                └─→ rejected            (terminal)
    accepted ──→ rejected                (sigorta son dakika iptal)

Kurallar:
- [K1] drafted yok — submit_claim direkt submitted insert eder
- [K2] submitted sonrası düzenleme yok — taahhüt
- [K3] partial unique case başına 1 aktif claim; reject sonrası yeni submit serbest
- [K4] terminal: paid, rejected; revize yolu yok (submitted→drafted yok)

Her transition:
- insurance_claims satırını update
- case_events append (insurance_claim_submitted/accepted/paid/rejected)
- Opsiyonel notification_intent (müşteri için payment_review, vb.)
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case_audit import (
    CaseEventType,
    CaseNotificationIntentType,
    CaseTone,
)
from app.models.insurance_claim import (
    InsuranceClaim,
    InsuranceClaimStatus,
    InsuranceCoverageKind,
)
from app.repositories import insurance_claim as claim_repo
from app.services.case_events import append_event, publish_intent

# ─── Exceptions ────────────────────────────────────────────────────────────


class ClaimNotFoundError(LookupError):
    pass


class ClaimAlreadyActiveError(ValueError):
    """Case'de aktif (submitted/accepted/paid) claim zaten var."""


class InvalidClaimTransitionError(ValueError):
    def __init__(
        self, current: InsuranceClaimStatus, new: InsuranceClaimStatus
    ) -> None:
        super().__init__(
            f"Invalid insurance_claim transition: {current.value} -> {new.value}"
        )


# ─── Allowed transitions ───────────────────────────────────────────────────

S = InsuranceClaimStatus

ALLOWED_TRANSITIONS: dict[InsuranceClaimStatus, set[InsuranceClaimStatus]] = {
    S.SUBMITTED: {S.ACCEPTED, S.REJECTED},
    S.ACCEPTED: {S.PAID, S.REJECTED},
    S.PAID: set(),       # terminal
    S.REJECTED: set(),   # terminal — yeni submit ile yeni satır açılır
}


# ─── Flow fonksiyonları ────────────────────────────────────────────────────


async def submit_claim(
    session: AsyncSession,
    *,
    case_id: UUID,
    policy_number: str,
    insurer: str,
    coverage_kind: InsuranceCoverageKind,
    estimate_amount: Decimal | None = None,
    policy_holder_name: str | None = None,
    policy_holder_phone: str | None = None,
    currency: str = "TRY",
    notes: str | None = None,
    insurer_claim_reference: str | None = None,
    created_by_user_id: UUID,
    created_by_snapshot_name: str | None = None,
) -> InsuranceClaim:
    """Mobil draft → backend submit. Aktif claim varsa ihlal (partial unique)."""
    # Pre-check friendly error (race'de yine partial unique savunur)
    active = await claim_repo.get_active_claim_for_case(session, case_id)
    if active is not None:
        raise ClaimAlreadyActiveError(
            f"case {case_id} için aktif claim {active.id} mevcut"
        )

    try:
        claim = await claim_repo.insert_submitted(
            session,
            case_id=case_id,
            policy_number=policy_number,
            insurer=insurer,
            coverage_kind=coverage_kind,
            estimate_amount=estimate_amount,
            policy_holder_name=policy_holder_name,
            policy_holder_phone=policy_holder_phone,
            currency=currency,
            notes=notes,
            insurer_claim_reference=insurer_claim_reference,
            created_by_user_id=created_by_user_id,
            created_by_snapshot_name=created_by_snapshot_name,
        )
    except IntegrityError as exc:
        # Partial unique ihlali (concurrent submit)
        raise ClaimAlreadyActiveError(
            f"case {case_id} için aktif claim zaten açılmış (race)"
        ) from exc

    await append_event(
        session,
        case_id=case_id,
        event_type=CaseEventType.INSURANCE_CLAIM_SUBMITTED,
        title=f"Sigorta dosyası gönderildi: {insurer}",
        body=f"Poliçe {policy_number} — {coverage_kind.value}",
        tone=CaseTone.INFO,
        actor_user_id=created_by_user_id,
        context={
            "claim_id": str(claim.id),
            "insurer": insurer,
            "coverage_kind": coverage_kind.value,
            "estimate_amount": str(estimate_amount) if estimate_amount else None,
        },
    )
    await publish_intent(
        session,
        case_id=case_id,
        intent_type=CaseNotificationIntentType.CUSTOMER_APPROVAL_NEEDED,
        actor="customer",
        title="Sigorta dosyası açıldı",
        body=f"{insurer} / {coverage_kind.value} dosyası onay bekliyor.",
        route_hint=f"/vaka/{case_id}/sigorta",
    )
    return claim


async def _transition(
    session: AsyncSession,
    claim_id: UUID,
    new_status: InsuranceClaimStatus,
) -> InsuranceClaim:
    claim = await claim_repo.get_claim(session, claim_id)
    if claim is None:
        raise ClaimNotFoundError(str(claim_id))
    if new_status not in ALLOWED_TRANSITIONS[claim.status]:
        raise InvalidClaimTransitionError(claim.status, new_status)
    return claim


async def accept_claim(
    session: AsyncSession,
    claim_id: UUID,
    *,
    accepted_amount: Decimal,
    insurer_claim_reference: str | None = None,
    actor_user_id: UUID,
) -> InsuranceClaim:
    """submitted → accepted. Sigortacı onaylı tutar belirtir."""
    claim = await _transition(session, claim_id, InsuranceClaimStatus.ACCEPTED)

    now = datetime.now(UTC)
    values: dict[str, object] = {
        "status": InsuranceClaimStatus.ACCEPTED,
        "accepted_amount": accepted_amount,
        "accepted_at": now,
    }
    if insurer_claim_reference is not None:
        values["insurer_claim_reference"] = insurer_claim_reference

    await session.execute(
        update(InsuranceClaim)
        .where(InsuranceClaim.id == claim_id)
        .values(**values)
    )
    await append_event(
        session,
        case_id=claim.case_id,
        event_type=CaseEventType.INSURANCE_CLAIM_ACCEPTED,
        title="Sigorta onayı alındı",
        body=f"Onaylanan tutar: {accepted_amount} {claim.currency}",
        tone=CaseTone.SUCCESS,
        actor_user_id=actor_user_id,
        context={
            "claim_id": str(claim_id),
            "accepted_amount": str(accepted_amount),
        },
    )
    await publish_intent(
        session,
        case_id=claim.case_id,
        intent_type=CaseNotificationIntentType.PAYMENT_REVIEW,
        actor="customer",
        title="Sigorta dosyası onaylandı",
        body=f"Onaylanan tutar: {accepted_amount} {claim.currency}",
        route_hint=f"/vaka/{claim.case_id}/sigorta",
    )
    await session.refresh(claim)
    return claim


async def reject_claim(
    session: AsyncSession,
    claim_id: UUID,
    *,
    reason: str,
    actor_user_id: UUID,
) -> InsuranceClaim:
    """submitted/accepted → rejected. Karar [K3]: aktif dondurulur; yeni submit serbest."""
    claim = await _transition(session, claim_id, InsuranceClaimStatus.REJECTED)

    now = datetime.now(UTC)
    await session.execute(
        update(InsuranceClaim)
        .where(InsuranceClaim.id == claim_id)
        .values(
            status=InsuranceClaimStatus.REJECTED,
            rejected_at=now,
            rejection_reason=reason,
        )
    )
    await append_event(
        session,
        case_id=claim.case_id,
        event_type=CaseEventType.INSURANCE_CLAIM_REJECTED,
        title="Sigorta dosyası reddedildi",
        body=reason,
        tone=CaseTone.WARNING,
        actor_user_id=actor_user_id,
        context={
            "claim_id": str(claim_id),
            "reason": reason,
        },
    )
    await publish_intent(
        session,
        case_id=claim.case_id,
        intent_type=CaseNotificationIntentType.EVIDENCE_MISSING,
        actor="customer",
        title="Sigorta dosyası reddedildi",
        body=f"Sebep: {reason}. Yeni dosya açılabilir.",
        route_hint=f"/vaka/{claim.case_id}/sigorta",
    )
    await session.refresh(claim)
    return claim


async def mark_paid(
    session: AsyncSession,
    claim_id: UUID,
    *,
    paid_amount: Decimal | None = None,
    actor_user_id: UUID,
) -> InsuranceClaim:
    """accepted → paid. paid_amount None ise accepted_amount kullanılır."""
    claim = await _transition(session, claim_id, InsuranceClaimStatus.PAID)

    if paid_amount is None:
        if claim.accepted_amount is None:
            raise ValueError(
                "paid_amount None ve accepted_amount da None — tutar belirsiz"
            )
        paid_amount = claim.accepted_amount

    now = datetime.now(UTC)
    await session.execute(
        update(InsuranceClaim)
        .where(InsuranceClaim.id == claim_id)
        .values(
            status=InsuranceClaimStatus.PAID,
            paid_amount=paid_amount,
            paid_at=now,
        )
    )
    await append_event(
        session,
        case_id=claim.case_id,
        event_type=CaseEventType.INSURANCE_CLAIM_PAID,
        title="Sigorta ödemesi alındı",
        body=f"Ödenen tutar: {paid_amount} {claim.currency}",
        tone=CaseTone.SUCCESS,
        actor_user_id=actor_user_id,
        context={
            "claim_id": str(claim_id),
            "paid_amount": str(paid_amount),
        },
    )
    await session.refresh(claim)
    return claim
