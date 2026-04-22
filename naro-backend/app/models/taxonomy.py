"""Master taxonomy SQLAlchemy model'leri — migration 0023'te seed edildi.

6 read-only master table:
- taxonomy_service_domains (12 domain)
- taxonomy_procedures (~30 popular; domain_key FK)
- taxonomy_brands (22 brand; tier enum)
- taxonomy_cities (81 TR il)
- taxonomy_districts (IST/ANK/IZM ilçeleri seed)
- taxonomy_drivetrains (9 drivetrain)

Kullanım: `/taxonomy/*` + `/technicians/me/coverage` + signal matching.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.enums import pg_enum


class BrandTier(StrEnum):
    MASS = "mass"
    PREMIUM = "premium"
    LUXURY = "luxury"
    COMMERCIAL = "commercial"
    MOTORCYCLE = "motorcycle"


class TaxonomyServiceDomain(Base):
    __tablename__ = "taxonomy_service_domains"

    domain_key: Mapped[str] = mapped_column(String(40), primary_key=True)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str | None] = mapped_column(String(40))
    display_order: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="0"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )


class TaxonomyProcedure(Base):
    __tablename__ = "taxonomy_procedures"

    procedure_key: Mapped[str] = mapped_column(String(60), primary_key=True)
    domain_key: Mapped[str] = mapped_column(
        String(40),
        ForeignKey("taxonomy_service_domains.domain_key"),
        nullable=False,
    )
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    typical_labor_hours_min: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    typical_labor_hours_max: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    typical_parts_cost_min: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    typical_parts_cost_max: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    is_popular: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    display_order: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="0"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )


class TaxonomyBrand(Base):
    __tablename__ = "taxonomy_brands"

    brand_key: Mapped[str] = mapped_column(String(40), primary_key=True)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    tier: Mapped[BrandTier] = mapped_column(
        pg_enum(BrandTier, name="brand_tier"),
        nullable=False,
        server_default="mass",
    )
    country_code: Mapped[str | None] = mapped_column(String(2))
    display_order: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="0"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )


class TaxonomyCity(Base):
    __tablename__ = "taxonomy_cities"

    city_code: Mapped[str] = mapped_column(String(8), primary_key=True)
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    region: Mapped[str | None] = mapped_column(String(40))
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )


class TaxonomyDistrict(Base):
    __tablename__ = "taxonomy_districts"

    district_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()"
    )
    city_code: Mapped[str] = mapped_column(
        String(8),
        ForeignKey("taxonomy_cities.city_code"),
        nullable=False,
    )
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    center_lat: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    center_lng: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )


class TaxonomyDrivetrain(Base):
    __tablename__ = "taxonomy_drivetrains"

    drivetrain_key: Mapped[str] = mapped_column(String(40), primary_key=True)
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    fuel_type: Mapped[str] = mapped_column(String(20), nullable=False)
    transmission: Mapped[str | None] = mapped_column(String(20))
    display_order: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="0"
    )
