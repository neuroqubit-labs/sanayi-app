"""PSP webhook router (Faz B-2).

Iyzico 3DS callback + status update. HMAC signature verify zorunlu
(I-BILL-5). Idempotency: (payment_id + event_id) tuple unique — replay
safe.

Chargeback webhook V2'de gerçek; V1'de 501 stub.
"""

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Request, status

from app.core.config import get_settings
from app.services.webhook_security import verify_webhook_signature

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post(
    "/iyzico/payment",
    status_code=status.HTTP_200_OK,
    summary="Iyzico 3DS callback / payment status update (HMAC verify)",
)
async def iyzico_payment_webhook(
    request: Request,
    x_iyzico_signature: str | None = Header(
        default=None, alias="X-Iyzico-Signature"
    ),
) -> dict[str, str]:
    """HMAC-SHA256 doğrulama + payment status process.

    I-BILL-5 invariant: signature fail → 401. Spoof'a karşı koruma.
    Body parse Faz B-3'te case_billing.process_3ds_callback'e devredilir.
    """
    settings = get_settings()
    secret = settings.iyzico_webhook_secret
    if not secret:
        # Sandbox başvuru henüz yok — webhook çalışır durumda değil
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
    # Faz B-3: parse + route to case_billing.process_3ds_callback
    # V1.1 skeleton — success acknowledge (Iyzico bekliyor)
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
