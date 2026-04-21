"""Tow evidence + OTP service.

OTP: Redis SETEX (primary) + DB audit (tow_otp_events). Plan agent K-P5:
6 haneli numeric, 10 dk TTL, 3 yanlış → invalidate.

Evidence gate: case_evidence_items joined count; target stage requirement
map'ine göre missing check (`tow_lifecycle._check_evidence_gate` reuse).
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.tow import (
    TowOtpDelivery,
    TowOtpPurpose,
    TowOtpRecipient,
    TowOtpVerifyResult,
)
from app.repositories import tow as tow_repo


class OtpExpiredError(Exception):
    pass


class OtpMaxAttemptsError(Exception):
    pass


class OtpInvalidError(Exception):
    pass


class OtpAlreadyVerifiedError(Exception):
    pass


@dataclass(slots=True)
class IssuedOtp:
    otp_id: UUID
    code: str  # Only returned once at issue; never re-expose
    expires_at_iso: str


def _redis_key(case_id: UUID, purpose: TowOtpPurpose) -> str:
    return f"tow:otp:{case_id}:{purpose.value}"


async def issue_otp(
    session: AsyncSession,
    *,
    redis: Redis,
    case_id: UUID,
    purpose: TowOtpPurpose,
    recipient: TowOtpRecipient,
    delivered_via: TowOtpDelivery,
    issued_by_user_id: UUID | None = None,
) -> IssuedOtp:
    """Issue new OTP. Invalidates any pending active OTP for (case, purpose).

    Partial unique index enforces single pending per (case, purpose); expire old
    before new issue.
    """
    settings = get_settings()
    existing = await tow_repo.get_active_otp(session, case_id, purpose)
    if existing:
        await tow_repo.mark_otp_result(
            session, existing.id, TowOtpVerifyResult.EXPIRED, increment_attempts=False
        )
        await redis.delete(_redis_key(case_id, purpose))

    code = tow_repo.generate_otp_code(length=settings.otp_code_length)
    event = await tow_repo.issue_otp(
        session,
        case_id=case_id,
        purpose=purpose,
        recipient=recipient,
        delivered_via=delivered_via,
        code=code,
        ttl_minutes=settings.tow_otp_ttl_minutes,
        issued_by_user_id=issued_by_user_id,
    )
    await redis.set(
        _redis_key(case_id, purpose),
        code,
        ex=settings.tow_otp_ttl_minutes * 60,
    )
    return IssuedOtp(
        otp_id=event.id,
        code=code,
        expires_at_iso=event.expires_at.isoformat(),
    )


async def verify_otp(
    session: AsyncSession,
    *,
    redis: Redis,
    case_id: UUID,
    purpose: TowOtpPurpose,
    submitted_code: str,
) -> bool:
    settings = get_settings()
    active = await tow_repo.get_active_otp(session, case_id, purpose)
    if active is None:
        raise OtpExpiredError("no active OTP for case + purpose")
    if active.attempts >= settings.tow_otp_max_attempts:
        await tow_repo.mark_otp_result(
            session, active.id, TowOtpVerifyResult.FAILED, increment_attempts=False
        )
        await redis.delete(_redis_key(case_id, purpose))
        raise OtpMaxAttemptsError("max attempts exceeded")

    redis_code = await redis.get(_redis_key(case_id, purpose))
    if redis_code is None:
        await tow_repo.mark_otp_result(
            session, active.id, TowOtpVerifyResult.EXPIRED, increment_attempts=False
        )
        raise OtpExpiredError("OTP expired")

    expected = redis_code.decode() if isinstance(redis_code, bytes) else str(redis_code)
    if submitted_code != expected:
        await tow_repo.mark_otp_result(
            session, active.id, TowOtpVerifyResult.PENDING, increment_attempts=True
        )
        raise OtpInvalidError("code mismatch")

    await tow_repo.mark_otp_result(
        session, active.id, TowOtpVerifyResult.SUCCESS, increment_attempts=True
    )
    await redis.delete(_redis_key(case_id, purpose))
    return True


async def check_evidence_gate(
    session: AsyncSession,
    *,
    case_id: UUID,
    requirements: dict[str, int],
) -> dict[str, int]:
    """Return missing counts per kind. Empty dict → gate passes."""
    counts = await tow_repo.evidence_gate_counts(session, case_id)
    missing: dict[str, int] = {}
    for kind, needed in requirements.items():
        have = int(counts.get(kind, 0))
        if have < needed:
            missing[kind] = needed - have
    return missing
