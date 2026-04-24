"""ServiceRequestDraft Pydantic modeli — mobil `ServiceRequestDraftSchema` mirror'ı.

32 alanlı kind-spesifik draft; create endpoint'lerinde `dict[str, object]` yerine
bu tipli model kullanılır. `schema_version` forward-compat için zorunlu.

Mobil kaynak: [packages/domain/src/service-case.ts::ServiceRequestDraftSchema](packages/domain/src/service-case.ts).
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.case import (
    ServiceRequestKind,
    ServiceRequestUrgency,
    TowEquipment,
    TowIncidentReason,
    TowMode,
)

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


class DamageSeverity(StrEnum):
    """Kaza hasar derecesi — §4.2. Matching motoru skorunda kullanılır."""

    MINOR = "minor"
    MODERATE = "moderate"
    MAJOR = "major"
    TOTAL_LOSS = "total_loss"


# ─── Alt modeller ──────────────────────────────────────────────────────────


class LatLng(BaseModel):
    """Konum (WGS84)."""

    model_config = ConfigDict(extra="forbid")

    lat: Annotated[float, Field(ge=-90, le=90)]
    lng: Annotated[float, Field(ge=-180, le=180)]


class CaseAttachmentDraft(BaseModel):
    """Talep anındaki ekler snapshot'ı (immutable)."""

    model_config = ConfigDict(extra="forbid")

    id: str
    kind: CaseAttachmentKind
    title: str
    subtitle: str | None = None
    status_label: str | None = Field(default=None, alias="statusLabel")
    asset_id: UUID | None = None  # media_assets.id varsa
    # Semantik etiket: scene_overview, damage_detail, counterparty_plate,
    # mileage_photo, tire_photo, glass_current_view, ... (§5.2)
    category: str | None = Field(default=None, max_length=64)


# ─── Ana Model ─────────────────────────────────────────────────────────────


class ServiceRequestDraftCreate(BaseModel):
    """Vaka açılışındaki tam talep payload'u (32 alan + schema_version + §3 ek).

    Kind-bazlı zorunluluk/yasak `@model_validator` ile enforce edilir.
    Service layer ayrıca attachment ownership + required matrix + duplicate
    guard katmanlarını uygular.
    """

    model_config = ConfigDict(extra="forbid")

    # Forward-compat versiyonlama
    schema_version: Literal["v1"] = "v1"

    # Temel (service_cases'te top-level mevcut)
    kind: ServiceRequestKind
    vehicle_id: UUID
    urgency: ServiceRequestUrgency

    # Metin + konum
    summary: str = Field(min_length=1, max_length=500)
    location_label: str = Field(min_length=1, max_length=255)
    location_lat_lng: LatLng | None = None  # permission denied fallback → null
    dropoff_label: str | None = Field(default=None, max_length=255)
    dropoff_lat_lng: LatLng | None = None
    notes: str | None = Field(default=None, max_length=2000)

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
    damage_severity: DamageSeverity | None = None
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
    maintenance_detail: dict[str, Any] | None = None
    maintenance_tier: str | None = None

    # Çekici-spesifik canonical /cases giriş alanları
    tow_mode: TowMode | None = None
    tow_required_equipment: list[TowEquipment] = Field(default_factory=list)
    tow_incident_reason: TowIncidentReason | None = None
    tow_scheduled_at: datetime | None = None
    tow_parent_case_id: UUID | None = None
    tow_fare_quote: dict[str, Any] | None = None

    @model_validator(mode="after")
    def _validate_kind_consistency(self) -> ServiceRequestDraftCreate:
        """§3 + §6.2 — kind-bazlı zorunlu/yasak + conditional alanlar."""
        rules = _KIND_FIELD_RULES.get(self.kind, {})
        errors: list[str] = []
        for field_name, rule in rules.items():
            value = getattr(self, field_name, None)
            # Required: None → missing. False/0/'' explicit değerdir; kabul.
            # Forbidden: default-dışı değer → hata. bool default False; True → hata.
            #            list default []; non-empty → hata. str default None; non-None → hata.
            if rule == "required":
                if value is None:
                    errors.append(
                        f"kind={self.kind.value} için '{field_name}' zorunlu"
                    )
            elif rule == "forbidden":
                default = _FIELD_DEFAULTS.get(field_name)
                is_explicit = value != default and value is not None
                if is_explicit:
                    errors.append(
                        f"kind={self.kind.value} için '{field_name}' gönderilemez"
                    )
        # Conditional: counterparty_note ↔ counterparty_vehicle_count
        if (
            self.kind == ServiceRequestKind.ACCIDENT
            and (self.counterparty_vehicle_count or 0) >= 1
            and not self.counterparty_note
        ):
            errors.append(
                "kind=accident + counterparty_vehicle_count>=1 iken 'counterparty_note' zorunlu"
            )
        # kasko_brand required when kasko_selected
        if self.kasko_selected and not self.kasko_brand:
            errors.append("kasko_selected=true iken 'kasko_brand' zorunlu")
        if self.sigorta_selected and not self.sigorta_brand:
            errors.append("sigorta_selected=true iken 'sigorta_brand' zorunlu")
        # breakdown requires symptoms
        if self.kind == ServiceRequestKind.BREAKDOWN and not self.symptoms:
            errors.append("kind=breakdown için en az 1 'symptoms' girişi zorunlu")
        # Kaza: emergency_acknowledged True olmalı (sadece present değil)
        if (
            self.kind == ServiceRequestKind.ACCIDENT
            and self.emergency_acknowledged is not True
        ):
            errors.append(
                "kind=accident için 'emergency_acknowledged' True olmalı"
            )
        if (
            self.kind == ServiceRequestKind.TOWING
            and self.tow_mode == TowMode.SCHEDULED
            and self.tow_scheduled_at is None
        ):
            errors.append(
                "kind=towing + tow_mode=scheduled için 'tow_scheduled_at' zorunlu"
            )
        if (
            self.kind == ServiceRequestKind.TOWING
            and self.tow_mode == TowMode.IMMEDIATE
        ):
            if self.location_lat_lng is None:
                errors.append(
                    "kind=towing + tow_mode=immediate için 'location_lat_lng' zorunlu"
                )
            if self.tow_fare_quote is None:
                errors.append(
                    "kind=towing + tow_mode=immediate için 'tow_fare_quote' zorunlu"
                )
        if errors:
            raise ValueError(" | ".join(errors))
        return self


