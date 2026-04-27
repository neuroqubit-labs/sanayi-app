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

from pydantic import BaseModel, ConfigDict, Field

from app.models.case import ServiceRequestKind
from app.models.media import MediaPurpose
from app.models.technician import (
    GalleryItemKind,
    ProviderMode,
    ProviderType,
    TechnicianCertificateKind,
    TechnicianVerifiedLevel,
)


class LocationSummary(BaseModel):
    """Public konum özeti — lat/lng YOK, city + primary_district label."""

    model_config = ConfigDict(extra="forbid")

    city_code: str | None = None
    city_label: str | None = None
    primary_district_label: str | None = None
    service_radius_km: int | None = None


class PublicMediaAsset(BaseModel):
    """Public-safe media descriptor — object key/bucket bilgisi YOK."""

    model_config = ConfigDict(extra="forbid")

    id: UUID
    purpose: MediaPurpose
    mime_type: str
    preview_url: str | None = None
    thumb_url: str | None = None
    download_url: str | None = None


class PublicIdentitySummary(BaseModel):
    """Profilin karar ekranında kullanılan public kimlik özeti."""

    model_config = ConfigDict(extra="forbid")

    display_name: str
    tagline: str | None = None
    provider_type: ProviderType
    secondary_provider_types: list[ProviderType] = Field(default_factory=list)
    active_provider_type: ProviderType | None = None
    provider_mode: ProviderMode
    avatar_asset_id: UUID | None = None
    avatar_media: PublicMediaAsset | None = None
    verified_level: TechnicianVerifiedLevel
    accepting_new_jobs: bool


class LabelledSignal(BaseModel):
    """Taxonomy-backed public signal."""

    model_config = ConfigDict(extra="forbid")

    key: str
    label: str


class BrandCoverageSignal(LabelledSignal):
    is_authorized: bool = False
    is_premium_authorized: bool = False


class FitSummary(BaseModel):
    """Müşteri açısından 'bu servis benim işime uyar mı?' özeti."""

    model_config = ConfigDict(extra="forbid")

    provider_type: ProviderType
    active_provider_type: ProviderType | None = None
    service_domains: list[LabelledSignal] = Field(default_factory=list)
    procedure_tags: list[str] = Field(default_factory=list)
    brand_coverage: list[BrandCoverageSignal] = Field(default_factory=list)


class TrustSummary(BaseModel):
    """Public güven sinyalleri — detay yorum listesi bu response'ta yok."""

    model_config = ConfigDict(extra="forbid")

    rating_bayesian: Decimal | None = None
    rating_count: int = 0
    completed_jobs_30d: int = 0
    response_time_p50_minutes: int | None = None
    verified_level: TechnicianVerifiedLevel
    approved_certificate_count: int = 0
    approved_certificate_kinds: list[TechnicianCertificateKind] = Field(
        default_factory=list
    )


class ProofPreviewItem(BaseModel):
    """Public galeri vitrini. Sadece public URL'ler ve kısa metin."""

    model_config = ConfigDict(extra="forbid")

    id: UUID
    kind: GalleryItemKind
    title: str | None = None
    caption: str | None = None
    media: PublicMediaAsset


class PublicCaseShowcaseMedia(BaseModel):
    """Doğrulanmış vaka vitrini medyası — object key yok."""

    model_config = ConfigDict(extra="forbid")

    id: UUID
    kind: str
    title: str | None = None
    caption: str | None = None
    media: PublicMediaAsset


class PublicCaseShowcasePreview(BaseModel):
    """Public profilde görünen PII-safe tamamlanmış vaka kartı."""

    model_config = ConfigDict(extra="forbid")

    id: UUID
    kind: ServiceRequestKind
    kind_label: str
    title: str
    summary: str
    month_label: str | None = None
    location_label: str | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    review_body: str | None = None
    media: PublicCaseShowcaseMedia | None = None


class PublicCaseShowcaseDetail(PublicCaseShowcasePreview):
    """Tek showcase detay response'u; hala public-safe."""

    delivery_report: list[dict[str, str]] = Field(default_factory=list)
    media_items: list[PublicCaseShowcaseMedia] = Field(default_factory=list)


class OperationsSummary(BaseModel):
    """Adres/koordinat açmadan operasyonel çalışma özeti."""

    model_config = ConfigDict(extra="forbid")

    location_summary: LocationSummary = Field(default_factory=LocationSummary)
    area_label: str | None = None
    working_hours: str | None = None
    mobile_service: bool = False
    valet_service: bool = False
    on_site_repair: bool = False
    towing_coordination: bool = False
    mobile_unit_count: int = 0
    staff_count: int | None = None
    max_concurrent_jobs: int | None = None
    night_service: bool = False
    weekend_service: bool = False
    emergency_service: bool = False


class PublicAbout(BaseModel):
    model_config = ConfigDict(extra="forbid")

    biography: str | None = None
    service_note: str | None = None


class TechnicianPublicView(BaseModel):
    """GET /technicians/public/{id} detay response.

    PII mask: phone/email/legal_name/tax_number/iban/address YOK.
    `accepting_new_jobs` bool — raw `availability` enum gösterilmez.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
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
    location_summary: LocationSummary = Field(default_factory=LocationSummary)
    identity: PublicIdentitySummary | None = None
    fit_summary: FitSummary | None = None
    trust_summary: TrustSummary | None = None
    proof_preview: list[ProofPreviewItem] = Field(default_factory=list)
    case_showcases: list[PublicCaseShowcasePreview] = Field(default_factory=list)
    operations: OperationsSummary | None = None
    about: PublicAbout | None = None


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
    location_summary: LocationSummary = Field(default_factory=LocationSummary)
    proof_preview: list[ProofPreviewItem] = Field(default_factory=list)
    case_showcases: list[PublicCaseShowcasePreview] = Field(default_factory=list)
    context_score: Decimal = Decimal("0.00")
    context_group: str = "primary"
    context_tier: str = "general"
    compatibility_state: str = "weak"
    match_badge: str | None = None
    notify_badge: str | None = None
    match_reason_label: str | None = None
    fit_signals: list[str] = Field(default_factory=list)
    fit_badges: list[str] = Field(default_factory=list)
    is_vehicle_compatible: bool = True
    is_case_compatible: bool = False
    can_notify: bool = False
    notify_state: str = "not_compatible"
    notify_disabled_reason: str | None = None
    is_notified_to_me: bool = False
    has_offer_from_me: bool = False
