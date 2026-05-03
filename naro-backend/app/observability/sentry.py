"""Sentry SDK init — DSN boşsa noop.

Çağrı yeri: app/main.py module load. SENTRY_DSN env yoksa init atlanır;
production'da DSN'siz çalışmak crash visibility kaybı demektir, fallback log
warning ile uyarılır ama açılış engellenmez (DSN rotate veya kısa kesinti
canlıyı düşürmemeli).

PII send_default_pii=False — kullanıcı telefonu/IBAN'ı hata payload'ına
sızmamalı. before_send hook'u Authorization header'ı + body'deki yaygın PII
alanlarını scrub eder.
"""

from __future__ import annotations

import logging
from typing import Any

import sentry_sdk
from sentry_sdk.integrations.asyncio import AsyncioIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from app.core.config import Settings

_logger = logging.getLogger("naro.observability.sentry")

_PII_KEYS = {
    "password",
    "token",
    "access_token",
    "refresh_token",
    "otp",
    "otp_code",
    "iyzico_api_key",
    "iyzico_secret_key",
    "iyzico_webhook_secret",
    "jwt_secret",
    "phone",
    "phone_number",
    "iban",
    "tckn",
    "tax_id",
}


def _scrub(event: dict[str, Any], _hint: dict[str, Any]) -> dict[str, Any]:
    """Best-effort PII scrub for outgoing events."""

    request = event.get("request")
    if isinstance(request, dict):
        headers = request.get("headers")
        if isinstance(headers, dict):
            for header in list(headers):
                if header.lower() in {"authorization", "cookie", "x-api-key"}:
                    headers[header] = "[scrubbed]"
        data = request.get("data")
        if isinstance(data, dict):
            for key in list(data):
                if key.lower() in _PII_KEYS:
                    data[key] = "[scrubbed]"
    return event


def init_sentry(settings: Settings) -> None:
    if not settings.sentry_dsn:
        if settings.environment in ("staging", "production"):
            _logger.warning(
                "SENTRY_DSN missing in %s — crash reports disabled",
                settings.environment,
            )
        return

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        release=settings.sentry_release or None,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        profiles_sample_rate=settings.sentry_profiles_sample_rate,
        send_default_pii=False,
        attach_stacktrace=True,
        before_send=_scrub,
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            StarletteIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
            AsyncioIntegration(),
        ],
    )
    _logger.info("sentry initialized for %s", settings.environment)
