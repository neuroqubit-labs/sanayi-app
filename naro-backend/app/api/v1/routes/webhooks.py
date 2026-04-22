"""PSP webhook router (Faz B-2 + B-3 concrete).

Iyzico 3DS callback + status update. HMAC signature verify zorunlu
(I-BILL-5). Body parse + case_billing.process_3ds_callback dispatch.

Idempotency: process_3ds_callback kendi içinde payment_idempotency
tablosuyla replay-safe.

Chargeback webhook V2'de gerçek; V1'de 501 stub.
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Header, HTTPException, Request, status

from app.api.v1.deps import DbDep
from app.core.config import get_settings
from app.services import case_billing
from app.services.webhook_security import verify_webhook_signature

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _get_psp_for_webhook() -> object:
    """Webhook geldiğinde hangi PSP'yi kullanacağız — _get_psp factory reuse."""
    from app.api.v1.routes.billing import _get_psp

    psp, _ = _get_psp()
    return psp


@router.post(
    "/iyzico/payment",
    status_code=status.HTTP_200_OK,
    summary="Iyzico 3DS callback / payment status update (HMAC verify)",
)
async def iyzico_payment_webhook(
    request: Request,
    db: DbDep,
    x_iyzico_signature: str | None = Header(
        default=None, alias="X-Iyzico-Signature"
    ),
) -> dict[str, str]:
    """HMAC-SHA256 doğrulama + payment status dispatch.

    I-BILL-5: signature fail → 401. Spoof koruması.
    Body:
      {
        "paymentId": "...",
        "paymentConversationId": "<case.id>",
        "status": "success" | "failure"
      }
    """
    settings = get_settings()
    secret = settings.iyzico_webhook_secret
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"type": "iyzico_webhook_not_configured"},
        )
    if x_iyzico_signature is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"type": "webhook_signature_missing"},
        )
    body = await request.body()
    if not verify_webhook_signature(
        body=body, signature=x_iyzico_signature, secret=secret
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"type": "webhook_signature_invalid"},
        )

    # Body parse — Iyzico payload variants
    try:
        payload = json.loads(body.decode("utf-8") or "{}")
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"type": "webhook_body_invalid_json"},
        ) from None
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"type": "webhook_body_must_be_object"},
        )

    payment_id = str(
        payload.get("paymentId")
        or payload.get("payment_id")
        or payload.get("iyziEventIdentifier")
        or ""
    )
    conversation_id = str(
        payload.get("paymentConversationId")
        or payload.get("conversationId")
        or payload.get("conversation_id")
        or ""
    )
    if not payment_id or not conversation_id:
        logger.warning(
            "iyzico webhook missing paymentId/conversationId: %s",
            payload,
        )
        # Iyzico tolerate — ack et, sadece log
        return {"status": "received_incomplete"}

    psp = _get_psp_for_webhook()
    try:
        await case_billing.process_3ds_callback(
            db,
            conversation_id=conversation_id,
            payment_id=payment_id,
            psp=psp,  # type: ignore[arg-type]
        )
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("iyzico webhook process error payload=%s", payload)
        # Iyzico'ya 500 dönme — 2xx döneriz, retry istemeyiz
        return {"status": "error_logged"}
    return {"status": "received"}


@router.post(
    "/iyzico/chargeback",
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
    summary="Chargeback webhook — V2 (I-BILL-14)",
)
async def iyzico_chargeback_webhook() -> dict[str, str]:
    """V2: otomatik dispute + capture reverse + manual review."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={"type": "chargeback_webhook_v2"},
    )
