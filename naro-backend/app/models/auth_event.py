"""AuthEvent — append-only auth audit log.

Faz 9a. 21 event type; 90 gün retention (KVKK, Faz 15 cron).
`target` PII maskelenmiş (örn. `+90***1234`, `u***@domain.com`).
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPkMixin
from app.db.enums import pg_enum


class AuthEventType(StrEnum):
    OTP_REQUESTED = "otp_requested"
    OTP_VERIFIED = "otp_verified"
    OTP_FAILED = "otp_failed"
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    REFRESH_ROTATED = "refresh_rotated"
    REFRESH_REUSED_ATTACK = "refresh_reused_attack"
    LOGOUT = "logout"
    LOGOUT_ALL = "logout_all"
    OAUTH_AUTHORIZE = "oauth_authorize"
    OAUTH_CALLBACK_SUCCESS = "oauth_callback_success"
    OAUTH_CALLBACK_FAILED = "oauth_callback_failed"
    IDENTITY_LINKED = "identity_linked"
    IDENTITY_UNLINKED = "identity_unlinked"
    SESSION_REVOKED = "session_revoked"
    SESSION_REVOKED_ALL = "session_revoked_all"
    LOCKOUT_TRIGGERED = "lockout_triggered"
    LOCKOUT_CLEARED = "lockout_cleared"
    RATE_LIMIT_BREACH = "rate_limit_breach"
    SUSPICIOUS_LOGIN = "suspicious_login"
    ACCOUNT_SOFT_DELETED = "account_soft_deleted"
    # Faz 10 — tow dispatch
    FRAUD_SUSPECTED = "fraud_suspected"
    PAYMENT_METHOD_ADDED = "payment_method_added"
    # Faz 13 PR 4 — technician mutations
    TECHNICIAN_PROFILE_UPDATED = "technician_profile_updated"
    TECHNICIAN_COVERAGE_REPLACED = "technician_coverage_replaced"
    TECHNICIAN_PROVIDER_MODE_SWITCHED = "technician_provider_mode_switched"
    TECHNICIAN_ACTIVE_ROLE_SWITCHED = "technician_active_role_switched"
    TECHNICIAN_CERT_SUBMITTED = "technician_cert_submitted"
    TECHNICIAN_ADMISSION_RECOMPUTED = "technician_admission_recomputed"
    # Faz A PR 6 — vehicle history consent (audit P1-1)
    VEHICLE_CONSENT_GRANTED = "vehicle_consent_granted"
    VEHICLE_CONSENT_REVOKED = "vehicle_consent_revoked"


class AuthEvent(UUIDPkMixin, Base):
    __tablename__ = "auth_events"
    __table_args__ = (
        CheckConstraint(
            "actor IN ('user','system','admin')",
            name="ck_auth_events_actor",
        ),
    )

    user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    session_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("auth_sessions.id", ondelete="SET NULL"), nullable=True
    )
    event_type: Mapped[AuthEventType] = mapped_column(
        "event_type",
        pg_enum(AuthEventType, name="auth_event_type"),
        nullable=False,
    )
    actor: Mapped[str] = mapped_column(
        String(32), nullable=False, default="user", server_default="user"
    )
    ip_address: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(String(512))
    target: Mapped[str | None] = mapped_column(String(255))
    context: Mapped[dict[str, object]] = mapped_column(
        JSONB, nullable=False, server_default="{}"
    )
    body: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
