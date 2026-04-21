"""Case artifact katmanı (Faz 7b) — kanıt + belge + ek + M:N link tabloları.

Mobil `CaseEvidenceItemSchema`, `CaseDocumentSchema`, `CaseAttachmentSchema`.
Her artifact media_assets FK'sıyla dosyaya bağlanır (SET NULL — dosya gitse
kayıt kalır; gallery'nin tersine, audit + case geçmişi için).

M:N link tabloları:
- `case_approval_evidence_links` — approval ↔ evidence (hangi onay hangi kanıta dayanıyor)
- `case_task_evidence_links` — task ↔ evidence (task requirement satisfaction)
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, PrimaryKeyConstraint, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPkMixin
from app.db.enums import pg_enum

# ─── Enums ──────────────────────────────────────────────────────────────────


class CaseAttachmentKind(StrEnum):
    PHOTO = "photo"
    VIDEO = "video"
    AUDIO = "audio"
    INVOICE = "invoice"
    REPORT = "report"
    DOCUMENT = "document"
    LOCATION = "location"


# ─── Tables ─────────────────────────────────────────────────────────────────


class CaseEvidenceItem(UUIDPkMixin, TimestampMixin, Base):
    """Usta/sistem tarafından yüklenen kanıt (hasar foto, ilerleme, teslim)."""

    __tablename__ = "case_evidence_items"

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"), nullable=False
    )
    task_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("case_tasks.id", ondelete="SET NULL"), nullable=True
    )
    milestone_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("case_milestones.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String(255))
    kind: Mapped[CaseAttachmentKind] = mapped_column(
        pg_enum(CaseAttachmentKind, name="case_attachment_kind"),
        nullable=False,
    )
    # CaseActor enum yeniden yazmak yerine string + CHECK (enum Faz 7a'da)
    actor: Mapped[str] = mapped_column(String(32), nullable=False)
    source_label: Mapped[str] = mapped_column(String(255), nullable=False)
    status_label: Mapped[str] = mapped_column(String(255), nullable=False)
    media_asset_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )
    is_new: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )


class CaseDocument(UUIDPkMixin, TimestampMixin, Base):
    """Belge (fatura, ekspertiz raporu, sigorta poliçesi, vb.)."""

    __tablename__ = "case_documents"

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[CaseAttachmentKind] = mapped_column(
        pg_enum(CaseAttachmentKind, name="case_attachment_kind", create_type=False),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String(255))
    source_label: Mapped[str] = mapped_column(String(255), nullable=False)
    status_label: Mapped[str] = mapped_column(String(255), nullable=False)
    media_asset_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )


class CaseAttachment(UUIDPkMixin, TimestampMixin, Base):
    """Talep anı eki (request_draft.attachments normalize'ı, Eksen 4 [4g])."""

    __tablename__ = "case_attachments"

    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_cases.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[CaseAttachmentKind] = mapped_column(
        pg_enum(CaseAttachmentKind, name="case_attachment_kind", create_type=False),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String(255))
    status_label: Mapped[str | None] = mapped_column(String(255))
    media_asset_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )


# ─── M:N link tabloları ────────────────────────────────────────────────────


class CaseApprovalEvidenceLink(Base):
    """Hangi onay hangi kanıta dayanıyor (approval.evidence_document_ids normalize)."""

    __tablename__ = "case_approval_evidence_links"
    __table_args__ = (
        PrimaryKeyConstraint(
            "approval_id", "evidence_id", name="pk_case_approval_evidence_links"
        ),
    )

    approval_id: Mapped[UUID] = mapped_column(
        ForeignKey("case_approvals.id", ondelete="CASCADE"), nullable=False
    )
    evidence_id: Mapped[UUID] = mapped_column(
        ForeignKey("case_evidence_items.id", ondelete="CASCADE"), nullable=False
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )


class CaseTaskEvidenceLink(Base):
    """Task evidence_requirements satisfaction (hangi task'ın hangi kanıtla tamamlandığı)."""

    __tablename__ = "case_task_evidence_links"
    __table_args__ = (
        PrimaryKeyConstraint(
            "task_id", "evidence_id", name="pk_case_task_evidence_links"
        ),
    )

    task_id: Mapped[UUID] = mapped_column(
        ForeignKey("case_tasks.id", ondelete="CASCADE"), nullable=False
    )
    evidence_id: Mapped[UUID] = mapped_column(
        ForeignKey("case_evidence_items.id", ondelete="CASCADE"), nullable=False
    )
    requirement_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True, doc="Task.evidence_requirements[].id referansı"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default="now()"
    )
