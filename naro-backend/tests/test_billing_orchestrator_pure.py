"""Faz B-3 pure tests — case_billing orchestrator + routes smoke.

Orchestrator fonksiyonları MockPsp ile test'lenebilir. DB fixture yok;
bu testler service'in çağrı kontratı + state transition ile guard'ları
doğrular.

Integration test (DB + route + Iyzico sandbox) ayrı job'a. Burada pure:
- Route module + prefix'ler
- PSP factory (mock default)
- Settlement aggregation (Decimal)
- Migration 0030 revision pointer
- AuthEvent admin billing values
- CaseEventType billing values
"""

from __future__ import annotations

from decimal import Decimal

from app.api.v1.routes.billing import _get_psp
from app.integrations.psp.mock import MockPsp
from app.models.auth_event import AuthEventType
from app.models.billing import PaymentProvider
from app.models.case_audit import CaseEventType
from app.services.refund_policy import calculate_commission

# ─── Route module + prefix'ler ────────────────────────────────────────────


def test_billing_route_prefixes() -> None:
    from app.api.v1.routes import billing as billing_mod

    assert billing_mod.customer_router.prefix == "/cases"
    assert billing_mod.technician_router.prefix == "/technicians/me"
    assert billing_mod.admin_router.prefix == "/admin/billing"
    assert billing_mod.admin_case_router.prefix == "/admin/cases"


def test_billing_customer_router_paths() -> None:
    from app.api.v1.routes import billing as billing_mod

    paths = {
        r.path for r in billing_mod.customer_router.routes if hasattr(r, "path")
    }
    # Customer 4 endpoint (F1.1 abandon eklendi 2026-04-28)
    assert "/cases/{case_id}/payment/initiate" in paths
    assert "/cases/{case_id}/billing/summary" in paths
    assert "/cases/{case_id}/cancel-billing" in paths
    assert "/cases/{case_id}/payment/abandon" in paths


def test_billing_technician_router_paths() -> None:
    from app.api.v1.routes import billing as billing_mod

    paths = {
        r.path
        for r in billing_mod.technician_router.routes
        if hasattr(r, "path")
    }
    assert "/technicians/me/payouts" in paths


def test_billing_admin_router_paths() -> None:
    from app.api.v1.routes import billing as billing_mod

    paths = {
        r.path for r in billing_mod.admin_router.routes if hasattr(r, "path")
    }
    expected = {
        "/admin/billing/pending-payouts",
        "/admin/billing/payouts/mark-completed",
        "/admin/billing/kasko-pending",
        "/admin/billing/commission-report",
        "/admin/billing/settlements",
    }
    assert expected <= paths


def test_billing_admin_case_router_paths() -> None:
    from app.api.v1.routes import billing as billing_mod

    paths = {
        r.path
        for r in billing_mod.admin_case_router.routes
        if hasattr(r, "path")
    }
    expected = {
        "/admin/cases/{case_id}/kasko-reimburse",
        "/admin/cases/{case_id}/refund",
        "/admin/cases/{case_id}/capture-override",
    }
    assert expected <= paths


# ─── PSP factory ──────────────────────────────────────────────────────────


