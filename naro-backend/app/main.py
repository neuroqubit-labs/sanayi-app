import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import redis.asyncio as redis
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import register_exception_handlers
from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.logging import configure_logging
from app.integrations.storage import build_storage_gateway
from app.middleware.idempotency import IdempotencyMiddleware
from app.middleware.request_id import RequestIdMiddleware
from app.observability.metrics import render_metrics

_startup_logger = logging.getLogger("naro.startup")


def _ensure_dev_s3_buckets(settings: Settings) -> None:
    """P0-B fix (QA tur 1): dev environment LocalStack bucket bootstrap.

    QA smoke'da `awslocal s3 ls` boş → accident + maintenance upload
    intent 422 (missing required attachments). Startup'ta idempotent
    ensure.

    Production/staging'de çağrılmaz — bucket'ı terraform yönetir.
    """
    if settings.environment != "development":
        return
    if not settings.aws_s3_endpoint_url:
        # Gerçek AWS S3'e idempotent bucket create yetkisi yok; sadece
        # LocalStack endpoint set edildiğinde ensure et.
        return
    storage = build_storage_gateway(settings)
    for bucket in (settings.s3_private_bucket, settings.s3_public_bucket):
        if not bucket:
            continue
        try:
            storage.ensure_bucket_exists(bucket=bucket)
            _startup_logger.info("s3 bucket ensured: %s", bucket)
        except Exception:  # bootstrap'ı startup'ı engellemesin
            _startup_logger.exception(
                "s3 bucket bootstrap failed: %s", bucket
            )


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    await asyncio.to_thread(_ensure_dev_s3_buckets, get_settings())
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Naro API",
        version="0.1.0",
        lifespan=lifespan,
        openapi_url=f"{settings.api_v1_prefix}/openapi.json",
        docs_url=f"{settings.api_v1_prefix}/docs",
    )

    if settings.cors_origins_list:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins_list,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    def redis_factory() -> redis.Redis:
        client: redis.Redis = redis.from_url(  # type: ignore[no-untyped-call]
            settings.redis_url, decode_responses=False
        )
        return client

    app.add_middleware(IdempotencyMiddleware, redis_factory=redis_factory)
    app.add_middleware(RequestIdMiddleware)

    register_exception_handlers(app)

    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/metrics", tags=["observability"])
    async def prometheus_metrics() -> Response:
        body, ctype = render_metrics()
        return Response(content=body, media_type=ctype)

    return app


app = create_app()
