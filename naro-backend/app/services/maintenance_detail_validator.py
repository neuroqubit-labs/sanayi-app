"""Bakım kategorisi × maintenance_detail payload çapraz validator (§4.1).

Her maintenance_category için Pydantic sub-model; ServiceRequestDraftCreate'in
`maintenance_detail: dict[str, Any]` alanı service layer'da bu module üzerinden
parse + validate. Invalid → ValueError (caller 422 map).
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.schemas.service_request import MaintenanceCategory


class MaintenanceDetailValidationError(ValueError):
    """Kategori × payload uyumsuz (422)."""


# ─── Kategori detay modelleri ──────────────────────────────────────────────


class _BaseDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PeriodicDetail(_BaseDetail):
    oil_type: str | None = None
    filters: list[str] = Field(default_factory=list)
    target_km: int | None = Field(default=None, ge=0)
    inspections: list[str] = Field(default_factory=list)


class GlassFilmDetail(_BaseDetail):
    scope: Literal["yan", "on_cam", "tam"]
    transmittance: Literal["50", "35", "15", "5"]
    tier: Literal["standard", "premium"] = "standard"


class TireDetail(_BaseDetail):
    season: Literal["summer", "winter", "4seasons"]
    brand_pref: str | None = None
    count: Annotated[int, Field(ge=1, le=4)] = 4
    rot_balans: bool = False


class CoatingDetail(_BaseDetail):
    layers: Annotated[int, Field(ge=1, le=10)] = 1
    prep: bool = True
    warranty_months: int | None = Field(default=None, ge=0)


class BatteryDetail(_BaseDetail):
    crank_ok: bool | None = None
    last_change_date: str | None = None
    brand_pref: str | None = None


class BrakeDetail(_BaseDetail):
    axle: Literal["on", "arka", "both"]
    pad_and_disc: bool = False
    symptom: str | None = None


class ClimateDetail(_BaseDetail):
    symptom: str | None = None
    last_gas_date: str | None = None
    gas_type_known: bool = False


class DetailWashDetail(_BaseDetail):
    interior: bool = False
    engine_bay: bool = False
    polish: bool = False


class PackageDetail(_BaseDetail):
    items: list[str] = Field(default_factory=list)


class EmptyDetail(_BaseDetail):
    """Detay gerektirmeyen kategoriler (headlight_polish, engine_wash)."""


_DETAIL_MAP: dict[MaintenanceCategory, type[_BaseDetail]] = {
    MaintenanceCategory.PERIODIC: PeriodicDetail,
    MaintenanceCategory.GLASS_FILM: GlassFilmDetail,
    MaintenanceCategory.TIRE: TireDetail,
    MaintenanceCategory.COATING: CoatingDetail,
    MaintenanceCategory.BATTERY: BatteryDetail,
    MaintenanceCategory.BRAKE: BrakeDetail,
    MaintenanceCategory.CLIMATE: ClimateDetail,
    MaintenanceCategory.DETAIL_WASH: DetailWashDetail,
    MaintenanceCategory.HEADLIGHT_POLISH: EmptyDetail,
    MaintenanceCategory.ENGINE_WASH: EmptyDetail,
    MaintenanceCategory.PACKAGE_SUMMER: PackageDetail,
    MaintenanceCategory.PACKAGE_WINTER: PackageDetail,
    MaintenanceCategory.PACKAGE_NEW_CAR: PackageDetail,
    MaintenanceCategory.PACKAGE_SALE_PREP: PackageDetail,
}


# Kategori için payload zorunlu mu? (bazıları EmptyDetail — payload boş olabilir)
_REQUIRED_CATEGORIES: frozenset[MaintenanceCategory] = frozenset({
    MaintenanceCategory.GLASS_FILM,
    MaintenanceCategory.TIRE,
    MaintenanceCategory.BRAKE,
})


def validate_maintenance_detail(
    category: MaintenanceCategory | None,
    detail: dict[str, Any] | None,
) -> _BaseDetail | None:
    """Kategori × detail çapraz validate; invalid → raise.

    Kategori None → detail de None olmalı (schema'da zaten MaintenanceRequired'ta).
    Detail None + kategori required → raise.
    Detail dolu → uygun model ile parse.
    """
    if category is None:
        if detail:
            raise MaintenanceDetailValidationError(
                "maintenance_category yok ama maintenance_detail gönderildi"
            )
        return None

    model_cls = _DETAIL_MAP.get(category)
    if model_cls is None:
        raise MaintenanceDetailValidationError(
            f"Bakım kategorisi '{category.value}' için detay şeması tanımlı değil"
        )

    if not detail:
        if category in _REQUIRED_CATEGORIES:
            raise MaintenanceDetailValidationError(
                f"Bakım kategorisi '{category.value}' için 'maintenance_detail' zorunlu"
            )
        return None

    try:
        return model_cls.model_validate(detail)
    except ValidationError as exc:
        # İlk error mesajı kullanıcıya daha anlaşılır
        first = exc.errors()[0] if exc.errors() else {"msg": str(exc), "loc": ()}
        loc = ".".join(str(p) for p in first.get("loc", ()))
        raise MaintenanceDetailValidationError(
            f"Bakım kategorisi '{category.value}' için 'maintenance_detail.{loc}': "
            f"{first.get('msg', 'invalid')}"
        ) from exc
