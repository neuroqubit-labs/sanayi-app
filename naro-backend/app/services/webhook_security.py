"""Webhook HMAC signature verify (Faz B-1 primitive + Faz B-2 kullanım).

I-BILL-5 invariant: webhook HMAC fail → 401. Hem Iyzico webhook'u hem
V2'de diğer PSP'ler aynı helper'ı kullanır.

HMAC-SHA256, constant-time compare (hmac.compare_digest).
"""

from __future__ import annotations

import hashlib
import hmac


def compute_hmac_signature(*, body: bytes, secret: str) -> str:
    """HMAC-SHA256 hex digest üret."""
    return hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()


def verify_webhook_signature(
    *, body: bytes, signature: str, secret: str
) -> bool:
    """Constant-time compare. True = valid; False = reject (401 route'ta).

    signature: hex string (header'dan gelen).
    body: raw request body bytes.
    secret: provider HMAC secret (.env).
    """
    expected = compute_hmac_signature(body=body, secret=secret)
    return hmac.compare_digest(expected, signature)