# Default değerler — forbidden enforce için "kullanıcı explicit set etti mi"
# check'inde kullanılır. bool default=False; list default=[]; str default=None.
_FIELD_DEFAULTS: dict[str, object] = {
    "towing_required": False,
    "valet_requested": False,
    "kasko_selected": False,
    "sigorta_selected": False,
    "ambulance_contacted": False,
    "emergency_acknowledged": False,
    "on_site_repair": False,
    "tow_required_equipment": [],
}


# §3 — Kind-bazlı alan kuralları
# required: değer dolu olmalı (None/False/[]/"" → hata)
# forbidden: değer boş olmalı (yazılırsa hata)
_KIND_FIELD_RULES: dict[ServiceRequestKind, dict[str, Literal["required", "forbidden"]]] = {
    ServiceRequestKind.ACCIDENT: {
        "counterparty_vehicle_count": "required",
        "damage_area": "required",
        "damage_severity": "required",
        "report_method": "required",
        "emergency_acknowledged": "required",
        # Kazada anlamsız alanlar
        "on_site_repair": "forbidden",
        "valet_requested": "forbidden",
        "pickup_preference": "forbidden",
        "breakdown_category": "forbidden",
        "maintenance_category": "forbidden",
        "maintenance_detail": "forbidden",
        "maintenance_tier": "forbidden",
        "tow_mode": "forbidden",
        "tow_required_equipment": "forbidden",
        "tow_incident_reason": "forbidden",
        "tow_scheduled_at": "forbidden",
        "tow_parent_case_id": "forbidden",
        "tow_fare_quote": "forbidden",
    },
    ServiceRequestKind.BREAKDOWN: {
        "breakdown_category": "required",
        # Arıza'da anlamsız
        "kasko_selected": "forbidden",
        "kasko_brand": "forbidden",
        "sigorta_selected": "forbidden",
        "sigorta_brand": "forbidden",
        "report_method": "forbidden",
        "damage_area": "forbidden",
        "damage_severity": "forbidden",
        "ambulance_contacted": "forbidden",
        "emergency_acknowledged": "forbidden",
        "counterparty_note": "forbidden",
        "counterparty_vehicle_count": "forbidden",
        "maintenance_category": "forbidden",
        "maintenance_detail": "forbidden",
        "maintenance_tier": "forbidden",
        "tow_mode": "forbidden",
        "tow_required_equipment": "forbidden",
        "tow_incident_reason": "forbidden",
        "tow_scheduled_at": "forbidden",
        "tow_parent_case_id": "forbidden",
        "tow_fare_quote": "forbidden",
    },
    ServiceRequestKind.MAINTENANCE: {
        "maintenance_category": "required",
        # Bakımda anlamsız
        "kasko_selected": "forbidden",
        "kasko_brand": "forbidden",
        "sigorta_selected": "forbidden",
        "sigorta_brand": "forbidden",
        "report_method": "forbidden",
        "damage_area": "forbidden",
        "damage_severity": "forbidden",
        "counterparty_note": "forbidden",
        "counterparty_vehicle_count": "forbidden",
        "ambulance_contacted": "forbidden",
        "emergency_acknowledged": "forbidden",
        "breakdown_category": "forbidden",
        "tow_mode": "forbidden",
        "tow_required_equipment": "forbidden",
        "tow_incident_reason": "forbidden",
        "tow_scheduled_at": "forbidden",
        "tow_parent_case_id": "forbidden",
        "tow_fare_quote": "forbidden",
    },
    ServiceRequestKind.TOWING: {
        "tow_mode": "required",
        "tow_incident_reason": "required",
        "dropoff_label": "required",
        "vehicle_drivable": "required",
        # Towing'de anlamsız
        "on_site_repair": "forbidden",
        "valet_requested": "forbidden",
        "pickup_preference": "forbidden",
        "counterparty_note": "forbidden",
        "counterparty_vehicle_count": "forbidden",
        "damage_area": "forbidden",
        "damage_severity": "forbidden",
        "breakdown_category": "forbidden",
        "maintenance_category": "forbidden",
        "maintenance_detail": "forbidden",
        "maintenance_tier": "forbidden",
    },
}
