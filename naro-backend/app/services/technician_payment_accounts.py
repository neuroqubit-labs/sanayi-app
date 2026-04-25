"""Technician payment account helpers and active-work gate."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.technician_payment import (
    TechnicianPaymentAccount,
    TechnicianPaymentAccountStatus,
    TechnicianPaymentLegalType,
)


class PaymentAccountRequiredError(PermissionError):
    def __init__(self, user_id: UUID) -> None:
        super().__init__(f"technician payment account required: {user_id}")
        self.user_id = user_id


async def get_payment_account(
    session: AsyncSession, technician_user_id: UUID
) -> TechnicianPaymentAccount | None:
    stmt = select(TechnicianPaymentAccount).where(
        TechnicianPaymentAccount.technician_user_id == technician_user_id
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_or_create_payment_account(
    session: AsyncSession, technician_user_id: UUID
) -> TechnicianPaymentAccount:
    account = await get_payment_account(session, technician_user_id)
    if account is not None:
        return account
    account = TechnicianPaymentAccount(
        technician_user_id=technician_user_id,
        provider=get_settings().psp_provider,
        status=TechnicianPaymentAccountStatus.NOT_STARTED,
        can_receive_online_payments=False,
        address_snapshot={},
        business_snapshot={},
    )
    session.add(account)
    await session.flush()
    return account


async def save_payment_account_draft(
    session: AsyncSession,
    *,
    technician_user_id: UUID,
    legal_type: TechnicianPaymentLegalType | None,
    legal_name: str | None,
    tax_number_ref: str | None,
    iban_ref: str | None,
    authorized_person_name: str | None,
    address_snapshot: dict[str, object],
    business_snapshot: dict[str, object],
) -> TechnicianPaymentAccount:
    account = await get_or_create_payment_account(session, technician_user_id)
    account.provider = get_settings().psp_provider
    account.status = TechnicianPaymentAccountStatus.DRAFT
    account.can_receive_online_payments = False
    account.legal_type = legal_type
    account.legal_name = legal_name
    account.tax_number_ref = tax_number_ref
    account.iban_ref = iban_ref
    account.authorized_person_name = authorized_person_name
    account.address_snapshot = address_snapshot
    account.business_snapshot = business_snapshot
    await session.flush()
    return account


async def submit_payment_account(
    session: AsyncSession, technician_user_id: UUID
) -> TechnicianPaymentAccount:
    account = await get_or_create_payment_account(session, technician_user_id)
    now = datetime.now(UTC)
    account.provider = get_settings().psp_provider
    account.submitted_at = now
    # Mock provider simulates PSP sub-merchant approval so local flows remain usable.
    if account.provider == "mock":
        account.status = TechnicianPaymentAccountStatus.APPROVED
        account.can_receive_online_payments = True
        account.sub_merchant_key = account.sub_merchant_key or f"mock_sub_{technician_user_id.hex[:16]}"
        account.reviewed_at = now
    else:
        account.status = TechnicianPaymentAccountStatus.PENDING_REVIEW
        account.can_receive_online_payments = False
    await session.flush()
    return account


async def require_can_receive_online_payments(
    session: AsyncSession, technician_user_id: UUID
) -> TechnicianPaymentAccount:
    account = await get_payment_account(session, technician_user_id)
    if (
        account is None
        or account.status != TechnicianPaymentAccountStatus.APPROVED
        or not account.can_receive_online_payments
    ):
        raise PaymentAccountRequiredError(technician_user_id)
    return account
