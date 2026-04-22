"""Pydantic responses for /taxonomy/* endpoints."""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.taxonomy import BrandTier


class ServiceDomainOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    domain_key: str
    label: str
    description: str | None = None
    icon: str | None = None
    display_order: int


class ProcedureOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    procedure_key: str
    domain_key: str
    label: str
    description: str | None = None
    typical_labor_hours_min: Decimal | None = None
    typical_labor_hours_max: Decimal | None = None
    typical_parts_cost_min: Decimal | None = None
    typical_parts_cost_max: Decimal | None = None
    is_popular: bool
    display_order: int


class BrandOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    brand_key: str
    label: str
    tier: BrandTier
    country_code: str | None = None
    display_order: int


class CityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    city_code: str
    label: str
    region: str | None = None


class DistrictOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    district_id: UUID
    city_code: str
    label: str
    center_lat: Decimal | None = None
    center_lng: Decimal | None = None


class DrivetrainOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    drivetrain_key: str
    label: str
    fuel_type: str
    transmission: str | None = None
    display_order: int
