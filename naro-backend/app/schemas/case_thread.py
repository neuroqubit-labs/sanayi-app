"""Case thread (mesajlaşma) schemas — İş 3 (2026-04-23).

Brief: PO "3 yeni endpoint" thread + notes.

DB katmanı `CaseMessage.author_role / body` olarak saklar; API response
layer'da brief'teki canonical isimlerle (`sender_role / content`) döner.
Migration 0034 Seçenek A (PO karar) — mevcut case_messages tablosunu
kullan, yeni tablo AÇMA.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

SenderRole = Literal["customer", "technician"]
_MESSAGE_MAX = 2000
_NOTES_MAX = 2000


class ThreadMessageCreatePayload(BaseModel):
    """POST /cases/{id}/thread/messages body."""

    model_config = ConfigDict(extra="forbid")

    content: Annotated[str, Field(min_length=1, max_length=_MESSAGE_MAX)]


class ThreadMessageResponse(BaseModel):
    """Thread mesajı wire formatı — sender_role/content canonical isim."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    sender_role: SenderRole
    content: str
    created_at: datetime


class ThreadMessageListResponse(BaseModel):
    """GET /cases/{id}/thread/messages cursor paginated."""

    items: list[ThreadMessageResponse]
    next_cursor: str | None = None


class CaseNotesPayload(BaseModel):
    """PATCH /cases/{id}/notes body — owner-private."""

    model_config = ConfigDict(extra="forbid")

    content: Annotated[str, Field(max_length=_NOTES_MAX)] | None = None
