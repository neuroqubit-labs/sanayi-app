"""Webhook HMAC signature verify (Faz B-1 primitive + Faz B-2 kullanım).

I-BILL-5 invariant: webhook HMAC fail → 401. Hem Iyzico webhook'u hem
V2'de diğer PSP'ler aynı helper'ı kullanır.

HMAC-SHA256, constant-time compare (hmac.compare_digest).
"""

from __future__ import annotations

import hashlib
import hmac
from collections.abc import Mapping


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


def compute_iyzico_v3_signature(
    *, payload: Mapping[str, object], secret_key: str
) -> str:
    """Iyzico official response signature.

    The public docs describe endpoint-specific parameter order and ":" joined
    HMAC-SHA256 with the merchant secret key. This helper supports the response
    shapes we receive through hosted checkout and older 3DS callbacks.
    """

    params = _iyzico_signature_params(payload)
    data = ":".join(_normalize_iyzico_value(value) for value in params)
    return hmac.new(
        secret_key.encode("utf-8"),
        data.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_iyzico_v3_signature(
    *, payload: Mapping[str, object], signature: str, secret_key: str
) -> bool:
    expected = compute_iyzico_v3_signature(payload=payload, secret_key=secret_key)
    return hmac.compare_digest(expected, signature)


def _payload_value(payload: Mapping[str, object], *keys: str) -> str:
    for key in keys:
        value = payload.get(key)
        if value is not None:
            return str(value)
    return ""


def _iyzico_signature_params(payload: Mapping[str, object]) -> list[object]:
    if payload.get("paymentStatus") is not None and payload.get("token") is not None:
        return [
            _payload_value(payload, "paymentStatus"),
            _payload_value(payload, "paymentId", "payment_id"),
            _payload_value(payload, "currency"),
            _payload_value(payload, "basketId"),
            _payload_value(payload, "conversationId", "paymentConversationId"),
            _payload_value(payload, "paidPrice"),
            _payload_value(payload, "price"),
            _payload_value(payload, "token"),
        ]
    if payload.get("conversationData") is not None or payload.get("mdStatus") is not None:
        return [
            _payload_value(payload, "conversationData"),
            _payload_value(payload, "conversationId", "paymentConversationId"),
            _payload_value(payload, "mdStatus"),
            _payload_value(payload, "paymentId", "payment_id"),
            _payload_value(payload, "status"),
        ]
    if payload.get("token") is not None:
        return [
            _payload_value(payload, "conversationId", "paymentConversationId"),
            _payload_value(payload, "token"),
        ]
    return [
        _payload_value(payload, "paymentId", "payment_id"),
        _payload_value(payload, "currency"),
        _payload_value(payload, "basketId"),
        _payload_value(payload, "conversationId", "paymentConversationId"),
        _payload_value(payload, "paidPrice"),
        _payload_value(payload, "price"),
    ]


def _normalize_iyzico_value(value: object) -> str:
    text = str(value)
    if "." not in text:
        return text
    stripped = text.rstrip("0").rstrip(".")
    return stripped or "0"
