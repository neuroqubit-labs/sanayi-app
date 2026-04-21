"""UserPaymentMethod — V1 rezerve tablo (V1.1 PSP switch ile aktif).

MockPsp V1'de kart tokenı tutulmaz; checkout redirect ile her seferinde 3DS.
V1.1'de Iyzico tokenization → `card_token` doldurulur.
KVKK: user CASCADE + PSP detokenize (service layer).
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPkMixin


class UserPaymentMethod(UUIDPkMixin, Base):
    __tablename__ = "user_payment_methods"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    card_token: Mapped[str] = mapped_column(String(512), nullable=False)
    brand: Mapped[str | None] = mapped_column(String(32))
    last4: Mapped[str | None] = mapped_column(String(4))
    expires_month: Mapped[int | None] = mapped_column(SmallInteger)
    expires_year: Mapped[int | None] = mapped_column(SmallInteger)
    is_default: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default="now()",
        nullable=False,
    )
