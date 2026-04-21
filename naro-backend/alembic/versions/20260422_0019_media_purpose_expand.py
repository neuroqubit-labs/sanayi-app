"""media_purpose_expand: +13 purpose + MediaStatus 'quarantined'

Revision ID: 20260422_0019
Revises: 20260422_0018
Create Date: 2026-04-22 18:30:00.000000

Faz 11 — Media upgrade (canonical 18 purpose taksonomi).

- `media_purpose` ADD VALUE ×13: vehicle_license_photo, vehicle_photo,
  case_damage_photo, case_evidence_photo, case_evidence_video,
  case_evidence_audio, accident_proof, insurance_doc, technician_avatar,
  technician_gallery_photo, technician_gallery_video, technician_promo_video,
  tow_arrival_photo, tow_loading_photo, tow_delivery_photo, campaign_asset
  (16 yeni; mevcut 5 legacy koruyoruz)
- `media_status` ADD VALUE 'quarantined' (antivirus infected)

PG ENUM ADD VALUE transactional DEĞİL; migration op.execute AUTOCOMMIT ile işler.
Downgrade: ENUM DROP VALUE yok PG'de → no-op; fresh DB'de yeni enum oluşturulur.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260422_0019"
down_revision: str | None = "20260422_0018"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


NEW_PURPOSES: tuple[str, ...] = (
    "vehicle_license_photo",
    "vehicle_photo",
    "case_damage_photo",
    "case_evidence_photo",
    "case_evidence_video",
    "case_evidence_audio",
    "accident_proof",
    "insurance_doc",
    "technician_avatar",
    "technician_gallery_photo",
    "technician_gallery_video",
    "technician_promo_video",
    "tow_arrival_photo",
    "tow_loading_photo",
    "tow_delivery_photo",
    "campaign_asset",
)


def upgrade() -> None:
    connection = op.get_bind()
    # ENUM ADD VALUE requires AUTOCOMMIT (cannot run inside transaction block)
    connection.execute(__import__("sqlalchemy").text("COMMIT"))
    for value in NEW_PURPOSES:
        connection.execute(
            __import__("sqlalchemy").text(
                f"ALTER TYPE media_purpose ADD VALUE IF NOT EXISTS '{value}'"
            )
        )
    connection.execute(
        __import__("sqlalchemy").text(
            "ALTER TYPE media_status ADD VALUE IF NOT EXISTS 'quarantined'"
        )
    )


def downgrade() -> None:
    # PostgreSQL ENUM DROP VALUE desteklemez; no-op.
    # Fresh DB restore için yeni enum tip + tablo recreation gerekir.
    pass
