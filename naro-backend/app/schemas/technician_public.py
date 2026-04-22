"""Public technician response — PII strict mask (invariant I-9).

TechnicianPublicView + TechnicianFeedItem response modelleri
phone/email/legal_name/tax_number/iban ALANLARINI İÇERMEZ. business_info JSONB
response'a sızmaz — V1'de tamamen çıkarıldı; V2'de whitelisted `{about,
website_url}` eklenebilir.

Feed item daha sıkı alan seti: performans snapshot + tier + display bilgisi.
Tek profile view detay biyografisi de dahil.
"""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.technician import (
    ProviderMode,
    ProviderType,
    TechnicianVerifiedLevel,
)


class LocationSummary(BaseModel):
    """Public konum özeti — lat/lng YOK, city + primary_district label."""

    model_config = ConfigDict(extra="forbid")

    city_code: str | None = None
    city_label: str | None = None
    primary_district_label: str | None = None
    service_radius_km: int | None = None


class TechnicianPublicView(BaseModel):
    """GET /technicians/public/{id} detay response.

    PII mask: phone/email/legal_name/tax_number/iban/address YOK.
    `accepting_new_jobs` bool — raw `availability` enum gösterilmez.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    display_name: str
    tagline: str | None
    biography: str | None
    avatar_asset_id: UUID | None
    verified_level: TechnicianVerifiedLevel
    provider_type: ProviderType
    secondary_provider_types: list[ProviderType]
    active_provider_type: ProviderType | None
    provider_mode: ProviderMode
    accepting_new_jobs: bool
    rating_bayesian: Decimal | None = None
    rating_count: int = 0
    completed_jobs_30d: int = 0
    response_time_p50_minutes: int | None = None
    location_summary: LocationSummary = LocationSummary()


class TechnicianFeedItem(BaseModel):
    """GET /technicians/public/feed — kart listesi item'ı (light variant)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    display_name: str
    tagline: str | None
    avatar_asset_id: UUID | None
    verified_level: TechnicianVerifiedLevel
    provider_type: ProviderType
    secondary_provider_types: list[ProviderType]
    active_provider_type: ProviderType | None
    accepting_new_jobs: bool
    rating_bayesian: Decimal | None = None
    rating_count: int = 0
    completed_jobs_30d: int = 0
    location_summary: LocationSummary = LocationSummary()
