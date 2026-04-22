from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import redis.asyncio as redis
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import register_exception_handlers
from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.middleware.idempotency import IdempotencyMiddleware
from app.middleware.request_id import RequestIdMiddleware
from app.observability.metrics import render_metrics


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    configure_logging()
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
