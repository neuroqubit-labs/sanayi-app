"""media_asset_alter: owner_kind + owner_id + exif/antivirus audit + dims/duration + partial indexes

Revision ID: 20260422_0020
Revises: 20260422_0019
Create Date: 2026-04-22 18:45:00.000000

Faz 11 — Media upgrade DDL.

- `media_assets` ALTER: owner_kind + owner_id + exif_stripped_at +
  antivirus_scanned_at + antivirus_verdict + dimensions_json + duration_sec
- Backfill: mevcut `owner_ref` (string) → owner_kind/owner_id parse best-effort
  (UUID patterns). Parse başarısız → owner_kind=null; service layer yazımda doldurur.
- Partial indexes:
  - `ix_media_assets_pending_old` (created_at) WHERE status='pending_upload' — orphan cron
  - `ix_media_assets_owner_active` (owner_kind, owner_id) WHERE deleted_at IS NULL
    AND status IN ('ready','uploaded') — polymorphic lookup
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260422_0020"
down_revision: str | None = "20260422_0019"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("media_assets", sa.Column("owner_kind", sa.String(32), nullable=True))
    op.add_column(
        "media_assets",
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "media_assets",
        sa.Column("exif_stripped_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "media_assets",
        sa.Column("antivirus_scanned_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "media_assets",
        sa.Column("antivirus_verdict", sa.String(16), nullable=True),
    )
    op.add_column(
        "media_assets",
        sa.Column(
            "dimensions_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "media_assets",
        sa.Column("duration_sec", sa.SmallInteger(), nullable=True),
    )

    # Backfill owner_kind/owner_id from owner_ref best-effort:
    # Pattern: "case:{uuid}" or "technician_certificate:{uuid}" etc.
    op.execute(
        """
        UPDATE media_assets
        SET owner_kind = CASE
            WHEN owner_ref LIKE 'case:%' THEN 'service_case'
            WHEN owner_ref LIKE 'technician_certificate:%' THEN 'technician_certificate'
            WHEN owner_ref LIKE 'technician_profile:%' THEN 'technician_profile'
            WHEN owner_ref LIKE 'user:%' THEN 'user'
            WHEN owner_ref LIKE 'vehicle:%' THEN 'vehicle'
            WHEN owner_ref LIKE 'insurance_claim:%' THEN 'insurance_claim'
            WHEN owner_ref LIKE 'campaign:%' THEN 'campaign'
            ELSE NULL
        END
        WHERE owner_kind IS NULL AND owner_ref IS NOT NULL
        """
    )
    # owner_id UUID parse: "prefix:{uuid}" → uuid (safe on cast failure)
    op.execute(
        """
        UPDATE media_assets
        SET owner_id = NULLIF(split_part(owner_ref, ':', 2), '')::uuid
        WHERE owner_id IS NULL
          AND owner_ref ~ ':[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        """
    )

    op.create_index(
        "ix_media_assets_pending_old",
        "media_assets",
        ["created_at"],
        postgresql_where=sa.text("status = 'pending_upload'"),
    )
    op.create_index(
        "ix_media_assets_owner_active",
        "media_assets",
        ["owner_kind", "owner_id"],
        postgresql_where=sa.text(
            "deleted_at IS NULL AND status IN ('ready', 'uploaded')"
        ),
    )


def downgrade() -> None:
    op.drop_index("ix_media_assets_owner_active", table_name="media_assets")
    op.drop_index("ix_media_assets_pending_old", table_name="media_assets")
    op.drop_column("media_assets", "duration_sec")
    op.drop_column("media_assets", "dimensions_json")
    op.drop_column("media_assets", "antivirus_verdict")
    op.drop_column("media_assets", "antivirus_scanned_at")
    op.drop_column("media_assets", "exif_stripped_at")
    op.drop_column("media_assets", "owner_id")
    op.drop_column("media_assets", "owner_kind")
