"""Evidence service — usta kanıt/belge yükleme + M:N link'ler.

`add_evidence_to_case`:
  - case_evidence_items insert
  - opsiyonel task_id → case_task_evidence_links (requirement satisfaction)
  - opsiyonel approval_id → case_approval_evidence_links (proof attachment)

`add_document_to_case`:
  - case_documents insert (fatura, ekspertiz raporu, poliçe, vb.)

`migrate_request_draft_attachments`:
  - Case create sonrası `request_draft.attachments` listesini
    `case_attachments` tablosuna kopyalar (Eksen 4 [4g], 10e).
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case_artifact import (
    CaseApprovalEvidenceLink,
    CaseAttachment,
    CaseAttachmentKind,
    CaseDocument,
    CaseEvidenceItem,
    CaseTaskEvidenceLink,
)
from app.models.case_audit import CaseEventType, CaseTone
from app.services.case_events import append_event


async def add_evidence_to_case(
    session: AsyncSession,
    *,
    case_id: UUID,
    title: str,
    kind: CaseAttachmentKind,
    actor: str,
    source_label: str,
    status_label: str = "Yüklendi",
    subtitle: str | None = None,
    media_asset_id: UUID | None = None,
    task_id: UUID | None = None,
    milestone_id: UUID | None = None,
    approval_id: UUID | None = None,
    requirement_id: str | None = None,
) -> CaseEvidenceItem:
    evidence = CaseEvidenceItem(
        case_id=case_id,
        task_id=task_id,
        milestone_id=milestone_id,
        title=title,
        subtitle=subtitle,
        kind=kind,
        actor=actor,
        source_label=source_label,
        status_label=status_label,
        media_asset_id=media_asset_id,
    )
    session.add(evidence)
    await session.flush()

    if task_id is not None:
        session.add(
            CaseTaskEvidenceLink(
                task_id=task_id,
                evidence_id=evidence.id,
                requirement_id=requirement_id,
            )
        )
    if approval_id is not None:
        session.add(
            CaseApprovalEvidenceLink(
                approval_id=approval_id,
                evidence_id=evidence.id,
            )
        )
    await session.flush()

    await append_event(
        session,
        case_id=case_id,
        event_type=CaseEventType.EVIDENCE_ADDED,
        title=f"Kanıt eklendi: {title}",
        tone=CaseTone.INFO,
        context={"evidence_id": str(evidence.id), "kind": kind.value, "actor": actor},
    )
    return evidence


async def add_document_to_case(
    session: AsyncSession,
    *,
    case_id: UUID,
    title: str,
    kind: CaseAttachmentKind,
    source_label: str,
    status_label: str = "Hazır",
    subtitle: str | None = None,
    media_asset_id: UUID | None = None,
) -> CaseDocument:
    doc = CaseDocument(
        case_id=case_id,
        kind=kind,
        title=title,
        subtitle=subtitle,
        source_label=source_label,
        status_label=status_label,
        media_asset_id=media_asset_id,
    )
    session.add(doc)
    await session.flush()

    await append_event(
        session,
        case_id=case_id,
        event_type=CaseEventType.DOCUMENT_ADDED,
        title=f"Belge eklendi: {title}",
        tone=CaseTone.INFO,
        context={"document_id": str(doc.id), "kind": kind.value},
    )
    return doc


async def migrate_request_draft_attachments(
    session: AsyncSession,
    *,
    case_id: UUID,
    attachments_payload: list[dict[str, object]],
) -> list[CaseAttachment]:
    """`ServiceRequestDraftCreate.attachments` listesini tabloya migrate eder.

    Eksen 4 [4g]: request_draft JSONB'deki attachments snapshot read-only
    kalır; tablo yeni create + sonraki eklemeler için kaynak.
    """
    rows: list[CaseAttachment] = []
    for item in attachments_payload:
        kind_raw = item.get("kind")
        title = item.get("title")
        if not isinstance(kind_raw, str) or not isinstance(title, str):
            continue  # geçersiz — atla (snapshot kaynak verisi güvenilmez olabilir)
        try:
            kind = CaseAttachmentKind(kind_raw)
        except ValueError:
            continue
        subtitle = item.get("subtitle")
        status_label = item.get("status_label") or item.get("statusLabel")
        asset_id_raw = item.get("asset_id") or item.get("assetId")
        media_asset_id: UUID | None = None
        if isinstance(asset_id_raw, str):
            try:
                media_asset_id = UUID(asset_id_raw)
            except ValueError:
                media_asset_id = None

        row = CaseAttachment(
            case_id=case_id,
            kind=kind,
            title=title,
            subtitle=subtitle if isinstance(subtitle, str) else None,
            status_label=status_label if isinstance(status_label, str) else None,
            media_asset_id=media_asset_id,
        )
        session.add(row)
        rows.append(row)

    await session.flush()
    return rows
