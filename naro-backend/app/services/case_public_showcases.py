"""Case public showcase service.

Kapanış akışından gelen izinleri tek yerde yorumlar ve public-safe snapshot
üretir. UI hiçbir zaman ham vaka/vergi/adres/araç plaka bilgisine güvenerek
filtreleme yapmaz.
"""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.integrations.storage import build_storage_gateway
from app.models.case import ServiceCase, ServiceRequestKind
from app.models.case_artifact import CaseAttachmentKind, CaseEvidenceItem
from app.models.case_process import CaseApproval, CaseApprovalLineItem
from app.models.case_public_showcase import (
    CasePublicShowcase,
    CasePublicShowcaseMedia,
    CasePublicShowcaseStatus,
)
from app.models.media import MediaAsset, MediaPurpose, MediaStatus, MediaVisibility
from app.models.technician import TechnicianProfile
from app.services.technician_admission import bump_role_config_version

logger = logging.getLogger(__name__)

KIND_LABELS: dict[ServiceRequestKind, str] = {
    ServiceRequestKind.ACCIDENT: "Hasar / kaza süreci",
    ServiceRequestKind.TOWING: "Çekici / yol yardım süreci",
    ServiceRequestKind.BREAKDOWN: "Arıza çözümü",
    ServiceRequestKind.MAINTENANCE: "Bakım işlemi",
}

MONTHS_TR = {
    1: "Ocak",
    2: "Şubat",
    3: "Mart",
    4: "Nisan",
    5: "Mayıs",
    6: "Haziran",
    7: "Temmuz",
    8: "Ağustos",
    9: "Eylül",
    10: "Ekim",
    11: "Kasım",
    12: "Aralık",
}

_FINANCIAL_RE = re.compile(r"(tutar|ücret|ucret|fatura|ödeme|odeme|tl|₺)", re.I)
_KM_RE = re.compile(r"(\d[\d\.\,\s]{1,12})")
_EMAIL_RE = re.compile(r"[\w\.-]+@[\w\.-]+\.\w+")
_PHONE_RE = re.compile(r"(?:\+90|0)?\s?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}")
_PLATE_RE = re.compile(r"\b\d{2}\s?[A-ZÇĞİÖŞÜ]{1,3}\s?\d{2,4}\b", re.I)
_MONEY_RE = re.compile(r"\b\d[\d\.\, ]{1,12}\s?(?:₺|TL|TRY)\b", re.I)


def _now() -> datetime:
    return datetime.now(UTC)


def _compact_text(value: str | None, *, max_len: int) -> str | None:
    if value is None:
        return None
    compact = " ".join(value.strip().split())
    if not compact:
        return None
    compact = _EMAIL_RE.sub("[email gizli]", compact)
    compact = _PHONE_RE.sub("[telefon gizli]", compact)
    compact = _PLATE_RE.sub("[plaka gizli]", compact)
    compact = _MONEY_RE.sub("[tutar gizli]", compact)
    if len(compact) <= max_len:
        return compact
    return compact[: max_len - 1].rstrip() + "…"


def _month_label(value: datetime | None) -> str:
    dt = value or _now()
    return f"{MONTHS_TR.get(dt.month, dt.strftime('%B'))} {dt.year}"


def _sanitize_location(value: str | None) -> str | None:
    compact = _compact_text(value, max_len=90)
    if compact is None:
        return None
    # Açık adres riski: bina/kapı numarası gibi çıplak sayıları düşür.
    compact = re.sub(r"\b\d+[A-Za-zçğıöşüÇĞİÖŞÜ/-]*\b", "", compact)
    parts = [part.strip(" ,.-") for part in compact.split(",") if part.strip()]
    if len(parts) >= 2:
        return f"{parts[0]}, {parts[1]}"
    return _compact_text(parts[0] if parts else compact, max_len=60)


