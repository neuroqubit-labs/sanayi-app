import structlog

log = structlog.get_logger()


class ConsoleSmsProvider:
    """Geliştirme ortamı için sahte SMS sağlayıcısı: mesajı log'a basar."""

    async def send(self, to: str, body: str) -> None:
        log.info("sms_console_send", to=to, body=body)
