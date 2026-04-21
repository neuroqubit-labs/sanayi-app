"""Technician admission gate + cert matrix + recompute pipeline.

PR 4 brief §4 canonical cert matrix + §9 admission gate 9 maddesi.

Kullanım:
    result = await recompute_admission(session, profile_id)
    if not result.passed:
        await force_availability_offline(session, profile_id)

Invariants (PR 4 brief §8):
- I-PR4-5: REQUIRED_CERTS frozenset immutable
- I-PR4-6: has_valid_cert = status='approved' AND (expires_at NULL OR future)
- I-PR4-8: availability='available' set için admission_gate_passed=true
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import select, update

from app.models.technician import (
    ProviderMode,
    ProviderType,
    TechnicianAvailability,
    TechnicianCertificate,
    TechnicianCertificateKind,
    TechnicianCertificateStatus,
    TechnicianProfile,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


# ─── Cert matrix — 12 canonical kombinasyon (brief §4) ─────────────────────


_CK = TechnicianCertificateKind
_PT = ProviderType
_PM = ProviderMode

REQUIRED_CERTS: dict[
    tuple[ProviderType, ProviderMode],
    frozenset[TechnicianCertificateKind],
] = {
    (_PT.CEKICI, _PM.BUSINESS): frozenset(
        {
            _CK.IDENTITY,
            _CK.VEHICLE_LICENSE,
            _CK.TOW_OPERATOR,
            _CK.INSURANCE,
            _CK.TAX_REGISTRATION,
            _CK.TRADE_REGISTRY,
        }
    ),
    (_PT.CEKICI, _PM.INDIVIDUAL): frozenset(
        {
            _CK.IDENTITY,
            _CK.VEHICLE_LICENSE,
            _CK.TOW_OPERATOR,
            _CK.INSURANCE,
            _CK.TAX_REGISTRATION,
        }
    ),
    (_PT.USTA, _PM.BUSINESS): frozenset(
        {_CK.IDENTITY, _CK.TAX_REGISTRATION, _CK.TRADE_REGISTRY}
    ),
    (_PT.USTA, _PM.INDIVIDUAL): frozenset(
        {_CK.IDENTITY, _CK.TAX_REGISTRATION}
    ),
    (_PT.KAPORTA_BOYA, _PM.BUSINESS): frozenset(
        {_CK.IDENTITY, _CK.TAX_REGISTRATION, _CK.TRADE_REGISTRY, _CK.INSURANCE}
    ),
    (_PT.KAPORTA_BOYA, _PM.INDIVIDUAL): frozenset(
        {_CK.IDENTITY, _CK.TAX_REGISTRATION, _CK.INSURANCE}
    ),
    (_PT.LASTIK, _PM.BUSINESS): frozenset(
        {_CK.IDENTITY, _CK.TAX_REGISTRATION, _CK.TRADE_REGISTRY}
    ),
    (_PT.LASTIK, _PM.INDIVIDUAL): frozenset(
        {_CK.IDENTITY, _CK.TAX_REGISTRATION}
    ),
    (_PT.OTO_ELEKTRIK, _PM.BUSINESS): frozenset(
        {_CK.IDENTITY, _CK.TAX_REGISTRATION, _CK.TRADE_REGISTRY, _CK.TECHNICAL}
    ),
    (_PT.OTO_ELEKTRIK, _PM.INDIVIDUAL): frozenset(
        {_CK.IDENTITY, _CK.TAX_REGISTRATION, _CK.TECHNICAL}
    ),
    (_PT.OTO_AKSESUAR, _PM.BUSINESS): frozenset(
        {_CK.IDENTITY, _CK.TAX_REGISTRATION, _CK.TRADE_REGISTRY}
    ),
    (_PT.OTO_AKSESUAR, _PM.INDIVIDUAL): frozenset(
        {_CK.IDENTITY, _CK.TAX_REGISTRATION}
    ),
}


def required_cert_kinds(
    provider_type: ProviderType, provider_mode: ProviderMode
) -> frozenset[TechnicianCertificateKind]:
    """Cert matrisinden zorunlu kind seti. Eşleşme yoksa boş frozenset."""
    return REQUIRED_CERTS.get((provider_type, provider_mode), frozenset())


def has_valid_cert(cert: TechnicianCertificate, *, now: datetime | None = None) -> bool:
    """Cert geçerli mi: approved + (süresiz OR henüz süresi dolmamış)."""
    ref = now or datetime.now(UTC)
    if cert.status != TechnicianCertificateStatus.APPROVED:
        return False
    return not (cert.expires_at is not None and cert.expires_at <= ref)


# ─── Admission result ──────────────────────────────────────────────────────


@dataclass(slots=True, frozen=True)
class AdmissionResult:
    passed: bool
    provider_type: ProviderType
    provider_mode: ProviderMode
    required: frozenset[TechnicianCertificateKind]
    approved_valid: frozenset[TechnicianCertificateKind]
    missing: frozenset[TechnicianCertificateKind]
    reasons: tuple[str, ...]

    @property
    def failure_reason(self) -> str | None:
        return self.reasons[0] if self.reasons else None


async def recompute_admission(
    session: AsyncSession,
    profile_id: UUID,
    *,
    now: datetime | None = None,
) -> AdmissionResult:
    """Admission gate 9 maddesinden cert matrisi + temel business info kontrolü.

    V1: cert + business (legal_name + phone olması) kontrol edilir. Coverage/
    schedule/service_area kontrolü Gün 3'te signal model migration sonrası
    genişletilecek. Bu fazda cert + business yeterli admission değerlendirmesi.
    """
    profile = await session.get(TechnicianProfile, profile_id)
    if profile is None:
        return AdmissionResult(
            passed=False,
            provider_type=_PT.USTA,
            provider_mode=_PM.BUSINESS,
            required=frozenset(),
            approved_valid=frozenset(),
            missing=frozenset(),
            reasons=("profile_not_found",),
        )

    required = required_cert_kinds(profile.provider_type, profile.provider_mode)
    cert_stmt = select(TechnicianCertificate).where(
        TechnicianCertificate.profile_id == profile_id
    )
    certs = list((await session.execute(cert_stmt)).scalars().all())
    approved_valid: set[TechnicianCertificateKind] = {
        cert.kind for cert in certs if has_valid_cert(cert, now=now)
    }
    missing = required - approved_valid

    reasons: list[str] = []
    if missing:
        reasons.append("cert_missing")

    # Business info (V1 basit kontrol): legal_name + phone. business_info JSONB
    # alanında (TechnicianProfile.business_info); MVP için dict key kontrolü.
    business_info = dict(profile.business_info or {})
    if profile.provider_mode == ProviderMode.BUSINESS:
        if not business_info.get("legal_name"):
            reasons.append("business_legal_name_missing")
        if not business_info.get("phone"):
            reasons.append("business_phone_missing")

    if profile.deleted_at is not None:
        reasons.append("profile_deleted")

    passed = not reasons
    return AdmissionResult(
        passed=passed,
        provider_type=profile.provider_type,
        provider_mode=profile.provider_mode,
        required=required,
        approved_valid=frozenset(approved_valid),
        missing=missing,
        reasons=tuple(reasons),
    )


async def force_availability_offline(
    session: AsyncSession, profile_id: UUID
) -> None:
    """Admission fail → availability='offline' FORCE (PR 4 I-PR4-2)."""
    await session.execute(
        update(TechnicianProfile)
        .where(TechnicianProfile.id == profile_id)
        .values(availability=TechnicianAvailability.OFFLINE)
    )


async def bump_role_config_version(
    session: AsyncSession, profile_id: UUID
) -> int:
    """Monotonic bump (I-PR4-9). Flush sonrası yeni versiyon döner."""
    stmt = (
        update(TechnicianProfile)
        .where(TechnicianProfile.id == profile_id)
        .values(role_config_version=TechnicianProfile.role_config_version + 1)
        .returning(TechnicianProfile.role_config_version)
    )
    result = await session.execute(stmt)
    new_version: int | None = result.scalar_one_or_none()
    return int(new_version or 0)


# ─── Helpers ────────────────────────────────────────────────────────────────


async def assert_admission_for_available(
    session: AsyncSession, profile_id: UUID
) -> AdmissionResult:
    """availability='available' set öncesi çağrılır. Fail → caller 409 map."""
    result = await recompute_admission(session, profile_id)
    if not result.passed:
        raise AdmissionGateError(result)
    return result


class AdmissionGateError(Exception):
    """availability='available' set admission fail nedeniyle reddedildi."""

    def __init__(self, result: AdmissionResult):
        self.result = result
        super().__init__(
            f"admission_gate_unmet: reasons={list(result.reasons)}, "
            f"missing_certs={sorted(c.value for c in result.missing)}"
        )
