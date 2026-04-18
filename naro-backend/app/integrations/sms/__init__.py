from app.core.config import get_settings
from app.integrations.sms.base import SmsProvider
from app.integrations.sms.console import ConsoleSmsProvider
from app.integrations.sms.twilio import TwilioSmsProvider


def get_sms_provider() -> SmsProvider:
    settings = get_settings()
    if settings.sms_provider == "twilio":
        return TwilioSmsProvider()
    return ConsoleSmsProvider()


__all__ = ["SmsProvider", "get_sms_provider"]