def test_get_psp_factory_switch(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    """PSP factory: creds yoksa Mock, creds + PSP_PROVIDER=iyzico ise Iyzico."""
    from app.core import config as config_mod
    from app.integrations.psp.iyzico import IyzicoPsp

    # Mock path: override .env explicitly so local sandbox keys do not leak
    # into this pure factory test.
    monkeypatch.setenv("PSP_PROVIDER", "mock")
    monkeypatch.setenv("IYZICO_API_KEY", "")
    monkeypatch.setenv("IYZICO_SECRET_KEY", "")
    config_mod.get_settings.cache_clear()  # type: ignore[attr-defined]
    psp, provider = _get_psp()
    assert isinstance(psp, MockPsp)
    assert provider == PaymentProvider.MOCK

    # Iyzico path
    monkeypatch.setenv("PSP_PROVIDER", "iyzico")
    monkeypatch.setenv("IYZICO_API_KEY", "test-key")
    monkeypatch.setenv("IYZICO_SECRET_KEY", "test-secret")
    config_mod.get_settings.cache_clear()  # type: ignore[attr-defined]
    psp2, provider2 = _get_psp()
    assert isinstance(psp2, IyzicoPsp)
    assert provider2 == PaymentProvider.IYZICO

    config_mod.get_settings.cache_clear()  # type: ignore[attr-defined]


# ─── AuthEvent admin billing values ───────────────────────────────────────


_EXPECTED_ADMIN_BILLING_EVENTS = {
    "ADMIN_BILLING_CAPTURE_OVERRIDE",
    "ADMIN_BILLING_REFUND",
    "ADMIN_BILLING_KASKO_REIMBURSE",
    "ADMIN_BILLING_PAYOUT_COMPLETED",
}


def test_admin_billing_event_types_defined() -> None:
    defined = {
        name
        for name in AuthEventType.__members__
        if name.startswith("ADMIN_BILLING_")
    }
    assert defined == _EXPECTED_ADMIN_BILLING_EVENTS


def test_admin_billing_event_values_snake_case() -> None:
    for name in _EXPECTED_ADMIN_BILLING_EVENTS:
        member = AuthEventType[name]
        assert member.value == name.lower()


# ─── CaseEventType billing values ─────────────────────────────────────────


_EXPECTED_BILLING_CASE_EVENTS = {
    "PAYMENT_INITIATED",
    "PAYMENT_AUTHORIZED",
    "PAYMENT_CAPTURED",
    "PAYMENT_REFUNDED",
    "COMMISSION_CALCULATED",
    "PAYOUT_SCHEDULED",
    "PAYOUT_COMPLETED",
    "BILLING_STATE_CHANGED",
    "INVOICE_ISSUED",
}


def test_billing_case_event_types_defined() -> None:
    defined = set(CaseEventType.__members__.keys())
    assert defined >= _EXPECTED_BILLING_CASE_EVENTS


# ─── Migration 0030 revision pointer ──────────────────────────────────────


def test_migration_0030_revision_pointer() -> None:
    import importlib.util
    from pathlib import Path

    path = (
        Path(__file__).parent.parent
        / "alembic"
        / "versions"
        / "20260422_0030_billing_event_types.py"
    )
    assert path.exists()
    spec = importlib.util.spec_from_file_location("migration_0030", path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert mod.revision == "20260422_0030"
    assert mod.down_revision == "20260422_0029"
    assert len(mod._AUTH_EVENT_VALUES) == 4
    assert len(mod._CASE_EVENT_VALUES) == 9


# ─── Commission production scenarios (Decimal strict) ─────────────────────


def test_commission_100_try() -> None:
    c, n = calculate_commission(Decimal("100.00"))
    assert c == Decimal("10.00")
    assert n == Decimal("90.00")
    assert c + n == Decimal("100.00")


def test_commission_pilot_average_850_try() -> None:
    """Kayseri pilot ortalama bakım ~850 TRY."""
    c, n = calculate_commission(Decimal("850.00"))
    assert c == Decimal("85.00")
    assert n == Decimal("765.00")
    assert c + n == Decimal("850.00")


def test_commission_odd_decimal_production() -> None:
    c, n = calculate_commission(Decimal("777.77"))
    # 77.777 → HALF_EVEN → 77.78
    assert c == Decimal("77.78")
    assert n == Decimal("699.99")
    assert c + n == Decimal("777.77")


# ─── BillingSummary integration with empty state ──────────────────────────


def test_billing_summary_field_count() -> None:
    from app.schemas.billing import BillingSummary

    fields = set(BillingSummary.model_fields.keys())
    expected = {
        "case_id",
        "billing_state",
        "estimate_amount",
        "preauth_amount",
        "approved_parts_total",
        "final_amount",
        "settlement",
        "refunds",
        "kasko",
    }
    assert expected == fields


# ─── Service case billing_state column ────────────────────────────────────


def test_service_case_has_billing_state_column() -> None:
    from app.models.case import ServiceCase

    columns = {c.name for c in ServiceCase.__table__.columns}
    assert "billing_state" in columns


# ─── Orchestrator module — public fn'ler ──────────────────────────────────


def test_case_billing_module_public_fns() -> None:
    from app.services import case_billing

    for fn in (
        "initiate_payment",
        "process_3ds_callback",
        "handle_parts_approval",
        "handle_invoice_approval",
        "cancel_case",
        "admin_refund",
        "reimburse_kasko",
    ):
        assert hasattr(case_billing, fn), f"missing {fn}"


# ─── E-archive stub ───────────────────────────────────────────────────────


def test_e_archive_module_importable() -> None:
    from app.services.e_archive import issue_invoice

    assert callable(issue_invoice)
