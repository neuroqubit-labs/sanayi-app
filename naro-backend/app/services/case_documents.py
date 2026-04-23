"""Case documents + events read service — İş 5 (FE engine.ts blocker).

Source-of-truth:
- Documents: media_assets.linked_case_id (SET NULL'lı; file kalır, audit)
- Events: case_events (append-only audit trail)

Signed URL: S3 presigned GET, 15 dk TTL (brief). Antivirus verdict
alanı NULL → "pending" olarak wire edilir.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.storage.s3 import S3StorageGateway
from app.models.case_audit import CaseEvent
from app.models.media import MediaAsset, MediaPurpose
from app.models.user import User, UserRole
from app.schemas.case_document import (
    ActorRole,
    AntivirusVerdict,
    CaseDocumentKind,
    UploaderRole,
)

SIGNED_URL_TTL_SECONDS = 15 * 60  # 15 dk


# ─── Purpose → CaseDocumentKind mapping ───────────────────────────────


_PURPOSE_TO_KIND: dict[MediaPurpose, CaseDocumentKind] = {
    MediaPurpose.CASE_DAMAGE_PHOTO: CaseDocumentKind.DAMAGE_PHOTO,
    MediaPurpose.ACCIDENT_PROOF: CaseDocumentKind.DAMAGE_PHOTO,
    MediaPurpose.CASE_EVIDENCE_PHOTO: CaseDocumentKind.DAMAGE_PHOTO,
    MediaPurpose.CASE_EVIDENCE_VIDEO: CaseDocumentKind.DAMAGE_PHOTO,
    MediaPurpose.TOW_ARRIVAL_PHOTO: CaseDocumentKind.DAMAGE_PHOTO,
    MediaPurpose.TOW_LOADING_PHOTO: CaseDocumentKind.DAMAGE_PHOTO,
    MediaPurpose.TOW_DELIVERY_PHOTO: CaseDocumentKind.DAMAGE_PHOTO,
    MediaPurpose.INSURANCE_DOC: CaseDocumentKind.KASKO_FORM,
}


def classify_document_kind(purpose: MediaPurpose) -> CaseDocumentKind:
    """Purpose → kind mapping. Eşleşmeyen = OTHER (invoice/parts_receipt/
    police_report V1'de ayrı purpose yok; V1.1 ekle)."""
    return _PURPOSE_TO_KIND.get(purpose, CaseDocumentKind.OTHER)


# ─── Documents list ───────────────────────────────────────────────────


@dataclass(slots=True)
class DocumentView:
    asset: MediaAsset
    signed_url: str
    uploader_role: UploaderRole | None


def _uploader_role_from_db_role(
    role: UserRole | None,
) -> UploaderRole | None:
    if role is None:
        return None
    if role == UserRole.CUSTOMER:
        return "customer"
    if role == UserRole.TECHNICIAN:
        return "technician"
    if role == UserRole.ADMIN:
        return "admin"
    return None


def antivirus_verdict(value: str | None) -> AntivirusVerdict:
    """DB value (clean/pending/infected/null) → wire enum. Null → pending."""
    if value == "clean":
        return "clean"
    if value == "infected":
        return "infected"
    return "pending"


async def list_documents(
    session: AsyncSession,
    *,
    case_id: UUID,
    storage: S3StorageGateway,
) -> list[DocumentView]:
    """Case'e bağlı tüm media_assets (soft delete hariç) DESC uploaded_at."""
    stmt = (
        select(MediaAsset, User.role)
        .join(User, User.id == MediaAsset.uploaded_by_user_id, isouter=True)
        .where(
            and_(
                MediaAsset.linked_case_id == case_id,
                MediaAsset.deleted_at.is_(None),
            )
        )
        .order_by(
            MediaAsset.uploaded_at.desc().nulls_last(),
            MediaAsset.id.desc(),
        )
    )
    rows = (await session.execute(stmt)).all()
    views: list[DocumentView] = []
    for asset, role in rows:
        signed_url = storage.create_presigned_download(
            bucket=asset.bucket_name,
            object_key=asset.object_key,
            expires_in=SIGNED_URL_TTL_SECONDS,
        )
        views.append(
            DocumentView(
                asset=asset,
                signed_url=signed_url,
                uploader_role=_uploader_role_from_db_role(role),
            )
        )
    return views


# ─── Events list (cursor, ASC) ────────────────────────────────────────


@dataclass(slots=True)
class EventPage:
    items: list[tuple[CaseEvent, ActorRole | None]]
    next_cursor: str | None


def _encode_cursor(created_at: datetime, event_id: UUID) -> str:
    raw = f"{created_at.isoformat()}|{event_id}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def _decode_cursor(cursor: str) -> tuple[datetime, UUID]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        ts_str, uid_str = raw.split("|", 1)
        return datetime.fromisoformat(ts_str), UUID(uid_str)
    except (ValueError, TypeError) as exc:
        raise ValueError("invalid cursor") from exc


def _actor_role_from_db_role(role: UserRole | None) -> ActorRole | None:
    mapped = _uploader_role_from_db_role(role)
    if mapped is not None:
        return mapped
    return None


async def list_events(
    session: AsyncSession,
    *,
    case_id: UUID,
    limit: int,
    cursor: str | None,
) -> EventPage:
    """Timeline — ASC created_at; actor_user_id null ise actor_role = system."""
    conds = [CaseEvent.case_id == case_id]
    if cursor:
        cur_ts, cur_id = _decode_cursor(cursor)
        conds.append(
            (CaseEvent.created_at > cur_ts)
            | (
                (CaseEvent.created_at == cur_ts)
                & (CaseEvent.id > cur_id)
            )
        )
    stmt = (
        select(CaseEvent, User.role)
        .join(User, User.id == CaseEvent.actor_user_id, isouter=True)
        .where(and_(*conds))
        .order_by(CaseEvent.created_at.asc(), CaseEvent.id.asc())
        .limit(limit + 1)
    )
    rows = list((await session.execute(stmt)).all())
    has_more = len(rows) > limit
    items_rows = rows[:limit]
    items: list[tuple[CaseEvent, ActorRole | None]] = []
    for event, db_role in items_rows:
        actor_role: ActorRole | None = _actor_role_from_db_role(db_role)
        if actor_role is None and event.actor_user_id is None:
            actor_role = "system"
        items.append((event, actor_role))
    next_cursor = (
        _encode_cursor(items_rows[-1][0].created_at, items_rows[-1][0].id)
        if has_more and items_rows
        else None
    )
    return EventPage(items=items, next_cursor=next_cursor)


# Re-export for readability at call sites
__all__ = [
    "SIGNED_URL_TTL_SECONDS",
    "DocumentView",
    "EventPage",
    "antivirus_verdict",
    "classify_document_kind",
    "list_documents",
    "list_events",
]
