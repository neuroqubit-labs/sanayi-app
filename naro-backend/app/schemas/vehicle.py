"""Pydantic DTOs for vehicle domain."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.vehicle import (
    UserVehicleRole,
    VehicleDrivetrain,
    VehicleFuelType,
    VehicleKind,
    VehicleTransmission,
)


class VehicleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plate: str = Field(min_length=1, max_length=32)
    # Araç türü — UI Adım 1 zorunlu; matching motoru için kritik
    vehicle_kind: VehicleKind
    make: str | None = Field(default=None, max_length=64)
    model: str | None = Field(default=None, max_length=128)
    # Year — UI zorunlu (product decision 2026-04-24). Backend nullable
    # tutarak eski kayıt migrasyonu kırmıyoruz; create sırasında FE zorla.
    year: int | None = Field(default=None, ge=1900, le=2100)
    color: str | None = Field(default=None, max_length=64)
    fuel_type: VehicleFuelType | None = None
    transmission: VehicleTransmission | None = None
    drivetrain: VehicleDrivetrain | None = None
    engine_displacement: str | None = Field(default=None, max_length=16)
    engine_power_hp: int | None = Field(default=None, ge=0, le=2000)
    chassis_no: str | None = Field(default=None, max_length=32)
    engine_no: str | None = Field(default=None, max_length=32)
    photo_url: str | None = Field(default=None, max_length=500)
    vin: str | None = Field(default=None, max_length=32)
    current_km: int | None = Field(default=None, ge=0)
    note: str | None = Field(default=None, max_length=500)
    is_primary: bool = True
    # Lifecycle alanları — opt-in (reminders için)
    inspection_valid_until: datetime | None = None
    inspection_kind: str | None = Field(default=None, max_length=32)
    kasko_valid_until: datetime | None = None
    kasko_insurer: str | None = Field(default=None, max_length=255)
    trafik_valid_until: datetime | None = None
    trafik_insurer: str | None = Field(default=None, max_length=255)
    exhaust_valid_until: datetime | None = None


class VehicleUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plate: str | None = Field(default=None, min_length=1, max_length=32)
    vehicle_kind: VehicleKind | None = None
    make: str | None = Field(default=None, max_length=64)
    model: str | None = Field(default=None, max_length=128)
    year: int | None = Field(default=None, ge=1900, le=2100)
    color: str | None = Field(default=None, max_length=64)
    fuel_type: VehicleFuelType | None = None
    transmission: VehicleTransmission | None = None
    drivetrain: VehicleDrivetrain | None = None
    engine_displacement: str | None = Field(default=None, max_length=16)
    engine_power_hp: int | None = Field(default=None, ge=0, le=2000)
    chassis_no: str | None = Field(default=None, max_length=32)
    engine_no: str | None = Field(default=None, max_length=32)
    photo_url: str | None = Field(default=None, max_length=500)
    vin: str | None = Field(default=None, max_length=32)
    current_km: int | None = Field(default=None, ge=0)
    note: str | None = Field(default=None, max_length=500)
    inspection_valid_until: datetime | None = None
    inspection_kind: str | None = Field(default=None, max_length=32)
    kasko_valid_until: datetime | None = None
    kasko_insurer: str | None = Field(default=None, max_length=255)
    trafik_valid_until: datetime | None = None
    trafik_insurer: str | None = Field(default=None, max_length=255)
    exhaust_valid_until: datetime | None = None


class VehicleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    plate: str
    plate_normalized: str
    vehicle_kind: VehicleKind | None
    make: str | None
    model: str | None
    year: int | None
    color: str | None
    fuel_type: VehicleFuelType | None
    transmission: VehicleTransmission | None
    drivetrain: VehicleDrivetrain | None
    engine_displacement: str | None
    engine_power_hp: int | None
    chassis_no: str | None
    engine_no: str | None
    photo_url: str | None
    vin: str | None
    current_km: int | None
    note: str | None
    inspection_valid_until: datetime | None
    inspection_kind: str | None
    kasko_valid_until: datetime | None
    kasko_insurer: str | None
    trafik_valid_until: datetime | None
    trafik_insurer: str | None
    exhaust_valid_until: datetime | None
    history_consent_granted: bool
    history_consent_granted_at: datetime | None
    history_consent_revoked_at: datetime | None
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime


class UserVehicleLinkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    vehicle_id: UUID
    is_primary: bool
    role: UserVehicleRole
    ownership_from: datetime
    ownership_to: datetime | None
    created_at: datetime


class OwnershipTransferRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vehicle_id: UUID
    from_user_id: UUID
    to_user_id: UUID


class HistoryConsentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    granted: bool


class VehicleDossierView(BaseModel):
    """Aggregated view — repository join ile doldurulur."""

    model_config = ConfigDict(from_attributes=True)

    vehicle: VehicleResponse
    primary_owner_id: UUID | None
    additional_user_ids: list[UUID] = Field(default_factory=list)
    previous_case_count: int = 0
    last_case_id: UUID | None = None
    last_case_title: str | None = None
    last_case_updated_at: datetime | None = None
