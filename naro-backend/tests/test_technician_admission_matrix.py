"""PR 4 §9.1 — Cert matrix 12 kombinasyon pure tests.

`required_cert_kinds(type, mode)` her çağrıda aynı frozenset döner (immutable).
`has_valid_cert(cert)` expiry check + status check.

12 kombinasyon = 12 test case; brief §4 canonical table'a birebir uyum.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.models.technician import (
    ProviderMode,
    ProviderType,
    TechnicianCertificate,
    TechnicianCertificateKind,
    TechnicianCertificateStatus,
)
from app.services.technician_admission import (
    REQUIRED_CERTS,
    has_valid_cert,
    required_cert_kinds,
)

# ─── Matrix completeness ────────────────────────────────────────────────────


def test_matrix_has_12_entries() -> None:
    """6 provider_type × 2 provider_mode = 12 kombinasyon."""
    assert len(REQUIRED_CERTS) == 12


def test_matrix_all_combinations_present() -> None:
    """Her provider_type × provider_mode tupleı map'te olmalı."""
    expected_keys = {
        (pt, pm)
        for pt in ProviderType
        for pm in ProviderMode
    }
    assert set(REQUIRED_CERTS.keys()) == expected_keys


def test_frozenset_immutable() -> None:
    """I-PR4-5: matris değerleri frozenset — mutate edilemez."""
    for value in REQUIRED_CERTS.values():
        assert isinstance(value, frozenset)


# ─── 12 kombinasyon birebir ────────────────────────────────────────────────


_CK = TechnicianCertificateKind


def test_cekici_business() -> None:
    assert required_cert_kinds(ProviderType.CEKICI, ProviderMode.BUSINESS) == frozenset(
        {
            _CK.IDENTITY, _CK.VEHICLE_LICENSE, _CK.TOW_OPERATOR,
            _CK.INSURANCE, _CK.TAX_REGISTRATION, _CK.TRADE_REGISTRY,
        }
    )


def test_cekici_individual() -> None:
    """Individual mode trade_registry GEREKTİRMEZ (KOBİ/esnaf)."""
    assert required_cert_kinds(ProviderType.CEKICI, ProviderMode.INDIVIDUAL) == frozenset(
        {
            _CK.IDENTITY, _CK.VEHICLE_LICENSE, _CK.TOW_OPERATOR,
            _CK.INSURANCE, _CK.TAX_REGISTRATION,
        }
    )


def test_usta_business() -> None:
    assert required_cert_kinds(ProviderType.USTA, ProviderMode.BUSINESS) == frozenset(
        {_CK.IDENTITY, _CK.TAX_REGISTRATION, _CK.TRADE_REGISTRY}
    )


def test_usta_individual() -> None:
    assert required_cert_kinds(ProviderType.USTA, ProviderMode.INDIVIDUAL) == frozenset(
        {_CK.IDENTITY, _CK.TAX_REGISTRATION}
    )


def test_kaporta_boya_business() -> None:
    assert required_cert_kinds(ProviderType.KAPORTA_BOYA, ProviderMode.BUSINESS) == frozenset(
        {_CK.IDENTITY, _CK.TAX_REGISTRATION, _CK.TRADE_REGISTRY, _CK.INSURANCE}
    )


def test_kaporta_boya_individual() -> None:
    assert required_cert_kinds(ProviderType.KAPORTA_BOYA, ProviderMode.INDIVIDUAL) == frozenset(
        {_CK.IDENTITY, _CK.TAX_REGISTRATION, _CK.INSURANCE}
    )


def test_lastik_business() -> None:
    assert required_cert_kinds(ProviderType.LASTIK, ProviderMode.BUSINESS) == frozenset(
        {_CK.IDENTITY, _CK.TAX_REGISTRATION, _CK.TRADE_REGISTRY}
    )


def test_lastik_individual() -> None:
    assert required_cert_kinds(ProviderType.LASTIK, ProviderMode.INDIVIDUAL) == frozenset(
        {_CK.IDENTITY, _CK.TAX_REGISTRATION}
    )


