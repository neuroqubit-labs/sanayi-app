"""Pydantic DTOs for vehicle domain."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.vehicle import UserVehicleRole, VehicleFuelType


class VehicleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plate: str = Field(min_length=1, max_length=32)
    owner_user_id: UUID
    make: str | None = Field(default=None, max_length=64)
    model: str | None = Field(default=None, max_length=128)
    year: int | None = Field(default=None, ge=1900, le=2100)
    color: str | None = Field(default=None, max_length=64)
    fuel_type: VehicleFuelType | None = None
    vin: str | None = Field(default=None, max_length=32)
    current_km: int | None = Field(default=None, ge=0)
    note: str | None = Field(default=None, max_length=500)
    is_primary: bool = True


class VehicleUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plate: str | None = Field(default=None, min_length=1, max_length=32)
    make: str | None = Field(default=None, max_length=64)
    model: str | None = Field(default=None, max_length=128)
    year: int | None = Field(default=None, ge=1900, le=2100)
    color: str | None = Field(default=None, max_length=64)
    fuel_type: VehicleFuelType | None = None
    vin: str | None = Field(default=None, max_length=32)
    current_km: int | None = Field(default=None, ge=0)
    note: str | None = Field(default=None, max_length=500)


class VehicleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    plate: str
    plate_normalized: str
    make: str | None
    model: str | None
    year: int | None
    color: str | None
    fuel_type: VehicleFuelType | None
    vin: str | None
    current_km: int | None
    note: str | None
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
