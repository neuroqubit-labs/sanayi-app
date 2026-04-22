"""Pydantic DTOs for review domain (Faz A PR 8).

Müşteri → usta tek yön V1. Response modeller:
- ReviewResponse — sahip (reviewer + reviewee reviews/me)
- TechnicianReviewItem — public teknisyen detay list'inde PII-masked
  (reviewer_user_id yok; sadece initials)
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ReviewCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    case_id: UUID
    rating: int = Field(ge=1, le=5)
    body: str | None = Field(default=None, max_length=2000)


class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    case_id: UUID
    reviewer_user_id: UUID
    reviewee_user_id: UUID
    rating: int
    body: str | None
    response_body: str | None
    responded_at: datetime | None
    created_at: datetime


class TechnicianReviewItem(BaseModel):
    """Public teknisyen detay review listing — PII-masked (I-9).

    reviewer_user_id YOK; sadece `reviewer_masked_name` (initials).
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    rating: int
    body: str | None
    reviewer_masked_name: str
    response_body: str | None
    responded_at: datetime | None
    created_at: datetime


def mask_reviewer_name(full_name: str | None) -> str:
    """Full name → initials helper (public review listing için).

    'Ahmet Yılmaz' → 'A.Y.' | 'Ali' → 'A.' | None/'' → 'Anonim'
    """
    if not full_name or not full_name.strip():
        return "Anonim"
    parts = full_name.strip().split()
    initials = [p[0].upper() for p in parts[:2] if p]
    if not initials:
        return "Anonim"
    return ".".join(initials) + "."
