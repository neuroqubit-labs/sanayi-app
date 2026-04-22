"""E-arşiv fatura servisi (Faz B-3, V1 stub).

Brief §9.1: pilot launch < 5M TL → e-arşiv (daha basit). V1'de provider
entegrasyonu yok — mock PDF URL döner, ops manuel fatura keser. Faz C
pilot-sonrası ParamPos/Logo entegrasyonu.

Capture başarılı olduğunda ARQ worker issue_invoice() çağırır — async
request path'i bloke etmez.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case_audit import CaseEventType, CaseTone
from app.services.case_events import append_event

logger = logging.getLogger(__name__)


async def issue_invoice(
    session: AsyncSession,
    *,
    case_id: UUID,
    capture_ref: str,
    amount: Decimal,
    customer_info: dict[str, object] | None = None,
) -> str:
    """V1 stub — mock e-arşiv PDF URL döner, CaseEvent emit eder.

    Args:
        session: DB session.
        case_id: ServiceCase.id.
        capture_ref: Iyzico capture transaction ref (audit trail için).
        amount: Toplam capture tutarı (Decimal, zaten quantized).
        customer_info: Optional — customer name/vkn (V2 provider için).

    Returns:
        str: Mock PDF URL. Faz C'de gerçek e-arşiv provider URL'i.
    """
    # Faz C: ParamPos/Logo API entegrasyonu
    pdf_url = f"https://mock-e-archive.naro.app/invoices/{case_id}.pdf"
    logger.info(
        "e-archive stub: case=%s capture=%s amount=%s url=%s",
        case_id,
        capture_ref,
        amount,
        pdf_url,
    )
    await append_event(
        session,
        case_id=case_id,
        event_type=CaseEventType.INVOICE_ISSUED,
        title="E-fatura oluşturuldu (V1 mock)",
        body=f"Tutar: {amount} TRY. PDF: {pdf_url}",
        tone=CaseTone.SUCCESS,
        context={
            "capture_ref": capture_ref,
            "amount": str(amount),
            "pdf_url": pdf_url,
            "provider": "v1_mock",
        },
    )
    return pdf_url
