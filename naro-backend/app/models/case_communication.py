"""Case communication katmanı (Faz 7c) — thread + message + message_attachments.

Case başına 1 thread (Eksen 4 [4c] — şu an 1:1; V2'de kind eklenerek N:1).
Mesaj author `customer | technician | system`; system mesajları `author_user_id`
NULL olur.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin


class CaseMessageAuthorRole(StrEnum):
    CUSTOMER = "customer"
    TECHNICIAN = "technician"
    SYSTEM = "system"


class CaseThread(UUIDPkMixin, TimestampMixin, Base):
    """Case başına 1 thread (UNIQUE). V2: kind kolonu eklenerek N:1."""

    __tablename__ = "case_threads"

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    preview: Mapped[str | None] = mapped_column(String(512))
    unread_customer: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    unread_technician: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )


class CaseMessage(UUIDPkMixin, Base):
    """Thread içi tek mesaj. system mesajları author_user_id=NULL."""

    __tablename__ = "case_messages"
    __table_args__ = (
        CheckConstraint(
            "author_role IN ('customer','technician','system')",
            name="ck_case_messages_author_role",
        ),
    )

    thread_id: Mapped[UUID] = mapped_column(
        ForeignKey("case_threads.id", ondelete="CASCADE"), nullable=False
    )
    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"), nullable=False
    )
    author_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    author_role: Mapped[str] = mapped_column(String(16), nullable=False)
    author_snapshot_name: Mapped[str | None] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class CaseMessageAttachment(Base):
    """Mesaj-media M:N. CASCADE her iki taraf (dosyasız mesaj eki anlamsız)."""

    __tablename__ = "case_message_attachments"

    message_id: Mapped[UUID] = mapped_column(
        ForeignKey("case_messages.id", ondelete="CASCADE"),
        primary_key=True,
    )
    media_asset_id: Mapped[UUID] = mapped_column(
        ForeignKey("media_assets.id", ondelete="CASCADE"),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
