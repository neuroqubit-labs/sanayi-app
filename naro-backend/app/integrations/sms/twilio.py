import structlog
from twilio.rest import Client

from app.core.config import get_settings

log = structlog.get_logger()


class TwilioSmsProvider:
    def __init__(self) -> None:
        settings = get_settings()
        if not (settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from_number):
            raise RuntimeError("Twilio credentials eksik — .env dosyasını kontrol et")
        self._from = settings.twilio_from_number
        self._client = Client(settings.twilio_account_sid, settings.twilio_auth_token)

    async def send(self, to: str, body: str) -> None:
        # twilio-python senkron çalışır; küçük yükler için doğrudan çağırmak kabul edilebilir.
        # Yük artarsa asyncio.to_thread veya httpx ile Twilio REST API'sine geçilir.
        self._client.messages.create(to=to, from_=self._from, body=body)
        log.info("sms_twilio_send", to=to)
