"""Case subtype modelleri (Faz 1a).

Canonical case architecture: service_cases ortak shell + 4 subtype tablo
1:1 extension ile first-class. Her subtype satırında immutable vehicle
snapshot (pilot V1: 7 alan).

Brief: docs/audits/2026-04-23-canonical-case-architecture.md
Migration: 20260423_0031_case_subtype_tables.py

Shell (service_cases) ortak alanları taşır: id, kind, customer_user_id,
vehicle_id, status, title, assigned_technician_id, billing_state,
closed_at, deleted_at, timestamps, workflow_blueprint, request_draft
(immutable audit trail — source-of-truth değil).

Subtype tabloları kind-specific alanları + snapshot taşır.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.enums import pg_enum
from app.models.case import TowDispatchStage, TowEquipment, TowIncidentReason, TowMode


class _VehicleSnapshotMixin:
    """Immutable vehicle snapshot — case create anında populate.

    Pilot V1: 7 alan. V1.1'de matching v2 için body_type, vehicle_segment,
    gross_weight_class, drivetrain_class eklenecek (Vehicle master'a önce).

    Invariant: case create sonrası snapshot_* alanları DEĞİŞMEZ. Vehicle
    master update → mevcut case snapshot'ları etkilenmez.
    """

    snapshot_plate: Mapped[str] = mapped_column(String(32), nullable=False)
    snapshot_make: Mapped[str | None] = mapped_column(String(64))
    snapshot_model: Mapped[str | None] = mapped_column(String(128))
    snapshot_year: Mapped[int | None] = mapped_column(SmallInteger)
    snapshot_fuel_type: Mapped[str | None] = mapped_column(String(32))
    snapshot_vin: Mapped[str | None] = mapped_column(String(32))
    snapshot_current_km: Mapped[int | None] = mapped_column(Integer)


class TowCase(_VehicleSnapshotMixin, Base):
    """1:1 service_cases subtype — tow (çekici).

    Shell'den taşındı: tow_mode, tow_stage, tow_required_equipment,
    incident_reason, scheduled_at, pickup/dropoff lat/lng/address,
    tow_fare_quote, pickup/dropoff_location (computed geography).

    Faz 2 (2026-04-23): parent_case_id — accident/breakdown case'in
    müşteri sonradan çekici çağırdığında bağlanır (1 parent → 0..n tow).
    """

    __tablename__ = "tow_case"

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"),
        primary_key=True,
    )
    parent_case_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("service_cases.id", ondelete="SET NULL"),
        nullable=True,
    )
    tow_mode: Mapped[TowMode] = mapped_column(
        pg_enum(TowMode, name="tow_mode", create_type=False),
        nullable=False,
    )
    tow_stage: Mapped[TowDispatchStage] = mapped_column(
        pg_enum(TowDispatchStage, name="tow_dispatch_stage", create_type=False),
        nullable=False,
    )
    tow_required_equipment: Mapped[list[TowEquipment] | None] = mapped_column(
        ARRAY(pg_enum(TowEquipment, name="tow_equipment", create_type=False)),
        nullable=True,
    )
    incident_reason: Mapped[TowIncidentReason | None] = mapped_column(
        pg_enum(TowIncidentReason, name="tow_incident_reason", create_type=False),
        nullable=True,
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    pickup_lat: Mapped[float | None] = mapped_column(Float)
    pickup_lng: Mapped[float | None] = mapped_column(Float)
    pickup_address: Mapped[str | None] = mapped_column(String(500))
    dropoff_lat: Mapped[float | None] = mapped_column(Float)
    dropoff_lng: Mapped[float | None] = mapped_column(Float)
    dropoff_address: Mapped[str | None] = mapped_column(String(500))
    tow_fare_quote: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )


class AccidentCase(_VehicleSnapshotMixin, Base):
    """1:1 service_cases subtype — accident (kaza).

    Mevcut request_draft JSONB'den taşınan subtype alanları.
    Pilot V1: VARCHAR/enum gevşek — V1.1'de strict enum'lara geçilir.
    """

    __tablename__ = "accident_case"
    __table_args__ = (
        CheckConstraint(
            "counterparty_count >= 0",
            name="ck_accident_counterparty_nonneg",
        ),
    )

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"),
        primary_key=True,
    )
    damage_area: Mapped[str | None] = mapped_column(String(60))
    damage_severity: Mapped[str | None] = mapped_column(String(32))
    counterparty_count: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="0", default=0
    )
    counterparty_note: Mapped[str | None] = mapped_column(Text)
    kasko_selected: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false", default=False
    )
    sigorta_selected: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false", default=False
    )
    kasko_brand: Mapped[str | None] = mapped_column(String(120))
    sigorta_brand: Mapped[str | None] = mapped_column(String(120))
    ambulance_contacted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false", default=False
    )
    report_method: Mapped[str | None] = mapped_column(String(32))
    emergency_acknowledged: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false", default=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )


class BreakdownCase(_VehicleSnapshotMixin, Base):
    """1:1 service_cases subtype — breakdown (arıza)."""

    __tablename__ = "breakdown_case"

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"),
        primary_key=True,
    )
    breakdown_category: Mapped[str] = mapped_column(String(32), nullable=False)
    symptoms: Mapped[str | None] = mapped_column(Text)
    vehicle_drivable: Mapped[bool | None] = mapped_column(
        Boolean, nullable=True  # unknown/null OK
    )
    on_site_repair_requested: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false", default=False
    )
    valet_requested: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false", default=False
    )
    pickup_preference: Mapped[str | None] = mapped_column(String(32))
    price_preference: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )


class MaintenanceCase(_VehicleSnapshotMixin, Base):
    """1:1 service_cases subtype — maintenance (bakım)."""

    __tablename__ = "maintenance_case"

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"),
        primary_key=True,
    )
    maintenance_category: Mapped[str] = mapped_column(String(40), nullable=False)
    maintenance_detail: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    maintenance_tier: Mapped[str | None] = mapped_column(String(16))
    service_style_preference: Mapped[str | None] = mapped_column(String(32))
    mileage_km: Mapped[int | None] = mapped_column(Integer)
    valet_requested: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false", default=False
    )
    pickup_preference: Mapped[str | None] = mapped_column(String(32))
    price_preference: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
