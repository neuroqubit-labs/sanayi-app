"""PR 9 pure tests — admin request schemas + AuthEventType contract +
service layer wiring + migration pointer + Prometheus counter.

DB-bağımsız; integration admin tests ayrı job'a.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.auth_event import AuthEventType
from app.models.case import ServiceCaseStatus
from app.models.user import UserApprovalStatus, UserStatus
from app.observability.metrics import admin_action_total
from app.schemas.admin import (
    AdminAuditItem,
    CaseOverrideRequest,
    CertificateRejectRequest,
    TechnicianApproveRequest,
    TechnicianPendingItem,
    TechnicianRejectRequest,
    TechnicianSuspendRequest,
    UserAdminView,
    UserSuspendRequest,
)
from app.services import admin_actions

# ─── Request schemas ──────────────────────────────────────────────────────


def test_technician_approve_request_optional_note() -> None:
    req = TechnicianApproveRequest()
    assert req.note is None


def test_technician_approve_request_rejects_extra() -> None:
    with pytest.raises(ValidationError):
        TechnicianApproveRequest(hacker="leak")  # type: ignore[call-arg]


def test_technician_reject_request_requires_reason() -> None:
    with pytest.raises(ValidationError):
        TechnicianRejectRequest()  # type: ignore[call-arg]


def test_technician_reject_request_min_length() -> None:
    with pytest.raises(ValidationError):
        TechnicianRejectRequest(reason="")


def test_technician_suspend_request_until_optional() -> None:
    req = TechnicianSuspendRequest(reason="dolandırıcılık şüphesi")
    assert req.until is None


def test_technician_suspend_request_until_valid() -> None:
    req = TechnicianSuspendRequest(
        reason="incele", until=datetime(2026, 5, 1, tzinfo=UTC)
    )
    assert req.until is not None


def test_cert_reject_request_min_length() -> None:
    with pytest.raises(ValidationError):
        CertificateRejectRequest(reviewer_note="")


def test_case_override_request_shape() -> None:
    req = CaseOverrideRequest(
        new_status=ServiceCaseStatus.CANCELLED, reason="müşteri talebi"
    )
    assert req.new_status == ServiceCaseStatus.CANCELLED


def test_case_override_rejects_extra() -> None:
    with pytest.raises(ValidationError):
        CaseOverrideRequest(
            new_status=ServiceCaseStatus.CANCELLED,
            reason="r",
            admin_key="leak",  # type: ignore[call-arg]
        )


def test_user_suspend_request_min_length() -> None:
    with pytest.raises(ValidationError):
        UserSuspendRequest(reason="")


# ─── Response models ─────────────────────────────────────────────────────


def test_technician_pending_item_construct() -> None:
    item = TechnicianPendingItem(
        id=uuid4(),
        full_name="Ahmet Yılmaz",
        email="a@b.com",
        phone="+905551234567",
        approval_status=UserApprovalStatus.PENDING,
        created_at=datetime(2026, 4, 22, 12, 0, tzinfo=UTC),
    )
    assert item.full_name == "Ahmet Yılmaz"
    # Admin view'de PII visible (mask yok) — brief onayı
    assert item.email is not None
    assert item.phone is not None


def test_admin_audit_item_shape() -> None:
    item = AdminAuditItem(
        id=uuid4(),
        admin_user_id=uuid4(),
        event_type=AuthEventType.ADMIN_TECHNICIAN_APPROVED,
        target=str(uuid4()),
        context={"note": "onay"},
        created_at=datetime(2026, 4, 22, 13, 0, tzinfo=UTC),
    )
    assert item.event_type == AuthEventType.ADMIN_TECHNICIAN_APPROVED


def test_user_admin_view_shape() -> None:
    item = UserAdminView(
        id=uuid4(),
        full_name="Test",
        email=None,
        phone=None,
        status=UserStatus.ACTIVE,
        approval_status=UserApprovalStatus.ACTIVE,
        role="customer",
        created_at=datetime(2026, 4, 22, tzinfo=UTC),
        updated_at=datetime(2026, 4, 22, tzinfo=UTC),
    )
    assert item.status == UserStatus.ACTIVE


# ─── AuthEventType admin values contract ──────────────────────────────────


_EXPECTED_ADMIN_EVENT_TYPES = {
    "ADMIN_TECHNICIAN_APPROVED",
    "ADMIN_TECHNICIAN_REJECTED",
    "ADMIN_TECHNICIAN_SUSPENDED",
    "ADMIN_CERT_APPROVED",
    "ADMIN_CERT_REJECTED",
    "ADMIN_INSURANCE_CLAIM_ACCEPTED",
    "ADMIN_INSURANCE_CLAIM_REJECTED",
    "ADMIN_INSURANCE_CLAIM_PAID",
    "ADMIN_CASE_OVERRIDE",
    "ADMIN_USER_SUSPENDED",
    "ADMIN_USER_UNSUSPENDED",
}


def test_all_admin_event_types_defined() -> None:
    defined = {name for name in AuthEventType.__members__ if name.startswith("ADMIN_")}
    assert defined == _EXPECTED_ADMIN_EVENT_TYPES


def test_admin_event_types_value_snake_case() -> None:
    for name in _EXPECTED_ADMIN_EVENT_TYPES:
        member = AuthEventType[name]
        assert member.value == name.lower()


# ─── ADMIN_EVENT_TYPES frozenset (audit-log filter) ──────────────────────


def test_admin_event_types_frozenset_matches_enum() -> None:
    enum_names = {
        AuthEventType[name] for name in _EXPECTED_ADMIN_EVENT_TYPES
    }
    expected = frozenset(enum_names)
    assert expected == admin_actions.ADMIN_EVENT_TYPES


# ─── Service layer exceptions ────────────────────────────────────────────


def test_admin_action_exceptions() -> None:
    assert issubclass(
        admin_actions.TargetNotFoundError, admin_actions.AdminActionError
    )
    assert issubclass(admin_actions.AdminActionError, ValueError)


# ─── Prometheus counter contract ─────────────────────────────────────────


def test_admin_action_counter_name_and_labels() -> None:
    """Brief §11.5: Prometheus metric `admin_action_total{action}`."""
    # Counter internal name: `admin_action_total._name` strips `_total` suffix
    # Expose via ._name or .describe()
    assert "admin_action" in admin_action_total._name
    # Label inc — verify shape
    admin_action_total.labels(action="test_action").inc(0)


# ─── Migration 0027 revision pointer ─────────────────────────────────────


def test_migration_0027_revision_pointer() -> None:
    import importlib.util
    from pathlib import Path

    path = (
        Path(__file__).parent.parent
        / "alembic"
        / "versions"
        / "20260422_0027_admin_auth_events.py"
    )
    assert path.exists(), f"Migration file not found: {path}"
    spec = importlib.util.spec_from_file_location("migration_0027", path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert mod.revision == "20260422_0027"
    assert mod.down_revision == "20260422_0026"
    # 11 admin action values
    assert len(mod._ADMIN_ACTION_VALUES) == 11


# ─── Router module importable + 11 endpoint ──────────────────────────────


def test_admin_router_module_importable() -> None:
    from app.api.v1.routes import admin as admin_module

    assert hasattr(admin_module, "router")
    assert admin_module.router.prefix == "/admin"
    # 11 endpoint dahil (mutation + list)
    route_count = len(admin_module.router.routes)
    assert route_count == 11, f"expected 11 admin routes, got {route_count}"


def test_insurance_admin_router_4_endpoints() -> None:
    """PR 7 (3) + PR 9 (1 list) = 4."""
    from app.api.v1.routes import insurance_claims as module

    assert module.admin_router.prefix == "/admin/insurance-claims"
    assert len(module.admin_router.routes) == 4


# ─── ADMIN_EVENT_TYPES sayım ─────────────────────────────────────────────


def test_admin_event_types_size() -> None:
    assert len(admin_actions.ADMIN_EVENT_TYPES) == 11
