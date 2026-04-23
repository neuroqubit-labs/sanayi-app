from functools import lru_cache
from typing import Literal

from pydantic import PostgresDsn, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    environment: Literal["development", "staging", "production"] = "development"
    log_level: str = "INFO"

    api_v1_prefix: str = "/api/v1"
    cors_origins: str = ""

    postgres_host: str
    postgres_port: int = 5432
    postgres_user: str
    postgres_password: str
    postgres_db: str

    redis_host: str
    redis_port: int = 6379

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 30

    otp_code_length: int = 6
    otp_expire_seconds: int = 300
    otp_max_attempts: int = 5

    sms_provider: Literal["console", "twilio"] = "console"
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""

    aws_region: str = "us-east-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_s3_endpoint_url: str = ""
    s3_private_bucket: str = "development-naro-media-private"
    s3_public_bucket: str = "development-naro-media-public"
    cloudfront_public_base_url: str = ""
    media_upload_url_ttl_seconds: int = 600
    media_download_url_ttl_seconds: int = 900
    media_orphan_retention_hours: int = 24
    clamav_host: str = ""

    # Faz 10 — Tow dispatch
    psp_provider: Literal["mock", "iyzico"] = "mock"
    iyzico_base_url: str = "https://sandbox-api.iyzipay.com"
    iyzico_api_key: str = ""
    iyzico_secret_key: str = ""
    # Faz B-2 — Iyzico 3DS callback + webhook (PO sandbox başvuru 3-7g)
    iyzico_webhook_secret: str = ""
    iyzico_callback_url: str = "https://api-sandbox.naro.app/api/v1/webhooks/iyzico/payment"
    maps_provider: Literal["mapbox", "offline"] = "offline"
    mapbox_backend_token: str = ""
    mapbox_public_token: str = ""
    tow_dispatch_timeout_seconds: int = 180
    tow_accept_window_seconds: int = 30
    tow_location_retention_days: int = 30
    tow_cap_hard_ceiling_multiplier: int = 3
    tow_quote_base_amount: int = 950
    tow_quote_per_km_rate: int = 70
    tow_quote_urgency_surcharge: int = 80
    tow_quote_buffer_pct: float = 0.10
    tow_otp_ttl_minutes: int = 10
    tow_otp_max_attempts: int = 3
    tow_heartbeat_seconds: int = 90

    # QA tur 2 P1-4: offer expires_at default TTL (B-P1-6 cron filter için)
    offer_ttl_minutes: int = 15

    @computed_field  # type: ignore[prop-decorator]
    @property
    def database_url(self) -> str:
        dsn = PostgresDsn.build(
            scheme="postgresql+asyncpg",
            username=self.postgres_user,
            password=self.postgres_password,
            host=self.postgres_host,
            port=self.postgres_port,
            path=self.postgres_db,
        )
        return str(dsn)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/0"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
