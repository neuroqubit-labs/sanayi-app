from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin
from app.db.enums import pg_enum


class UserRole(StrEnum):
    CUSTOMER = "customer"
    TECHNICIAN = "technician"
    ADMIN = "admin"


class UserStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"


class UserApprovalStatus(StrEnum):
    """Technician-specific admin approval state (KYC)."""

    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    REJECTED = "rejected"


class User(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        Index(
            "uq_users_phone",
            "phone",
            unique=True,
            postgresql_where="phone IS NOT NULL AND deleted_at IS NULL",
        ),
        Index(
            "uq_users_email",
            "email",
            unique=True,
            postgresql_where="email IS NOT NULL AND deleted_at IS NULL",
        ),
    )

    phone: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(255))
    full_name: Mapped[str | None] = mapped_column(String(255))

    role: Mapped[UserRole] = mapped_column(
        pg_enum(UserRole, name="user_role"), nullable=False, default=UserRole.CUSTOMER
    )
    status: Mapped[UserStatus] = mapped_column(
        pg_enum(UserStatus, name="user_status"), nullable=False, default=UserStatus.PENDING
    )
    approval_status: Mapped[UserApprovalStatus | None] = mapped_column(
        pg_enum(UserApprovalStatus, name="user_approval_status"), nullable=True
    )
    locale: Mapped[str] = mapped_column(String(10), nullable=False, default="tr-TR")
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
