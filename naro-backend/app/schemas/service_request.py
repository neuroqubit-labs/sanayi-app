"""ServiceRequestDraft Pydantic modeli — mobil `ServiceRequestDraftSchema` mirror'ı.

32 alanlı kind-spesifik draft; create endpoint'lerinde `dict[str, object]` yerine
bu tipli model kullanılır. `schema_version` forward-compat için zorunlu.

Mobil kaynak: [packages/domain/src/service-case.ts::ServiceRequestDraftSchema](packages/domain/src/service-case.ts).
"""

from __future__ import annotations

from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.case import ServiceRequestKind, ServiceRequestUrgency

# ─── Kind-spesifik enum'lar (mobil Zod mirror) ─────────────────────────────


class ServicePickupPreference(StrEnum):
    DROPOFF = "dropoff"
    PICKUP = "pickup"
    VALET = "valet"


class AccidentReportMethod(StrEnum):
    E_DEVLET = "e_devlet"
    PAPER = "paper"
    POLICE = "police"


class BreakdownCategory(StrEnum):
    ENGINE = "engine"
    ELECTRIC = "electric"
    MECHANIC = "mechanic"
    CLIMATE = "climate"
    TRANSMISSION = "transmission"
    TIRE = "tire"
    FLUID = "fluid"
    OTHER = "other"


class PricePreference(StrEnum):
    ANY = "any"
    NEARBY = "nearby"
    CHEAP = "cheap"
    FAST = "fast"


class MaintenanceCategory(StrEnum):
    PERIODIC = "periodic"
    TIRE = "tire"
    GLASS_FILM = "glass_film"
    COATING = "coating"
    BATTERY = "battery"
    CLIMATE = "climate"
    BRAKE = "brake"
    DETAIL_WASH = "detail_wash"
    HEADLIGHT_POLISH = "headlight_polish"
    ENGINE_WASH = "engine_wash"
    PACKAGE_SUMMER = "package_summer"
    PACKAGE_WINTER = "package_winter"
    PACKAGE_NEW_CAR = "package_new_car"
    PACKAGE_SALE_PREP = "package_sale_prep"


class CaseAttachmentKind(StrEnum):
    PHOTO = "photo"
    VIDEO = "video"
    AUDIO = "audio"
    INVOICE = "invoice"
    REPORT = "report"
    DOCUMENT = "document"
    LOCATION = "location"


# ─── Alt modeller ──────────────────────────────────────────────────────────


class CaseAttachmentDraft(BaseModel):
    """Talep anındaki ekler snapshot'ı (immutable)."""

    model_config = ConfigDict(extra="forbid")

    id: str
    kind: CaseAttachmentKind
    title: str
    subtitle: str | None = None
    status_label: str | None = Field(default=None, alias="statusLabel")
    asset_id: UUID | None = None  # media_assets.id varsa


# ─── Ana Model ─────────────────────────────────────────────────────────────


class ServiceRequestDraftCreate(BaseModel):
    """Vaka açılışındaki tam talep payload'u (32 alan + schema_version).

    Faz 7+ için top-level lift'lenecek alanlar (breakdown_category,
    maintenance_category, kasko_selected, towing_required, on_site_repair)
    şu an JSONB içinde saklanır; create'te top-level kolona da yazılacak.
    """

    model_config = ConfigDict(extra="forbid")

    # Forward-compat versiyonlama
    schema_version: Literal["v1"] = "v1"

    # Temel (service_cases'te top-level mevcut)
    kind: ServiceRequestKind
    vehicle_id: UUID
    urgency: ServiceRequestUrgency

    # Metin + konum
    summary: str = Field(min_length=1)
    location_label: str = Field(min_length=1)
    dropoff_label: str | None = None
    notes: str | None = None

    # Ek + kayıtlar
    attachments: list[CaseAttachmentDraft] = Field(default_factory=list)
    symptoms: list[str] = Field(default_factory=list)
    maintenance_items: list[str] = Field(default_factory=list)

    # Tercihler
    preferred_window: str | None = None
    vehicle_drivable: bool | None = None
    towing_required: bool = False
    pickup_preference: ServicePickupPreference | None = None
    mileage_km: int | None = Field(default=None, ge=0)
    preferred_technician_id: UUID | None = None

    # Kaza-spesifik
    counterparty_note: str | None = None
    counterparty_vehicle_count: int | None = Field(default=None, ge=0)
    damage_area: str | None = None
    valet_requested: bool = False
    report_method: AccidentReportMethod | None = None
    kasko_selected: bool = False
    kasko_brand: str | None = None
    sigorta_selected: bool = False
    sigorta_brand: str | None = None
    ambulance_contacted: bool = False
    emergency_acknowledged: bool = False

    # Arıza-spesifik
    breakdown_category: BreakdownCategory | None = None
    on_site_repair: bool = False
    price_preference: PricePreference | None = None

    # Bakım-spesifik
    maintenance_category: MaintenanceCategory | None = None
    maintenance_tier: str | None = None