def _km_band(value: str) -> str | None:
    match = _KM_RE.search(value)
    if match is None:
        return None
    digits = re.sub(r"\D", "", match.group(1))
    if not digits:
        return None
    km = int(digits)
    lower = (km // 10000) * 10
    upper = lower + 10
    return f"{lower}-{upper} bin km bandı"


def _safe_line_value(label: str, value: str) -> str | None:
    if _FINANCIAL_RE.search(label) or _FINANCIAL_RE.search(value):
        return None
    label_lower = label.lower()
    if "tarih" in label_lower:
        return "Teslim döneminde"
    if "km" in label_lower or "kilometre" in label_lower or "bakım" in label_lower:
        return _km_band(value) or _compact_text(value, max_len=80)
    return _compact_text(value, max_len=140)


def _safe_filename(value: str | None, *, fallback: str) -> str:
    raw = (value or fallback).strip() or fallback
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", raw).strip("-._")
    return cleaned[:120] or fallback


def _public_copy_purpose(source: MediaAsset) -> MediaPurpose:
    if source.mime_type.startswith("video/"):
        return MediaPurpose.TECHNICIAN_GALLERY_VIDEO
    return MediaPurpose.TECHNICIAN_GALLERY_PHOTO


def _public_line_items(
    line_items: list[CaseApprovalLineItem],
) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for item in line_items:
        value = _safe_line_value(item.label, item.value)
        if value is None:
            continue
        rows.append({"label": item.label, "value": value})
        if len(rows) >= 5:
            break
    return rows


def build_public_snapshot(
    case: ServiceCase,
    approval: CaseApproval | None,
    line_items: list[CaseApprovalLineItem],
    *,
    rating: int | None = None,
    review_body: str | None = None,
) -> dict[str, object]:
    report_rows = _public_line_items(line_items)
    work_summary = next(
        (
            row["value"]
            for row in report_rows
            if "işlem" in row["label"].lower() or "özet" in row["label"].lower()
        ),
        None,
    )
    approval_description = approval.description if approval is not None else None
    summary = _compact_text(
        work_summary
        or approval_description
        or case.summary
        or case.subtitle
        or case.title,
        max_len=180,
    )
    title = KIND_LABELS.get(case.kind, "Tamamlanan servis süreci")
    return {
        "kind": case.kind.value,
        "kind_label": title,
        "title": title,
        "summary": summary or title,
        "month_label": _month_label(case.closed_at or case.updated_at),
        "location_label": _sanitize_location(case.location_label),
        "delivery_report": report_rows,
        "rating": rating,
        "review_body": _compact_text(review_body, max_len=280),
    }


def recompute_status(showcase: CasePublicShowcase) -> None:
    now = _now()
    if showcase.hidden_at is not None:
        showcase.status = CasePublicShowcaseStatus.HIDDEN
        return
    if (
        showcase.technician_revoked_at is not None
        or showcase.customer_revoked_at is not None
    ):
        showcase.status = CasePublicShowcaseStatus.REVOKED
        return
    if showcase.technician_consented_at is None:
        showcase.status = CasePublicShowcaseStatus.PENDING_TECHNICIAN
        return
    if showcase.customer_consented_at is None:
        showcase.status = CasePublicShowcaseStatus.PENDING_CUSTOMER
        return
    showcase.status = CasePublicShowcaseStatus.PUBLISHED
    if showcase.published_at is None:
        showcase.published_at = now


async def get_profile_id_for_user(
    session: AsyncSession, technician_user_id: UUID | None
) -> UUID | None:
    if technician_user_id is None:
        return None
    stmt = select(TechnicianProfile.id).where(
        TechnicianProfile.user_id == technician_user_id,
        TechnicianProfile.deleted_at.is_(None),
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_by_case(
    session: AsyncSession, case_id: UUID
) -> CasePublicShowcase | None:
    stmt = select(CasePublicShowcase).where(CasePublicShowcase.case_id == case_id)
    return (await session.execute(stmt)).scalar_one_or_none()


async def _sync_media(
    session: AsyncSession,
    showcase: CasePublicShowcase,
    *,
    case_id: UUID,
    media_ids: list[UUID],
) -> None:
    await session.execute(
        delete(CasePublicShowcaseMedia).where(
            CasePublicShowcaseMedia.showcase_id == showcase.id
        )
    )
    if not media_ids:
        return

    evidence_stmt = (
        select(CaseEvidenceItem)
        .where(
            CaseEvidenceItem.case_id == case_id,
            CaseEvidenceItem.media_asset_id.in_(media_ids),
            CaseEvidenceItem.kind.in_(
                [CaseAttachmentKind.PHOTO, CaseAttachmentKind.VIDEO]
            ),
        )
        .limit(4)
    )
    evidence_items = list((await session.execute(evidence_stmt)).scalars().all())
    order = {media_id: index for index, media_id in enumerate(media_ids)}
    evidence_items.sort(
        key=lambda item: order.get(item.media_asset_id, len(media_ids))
    )
    for index, evidence in enumerate(evidence_items[:4]):
        if evidence.media_asset_id is None:
            continue
        source_asset = await session.get(MediaAsset, evidence.media_asset_id)
        public_asset = await _ensure_public_showcase_asset(
            session,
            showcase=showcase,
            source_asset=source_asset,
        )
        if public_asset is None:
            continue
        session.add(
            CasePublicShowcaseMedia(
                showcase_id=showcase.id,
                media_asset_id=public_asset.id,
                evidence_id=evidence.id,
                kind="video" if evidence.kind == CaseAttachmentKind.VIDEO else "photo",
                title=_compact_text(evidence.title, max_len=120),
                caption=_compact_text(evidence.subtitle, max_len=220),
                sequence=index,
            )
        )


async def _ensure_public_showcase_asset(
    session: AsyncSession,
    *,
    showcase: CasePublicShowcase,
    source_asset: MediaAsset | None,
) -> MediaAsset | None:
    """Return a public-safe media asset for showcase rendering.

    Case evidence remains private. For public profile rendering we copy the
    original object into the public bucket and store a separate MediaAsset row.
    Copy failures are deliberately non-blocking; the showcase can still publish
    without media and a later request can retry the copy.
    """
    if source_asset is None or source_asset.deleted_at is not None:
        return None
    if source_asset.status not in {MediaStatus.READY, MediaStatus.UPLOADED}:
        return None
    if source_asset.visibility == MediaVisibility.PUBLIC:
        return source_asset

    owner_ref = f"showcase:{showcase.id}:source:{source_asset.id}"
    existing_stmt = (
        select(MediaAsset)
        .where(
            MediaAsset.owner_ref == owner_ref,
            MediaAsset.visibility == MediaVisibility.PUBLIC,
            MediaAsset.deleted_at.is_(None),
        )
        .order_by(MediaAsset.created_at.desc())
        .limit(1)
    )
    existing = (await session.execute(existing_stmt)).scalar_one_or_none()
    if existing is not None and existing.status in {
        MediaStatus.READY,
        MediaStatus.UPLOADED,
    }:
        return existing

    settings = get_settings()
    storage = build_storage_gateway(settings)
    public_bucket = settings.s3_public_bucket
    filename = _safe_filename(
        source_asset.original_filename,
        fallback=f"{source_asset.id}.bin",
    )
    public_key = f"public/showcases/{showcase.id}/{source_asset.id}/{filename}"

    try:
        storage.ensure_bucket_exists(bucket=public_bucket)
        content = storage.read_bytes(
            bucket=source_asset.bucket_name,
            object_key=source_asset.object_key,
        )
        storage.write_bytes(
            bucket=public_bucket,
            object_key=public_key,
            content=content,
            content_type=source_asset.mime_type,
        )
    except Exception:
        logger.exception(
            "public showcase media copy failed showcase=%s source_asset=%s",
            showcase.id,
            source_asset.id,
        )
        return None

    public_asset = MediaAsset(
        purpose=_public_copy_purpose(source_asset),
        visibility=MediaVisibility.PUBLIC,
        status=MediaStatus.READY,
        owner_ref=owner_ref,
        owner_kind="technician_profile",
        owner_id=showcase.technician_profile_id,
        bucket_name=public_bucket,
        object_key=public_key,
        original_filename=source_asset.original_filename,
        mime_type=source_asset.mime_type,
        size_bytes=source_asset.size_bytes,
        checksum_sha256=source_asset.checksum_sha256,
        dimensions_json=source_asset.dimensions_json,
        duration_sec=source_asset.duration_sec,
        uploaded_by_user_id=source_asset.uploaded_by_user_id,
        linked_case_id=showcase.case_id,
        uploaded_at=_now(),
    )
    session.add(public_asset)
    await session.flush()
    return public_asset


async def upsert_from_completion_request(
    session: AsyncSession,
    *,
    case: ServiceCase,
    approval: CaseApproval,
    line_items: list[CaseApprovalLineItem],
    technician_consented: bool,
    media_ids: list[UUID],
) -> CasePublicShowcase | None:
    if case.assigned_technician_id is None:
        return None
    profile_id = await get_profile_id_for_user(session, case.assigned_technician_id)
    if profile_id is None:
        return None

    showcase = await get_by_case(session, case.id)
    if showcase is None:
        showcase = CasePublicShowcase(
            case_id=case.id,
            technician_profile_id=profile_id,
            technician_user_id=case.assigned_technician_id,
            customer_user_id=case.customer_user_id,
            kind=case.kind,
            public_snapshot=build_public_snapshot(case, approval, line_items),
        )
        session.add(showcase)
        await session.flush()
    else:
        showcase.public_snapshot = build_public_snapshot(case, approval, line_items)

    if technician_consented and showcase.technician_consented_at is None:
        showcase.technician_consented_at = _now()
        showcase.technician_revoked_at = None
    await _sync_media(session, showcase, case_id=case.id, media_ids=media_ids)
    recompute_status(showcase)
    await bump_role_config_version(session, profile_id)
    await session.flush()
    return showcase


async def apply_customer_completion_decision(
    session: AsyncSession,
    *,
    case: ServiceCase,
    approval: CaseApproval,
    line_items: list[CaseApprovalLineItem],
    customer_consented: bool,
    rating: int,
    review_body: str | None,
    review_id: UUID | None,
) -> CasePublicShowcase | None:
    if case.assigned_technician_id is None:
        return None
    profile_id = await get_profile_id_for_user(session, case.assigned_technician_id)
    if profile_id is None:
        return None

    showcase = await get_by_case(session, case.id)
    if showcase is None:
        showcase = CasePublicShowcase(
            case_id=case.id,
            technician_profile_id=profile_id,
            technician_user_id=case.assigned_technician_id,
            customer_user_id=case.customer_user_id,
            kind=case.kind,
        )
        session.add(showcase)
        await session.flush()

    if customer_consented and showcase.customer_consented_at is None:
        showcase.customer_consented_at = _now()
        showcase.customer_revoked_at = None
    showcase.review_id = review_id
    showcase.public_snapshot = build_public_snapshot(
        case,
        approval,
        line_items,
        rating=rating,
        review_body=review_body,
    )
    recompute_status(showcase)
    await bump_role_config_version(session, profile_id)
    await session.flush()
    return showcase


async def revoke_for_actor(
    session: AsyncSession,
    *,
    showcase: CasePublicShowcase,
    actor: str,
) -> CasePublicShowcase:
    now = _now()
    if actor == "technician":
        showcase.technician_revoked_at = now
    elif actor == "customer":
        showcase.customer_revoked_at = now
    else:
        showcase.hidden_at = now
    recompute_status(showcase)
    await bump_role_config_version(session, showcase.technician_profile_id)
    await session.flush()
    return showcase


def snapshot_value(snapshot: dict[str, Any], key: str) -> Any:
    value = snapshot.get(key)
    return value
