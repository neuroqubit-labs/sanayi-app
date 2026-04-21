"""PSP factory — env'e göre Mock veya Iyzico provider döner."""

from __future__ import annotations

from app.core.config import get_settings
from app.integrations.psp.iyzico import IyzicoPsp
from app.integrations.psp.mock import build_mock_psp
from app.integrations.psp.protocol import Psp, PspResult

__all__ = ["Psp", "PspResult", "get_psp"]


def get_psp() -> Psp:
    settings = get_settings()
    if settings.psp_provider == "iyzico":
        return IyzicoPsp(
            base_url=settings.iyzico_base_url,
            api_key=settings.iyzico_api_key,
            secret_key=settings.iyzico_secret_key,
        )
    return build_mock_psp()
