"""Technician V2 sinyal model tabloları (Faz 13 PR 4 Gün 3).

V1 technician tabloları [app/models/technician.py]'de; bu modül V2 signal
model genişletmesi (docs/veri-modeli/16-technician-sinyal-modeli.md).

N:M + 1:1 tabloları + performance snapshot. Taxonomy master tablolarına
foreign key ile bağlanır.
"""

from __future__ import annotations

from datetime import datetime, time
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPkMixin
from app.db.enums import pg_enum
from app.models.vehicle import VehicleKind

# ─── Usta × taxonomy many-to-many ─────────────────────────────────────────


class TechnicianServiceDomain(Base):
    __tablename__ = "technician_service_domains"

    profile_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("technician_profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    domain_key: Mapped[str] = mapped_column(
        String(40),
        ForeignKey("taxonomy_service_domains.domain_key"),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )


class TechnicianProcedure(Base):
    __tablename__ = "technician_procedures"

    profile_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("technician_profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    procedure_key: Mapped[str] = mapped_column(
        String(60),
        ForeignKey("taxonomy_procedures.procedure_key"),
        primary_key=True,
    )
    confidence_self_declared: Mapped[Decimal] = mapped_column(
        Numeric(3, 2), nullable=False, server_default="1.00"
    )
    confidence_verified: Mapped[Decimal | None] = mapped_column(Numeric(3, 2))
    completed_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )


class TechnicianProcedureTag(UUIDPkMixin, Base):
    __tablename__ = "technician_procedure_tags"
    __table_args__ = (
        UniqueConstraint(
            "profile_id", "tag_normalized", name="uq_tech_tags_profile_tag"
        ),
    )

    profile_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("technician_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    tag: Mapped[str] = mapped_column(String(120), nullable=False)
    tag_normalized: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )


class TechnicianBrandCoverage(Base):
    __tablename__ = "technician_brand_coverage"

    profile_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("technician_profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    brand_key: Mapped[str] = mapped_column(
        String(40),
        ForeignKey("taxonomy_brands.brand_key"),
        primary_key=True,
    )
    is_authorized: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    is_premium_authorized: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )


class TechnicianVehicleKindCoverage(Base):
    __tablename__ = "technician_vehicle_kind_coverage"

    profile_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("technician_profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    vehicle_kind: Mapped[VehicleKind] = mapped_column(
        pg_enum(VehicleKind, name="vehicle_kind", create_type=False),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )


class TechnicianDrivetrainCoverage(Base):
    __tablename__ = "technician_drivetrain_coverage"

    profile_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("technician_profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    drivetrain_key: Mapped[str] = mapped_column(
        String(40),
        ForeignKey("taxonomy_drivetrains.drivetrain_key"),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )


class TechnicianServiceArea(Base):
    __tablename__ = "technician_service_area"
    __table_args__ = (
        CheckConstraint(
            "service_radius_km BETWEEN 1 AND 500",
            name="ck_tech_area_radius",
        ),
    )

    profile_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("technician_profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    workshop_lat: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    workshop_lng: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    service_radius_km: Mapped[int] = mapped_column(
        Integer, nullable=False, default=15, server_default="15"
    )
    city_code: Mapped[str] = mapped_column(
        String(8),
        ForeignKey("taxonomy_cities.city_code"),
        nullable=False,
    )
    primary_district_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("taxonomy_districts.district_id"),
    )
    mobile_unit_count: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    workshop_address: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )


class TechnicianWorkingDistrict(Base):
    __tablename__ = "technician_working_districts"

    profile_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("technician_profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    district_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("taxonomy_districts.district_id"),
        primary_key=True,
    )
    is_auto_suggested: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )


class TechnicianWorkingSchedule(UUIDPkMixin, Base):
    __tablename__ = "technician_working_schedule"
    __table_args__ = (
        CheckConstraint(
            "weekday BETWEEN 0 AND 6", name="ck_tech_schedule_weekday"
        ),
        CheckConstraint(
            "(is_closed = TRUE) OR (open_time IS NOT NULL AND close_time IS NOT NULL AND close_time > open_time)",
            name="ck_tech_schedule_times",
        ),
        UniqueConstraint(
            "profile_id", "weekday", "slot_order",
            name="uq_tech_schedule_profile_weekday_slot",
        ),
    )

    profile_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("technician_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    weekday: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    open_time: Mapped[time | None] = mapped_column(Time)
    close_time: Mapped[time | None] = mapped_column(Time)
    is_closed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    slot_order: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )


class TechnicianCapacity(Base):
    __tablename__ = "technician_capacity"

    profile_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("technician_profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    staff_count: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=1, server_default="1"
    )
    max_concurrent_jobs: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=3, server_default="3"
    )
    night_service: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    weekend_service: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    emergency_service: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    current_queue_depth: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )


class TechnicianPerformanceSnapshot(UUIDPkMixin, Base):
    __tablename__ = "technician_performance_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "profile_id", "window_days", "snapshot_at",
            name="uq_tech_perf_snapshot",
        ),
    )

    profile_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("technician_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    window_days: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    snapshot_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )
    completed_jobs: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    rating_bayesian: Mapped[Decimal | None] = mapped_column(Numeric(3, 2))
    rating_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    response_time_p50_minutes: Mapped[int | None] = mapped_column(Integer)
    on_time_rate: Mapped[Decimal | None] = mapped_column(Numeric(4, 3))
    cancellation_rate: Mapped[Decimal | None] = mapped_column(Numeric(4, 3))
    dispute_rate: Mapped[Decimal | None] = mapped_column(Numeric(4, 3))
    warranty_honor_rate: Mapped[Decimal | None] = mapped_column(Numeric(4, 3))
    evidence_discipline_score: Mapped[Decimal | None] = mapped_column(Numeric(4, 3))
    hidden_cost_rate: Mapped[Decimal | None] = mapped_column(Numeric(4, 3))
    market_band_percentile: Mapped[int | None] = mapped_column(SmallInteger)
