"""Central terminal-state constants — B-P2-5 (2026-04-23).

Önceden her service dosyası kendi local TERMINAL set'ini yazıyordu.
Tek kaynak tanım → drift riski kapanır.

Brief: be-pilot-finale-lifecycle-fixes § B-P2-5.
"""

from __future__ import annotations

from app.models.appointment import AppointmentStatus
from app.models.case import ServiceCaseStatus
from app.models.case_process import CaseApprovalStatus
from app.models.insurance_claim import InsuranceClaimStatus
from app.models.offer import CaseOfferStatus
from app.services.case_billing_state import BillingState

# ─── Case shell ────────────────────────────────────────────────────────

CASE_TERMINAL: frozenset[ServiceCaseStatus] = frozenset(
    {ServiceCaseStatus.COMPLETED, ServiceCaseStatus.CANCELLED}
)
"""Completed + cancelled; her ikisi de closed_at set eder."""

CASE_SINK: frozenset[ServiceCaseStatus] = frozenset(
    {ServiceCaseStatus.ARCHIVED}
)
"""Archived — soft kaldırıldı, transition gelmez."""

# ─── Billing ───────────────────────────────────────────────────────────

BILLING_TERMINAL: frozenset[BillingState] = frozenset(
    {
        BillingState.SETTLED,
        BillingState.CANCELLED,
        BillingState.PREAUTH_FAILED,
    }
)
"""PREAUTH_FAILED de terminal sayılır (B-P0-3: retry path ESTIMATE'e
dönüşü içerir ama "mevcut denemeyi bitmiş" semantic'i korunur)."""

# ─── Tow ───────────────────────────────────────────────────────────────

# tow stage import'u service katmanında — circular'dan kaçınmak için
# runtime'da import; burada string listesi yeter.
TOW_TERMINAL_STAGES: frozenset[str] = frozenset(
    {"delivered", "cancelled"}
)

# ─── Appointment ───────────────────────────────────────────────────────

APPOINTMENT_TERMINAL: frozenset[AppointmentStatus] = frozenset(
    {
        AppointmentStatus.APPROVED,
        AppointmentStatus.DECLINED,
        AppointmentStatus.EXPIRED,
        AppointmentStatus.CANCELLED,
    }
)

# ─── Approval ──────────────────────────────────────────────────────────

APPROVAL_TERMINAL: frozenset[CaseApprovalStatus] = frozenset(
    {CaseApprovalStatus.APPROVED, CaseApprovalStatus.REJECTED}
)

# ─── Insurance claim ───────────────────────────────────────────────────

INSURANCE_TERMINAL: frozenset[InsuranceClaimStatus] = frozenset(
    {InsuranceClaimStatus.PAID, InsuranceClaimStatus.REJECTED}
)

# ─── Offer ─────────────────────────────────────────────────────────────

OFFER_TERMINAL: frozenset[CaseOfferStatus] = frozenset(
    {
        CaseOfferStatus.ACCEPTED,
        CaseOfferStatus.REJECTED,
        CaseOfferStatus.WITHDRAWN,
        CaseOfferStatus.EXPIRED,
    }
)
"""Accepted + reject + withdrawn + expired — artık transition yok."""
