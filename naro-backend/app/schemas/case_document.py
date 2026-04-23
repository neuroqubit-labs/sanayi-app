"""Case document + event endpoint schemas — İş 5 (FE engine.ts blocker).

Brief: PO 2026-04-23. FE engine canonical rewrite için live read stream.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.case_audit import CaseEventType, CaseTone


class CaseDocumentKind(StrEnum):
    """Case belge kategorisi (UI grouping için — 6 değer).

    Mapping: media_assets.purpose (18 değer) → 6 kategori (helper:
    app.services.case_documents.classify_document_kind).
    """

    DAMAGE_PHOTO = "damage_photo"
    INVOICE = "invoice"
    KASKO_FORM = "kasko_form"
    POLICE_REPORT = "police_report"
    PARTS_RECEIPT = "parts_receipt"
    OTHER = "other"


UploaderRole = Literal["customer", "technician", "admin"]
AntivirusVerdict = Literal["clean", "pending", "infected"]


class CaseDocumentItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: CaseDocumentKind
    title: str
    signed_url: str
    uploader_role: UploaderRole | None = None
    uploader_user_id: UUID | None = None
    uploaded_at: datetime
    size_bytes: int
    mime_type: str
    antivirus_verdict: AntivirusVerdict


class CaseDocumentListResponse(BaseModel):
    items: list[CaseDocumentItem]


# ─── Events ────────────────────────────────────────────────────────────


ActorRole = Literal["customer", "technician", "admin", "system"]


class CaseEventItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: CaseEventType
    title: str
    body: str | None = None
    tone: CaseTone
    actor_user_id: UUID | None = None
    actor_role: ActorRole | None = None
    context: dict[str, object]
    created_at: datetime


class CaseEventListResponse(BaseModel):
    items: list[CaseEventItem]
    next_cursor: str | None = None
