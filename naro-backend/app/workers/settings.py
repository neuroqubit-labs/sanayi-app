from arq.connections import RedisSettings

from app.core.config import get_settings


def redis_settings() -> RedisSettings:
    settings = get_settings()
    return RedisSettings(host=settings.redis_host, port=settings.redis_port)


async def startup(ctx: dict[str, object]) -> None: ...


async def shutdown(ctx: dict[str, object]) -> None: ...


class WorkerSettings:
    """ARQ worker config. Çalıştırmak için: `arq app.workers.settings.WorkerSettings`."""

    functions: list[object] = []  # görev fonksiyonları buraya eklenecek
    on_startup = startup
    on_shutdown = shutdown

    @staticmethod
    def _redis_settings() -> RedisSettings:
        return redis_settings()

    redis_settings = _redis_settings()
