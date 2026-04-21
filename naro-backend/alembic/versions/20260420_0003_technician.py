"""technician: profile + capability + specialty + certificate + gallery

Revision ID: 20260420_0003
Revises: 20260420_0002
Create Date: 2026-04-20 15:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260420_0003"
down_revision: str | None = "20260420_0002"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


provider_type = postgresql.ENUM(
    "usta",
    "cekici",
    "oto_aksesuar",
    "kaporta_boya",
    "lastik",
    "oto_elektrik",
    name="provider_type",
    create_type=False,
)
technician_verified_level = postgresql.ENUM(
    "basic",
    "verified",
    "premium",
    name="technician_verified_level",
    create_type=False,
)
technician_availability = postgresql.ENUM(
    "available",
    "busy",
    "offline",
    name="technician_availability",
    create_type=False,
)
technician_certificate_kind = postgresql.ENUM(
    "identity",
    "tax_registration",
    "trade_registry",
    "insurance",
    "technical",
    "vehicle_license",
    name="technician_certificate_kind",
    create_type=False,
)
technician_certificate_status = postgresql.ENUM(
    "pending",
    "approved",
    "rejected",
    "expired",
    name="technician_certificate_status",
    create_type=False,
)
gallery_item_kind = postgresql.ENUM(
    "photo",
    "video",
    name="gallery_item_kind",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # pg_trgm for specialty/label substring search
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    provider_type.create(bind, checkfirst=True)
    technician_verified_level.create(bind, checkfirst=True)
    technician_availability.create(bind, checkfirst=True)
    technician_certificate_kind.create(bind, checkfirst=True)
    technician_certificate_status.create(bind, checkfirst=True)
    gallery_item_kind.create(bind, checkfirst=True)

    # ── technician_profiles ──
    if not inspector.has_table("technician_profiles"):
        op.create_table(
            "technician_profiles",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("user_id", sa.UUID(), nullable=False),
            sa.Column("display_name", sa.String(length=255), nullable=False),
            sa.Column("tagline", sa.String(length=255), nullable=True),
            sa.Column("biography", sa.Text(), nullable=True),
            sa.Column(
                "availability",
                technician_availability,
                nullable=False,
                server_default="offline",
            ),
            sa.Column(
                "verified_level",
                technician_verified_level,
                nullable=False,
                server_default="basic",
            ),
            sa.Column("provider_type", provider_type, nullable=False),
            sa.Column(
                "secondary_provider_types",
                postgresql.ARRAY(provider_type),
                nullable=False,
                server_default="{}",
            ),
            sa.Column("working_hours", sa.String(length=255), nullable=True),
            sa.Column("area_label", sa.String(length=255), nullable=True),
            sa.Column(
                "business_info",
                postgresql.JSONB(),
                nullable=False,
                server_default=sa.text("'{}'::jsonb"),
            ),
            sa.Column("avatar_asset_id", sa.UUID(), nullable=True),
            sa.Column("promo_video_asset_id", sa.UUID(), nullable=True),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(
                ["avatar_asset_id"], ["media_assets.id"], ondelete="SET NULL"
            ),
            sa.ForeignKeyConstraint(
                ["promo_video_asset_id"], ["media_assets.id"], ondelete="SET NULL"
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", name="uq_technician_profiles_user_id"),
        )
        op.create_index(
            "ix_tech_profiles_pool",
            "technician_profiles",
            ["provider_type", "availability"],
            unique=False,
            postgresql_where=sa.text(
                "deleted_at IS NULL AND availability = 'available'"
            ),
        )
        op.create_index(
            "ix_tech_profiles_secondary_gin",
            "technician_profiles",
            ["secondary_provider_types"],
            unique=False,
            postgresql_using="gin",
        )

    # ── technician_capabilities ──
    if not inspector.has_table("technician_capabilities"):
        op.create_table(
            "technician_capabilities",
            sa.Column("profile_id", sa.UUID(), nullable=False),
            sa.Column(
                "insurance_case_handler",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
            sa.Column(
                "on_site_repair",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
            sa.Column(
                "valet_service",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
            sa.Column(
                "towing_coordination",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(
                ["profile_id"], ["technician_profiles.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("profile_id"),
        )

    # ── technician_specialties ──
    if not inspector.has_table("technician_specialties"):
        op.create_table(
            "technician_specialties",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("profile_id", sa.UUID(), nullable=False),
            sa.Column("kind", sa.String(length=16), nullable=False),
            sa.Column("label", sa.String(length=120), nullable=False),
            sa.Column("label_normalized", sa.String(length=120), nullable=False),
            sa.Column(
                "display_order",
                sa.SmallInteger(),
                nullable=False,
                server_default="0",
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.CheckConstraint(
                "kind IN ('specialty','expertise')",
                name="ck_tech_specialties_kind",
            ),
            sa.ForeignKeyConstraint(
                ["profile_id"], ["technician_profiles.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "profile_id",
                "kind",
                "label_normalized",
                name="uq_tech_specialties_profile_kind_label",
            ),
        )
        op.create_index(
            "ix_tech_specialties_search",
            "technician_specialties",
            ["label_normalized"],
            unique=False,
            postgresql_using="gin",
            postgresql_ops={"label_normalized": "gin_trgm_ops"},
        )

    # ── technician_certificates ──
    if not inspector.has_table("technician_certificates"):
        op.create_table(
            "technician_certificates",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("profile_id", sa.UUID(), nullable=False),
            sa.Column("kind", technician_certificate_kind, nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("file_url", sa.Text(), nullable=True),
            sa.Column("mime_type", sa.String(length=128), nullable=True),
            sa.Column("media_asset_id", sa.UUID(), nullable=True),
            sa.Column(
                "uploaded_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "status",
                technician_certificate_status,
                nullable=False,
                server_default="pending",
            ),
            sa.Column("reviewer_note", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(
                ["profile_id"], ["technician_profiles.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(
                ["media_asset_id"], ["media_assets.id"], ondelete="SET NULL"
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_tech_certificates_profile_status",
            "technician_certificates",
            ["profile_id", "status"],
            unique=False,
        )
        op.create_index(
            "ix_tech_certificates_expiring",
            "technician_certificates",
            ["expires_at"],
            unique=False,
            postgresql_where=sa.text(
                "status = 'approved' AND expires_at IS NOT NULL"
            ),
        )

    # ── technician_gallery_items ──
    if not inspector.has_table("technician_gallery_items"):
        op.create_table(
            "technician_gallery_items",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("profile_id", sa.UUID(), nullable=False),
            sa.Column("kind", gallery_item_kind, nullable=False),
            sa.Column("title", sa.String(length=255), nullable=True),
            sa.Column("caption", sa.String(length=255), nullable=True),
            sa.Column("media_asset_id", sa.UUID(), nullable=False),
            sa.Column(
                "display_order",
                sa.SmallInteger(),
                nullable=False,
                server_default="0",
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(
                ["profile_id"], ["technician_profiles.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(
                ["media_asset_id"], ["media_assets.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_tech_gallery_order",
            "technician_gallery_items",
            ["profile_id", "display_order"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("technician_gallery_items"):
        op.drop_index(
            "ix_tech_gallery_order", table_name="technician_gallery_items"
        )
        op.drop_table("technician_gallery_items")

    if inspector.has_table("technician_certificates"):
        op.drop_index(
            "ix_tech_certificates_expiring", table_name="technician_certificates"
        )
        op.drop_index(
            "ix_tech_certificates_profile_status",
            table_name="technician_certificates",
        )
        op.drop_table("technician_certificates")

    if inspector.has_table("technician_specialties"):
        op.drop_index(
            "ix_tech_specialties_search", table_name="technician_specialties"
        )
        op.drop_table("technician_specialties")

    if inspector.has_table("technician_capabilities"):
        op.drop_table("technician_capabilities")

    if inspector.has_table("technician_profiles"):
        op.drop_index(
            "ix_tech_profiles_secondary_gin", table_name="technician_profiles"
        )
        op.drop_index("ix_tech_profiles_pool", table_name="technician_profiles")
        op.drop_table("technician_profiles")

    gallery_item_kind.drop(bind, checkfirst=True)
    technician_certificate_status.drop(bind, checkfirst=True)
    technician_certificate_kind.drop(bind, checkfirst=True)
    technician_availability.drop(bind, checkfirst=True)
    technician_verified_level.drop(bind, checkfirst=True)
    provider_type.drop(bind, checkfirst=True)
