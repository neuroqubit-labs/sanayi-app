from typing import Protocol


class SmsProvider(Protocol):
    """SMS gönderici soyutlaması. Somut implementasyon .env SMS_PROVIDER ile seçilir."""

    async def send(self, to: str, body: str) -> None: ...