def test_oto_elektrik_business() -> None:
    assert required_cert_kinds(ProviderType.OTO_ELEKTRIK, ProviderMode.BUSINESS) == frozenset(
        {_CK.IDENTITY, _CK.TAX_REGISTRATION, _CK.TRADE_REGISTRY, _CK.TECHNICAL}
    )


def test_oto_elektrik_individual() -> None:
    assert required_cert_kinds(ProviderType.OTO_ELEKTRIK, ProviderMode.INDIVIDUAL) == frozenset(
        {_CK.IDENTITY, _CK.TAX_REGISTRATION, _CK.TECHNICAL}
    )


def test_oto_aksesuar_business() -> None:
    assert required_cert_kinds(ProviderType.OTO_AKSESUAR, ProviderMode.BUSINESS) == frozenset(
        {_CK.IDENTITY, _CK.TAX_REGISTRATION, _CK.TRADE_REGISTRY}
    )


def test_oto_aksesuar_individual() -> None:
    assert required_cert_kinds(ProviderType.OTO_AKSESUAR, ProviderMode.INDIVIDUAL) == frozenset(
        {_CK.IDENTITY, _CK.TAX_REGISTRATION}
    )


# ─── Determinism ────────────────────────────────────────────────────────────


def test_same_input_same_output() -> None:
    """I-PR4-5: her çağrı aynı frozenset (identity değil, equality)."""
    a = required_cert_kinds(ProviderType.CEKICI, ProviderMode.BUSINESS)
    b = required_cert_kinds(ProviderType.CEKICI, ProviderMode.BUSINESS)
    assert a == b
    assert a is b  # Dict'ten aynı reference


# ─── has_valid_cert expiry logic ───────────────────────────────────────────


def _make_cert(
    *,
    status: TechnicianCertificateStatus,
    expires_at: datetime | None = None,
) -> TechnicianCertificate:
    cert = TechnicianCertificate(
        profile_id=uuid4(),
        kind=TechnicianCertificateKind.IDENTITY,
        title="Test Cert",
        status=status,
        expires_at=expires_at,
    )
    return cert


def test_valid_cert_approved_no_expiry() -> None:
    cert = _make_cert(status=TechnicianCertificateStatus.APPROVED)
    assert has_valid_cert(cert) is True


def test_valid_cert_approved_future_expiry() -> None:
    future = datetime.now(UTC) + timedelta(days=90)
    cert = _make_cert(
        status=TechnicianCertificateStatus.APPROVED, expires_at=future
    )
    assert has_valid_cert(cert) is True


def test_invalid_cert_approved_past_expiry() -> None:
    """I-PR4-6: expires_at geçmiş → geçersiz."""
    past = datetime.now(UTC) - timedelta(days=1)
    cert = _make_cert(
        status=TechnicianCertificateStatus.APPROVED, expires_at=past
    )
    assert has_valid_cert(cert) is False


def test_invalid_cert_pending_no_expiry() -> None:
    """Status approved olmazsa geçersiz — pending/rejected/expired."""
    cert = _make_cert(status=TechnicianCertificateStatus.PENDING)
    assert has_valid_cert(cert) is False


def test_invalid_cert_rejected() -> None:
    cert = _make_cert(status=TechnicianCertificateStatus.REJECTED)
    assert has_valid_cert(cert) is False


def test_invalid_cert_explicit_expired_status() -> None:
    cert = _make_cert(status=TechnicianCertificateStatus.EXPIRED)
    assert has_valid_cert(cert) is False


def test_has_valid_cert_now_parameter_overrides_clock() -> None:
    """Test reproducibility: caller explicit `now` verir."""
    fixed_now = datetime(2026, 6, 1, 12, 0, tzinfo=UTC)
    cert = _make_cert(
        status=TechnicianCertificateStatus.APPROVED,
        expires_at=datetime(2026, 5, 1, 12, 0, tzinfo=UTC),  # 1 ay geçmiş
    )
    assert has_valid_cert(cert, now=fixed_now) is False

    cert2 = _make_cert(
        status=TechnicianCertificateStatus.APPROVED,
        expires_at=datetime(2026, 7, 1, 12, 0, tzinfo=UTC),  # gelecekte
    )
    assert has_valid_cert(cert2, now=fixed_now) is True
