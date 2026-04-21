"""add media assets

Revision ID: 20260420_0001
Revises:
Create Date: 2026-04-20 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260420_0001"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

user_role = postgresql.ENUM(
    "customer",
    "technician",
    "admin",
    name="user_role",
    create_type=False,
)
user_status = postgresql.ENUM(
    "pending",
    "active",
    "suspended",
    name="user_status",
    create_type=False,
)


media_purpose = postgresql.ENUM(
    "case_attachment",
    "technician_certificate",
    "technician_gallery",
    "technician_promo",
    "user_avatar",
    name="media_purpose",
    create_type=False,
)
media_visibility = postgresql.ENUM(
    "public",
    "private",
    name="media_visibility",
    create_type=False,
)
media_status = postgresql.ENUM(
    "pending_upload",
    "uploaded",
    "processing",
    "ready",
    "failed",
    "deleted",
    name="media_status",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    user_role.create(bind, checkfirst=True)
    user_status.create(bind, checkfirst=True)
    media_purpose.create(bind, checkfirst=True)
    media_visibility.create(bind, checkfirst=True)
    media_status.create(bind, checkfirst=True)

    if not inspector.has_table("users"):
        op.create_table(
            "users",
            sa.Column("phone", sa.String(length=32), nullable=True),
            sa.Column("email", sa.String(length=255), nullable=True),
            sa.Column("full_name", sa.String(length=255), nullable=True),
            sa.Column("role", user_role, nullable=False),
            sa.Column("status", user_status, nullable=False),
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
            sa.Column("id", sa.UUID(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
        op.create_index(op.f("ix_users_phone"), "users", ["phone"], unique=True)

    if not inspector.has_table("media_assets"):
        op.create_table(
            "media_assets",
            sa.Column("upload_id", sa.UUID(), nullable=False),
            sa.Column("purpose", media_purpose, nullable=False),
            sa.Column("visibility", media_visibility, nullable=False),
            sa.Column("status", media_status, nullable=False),
            sa.Column("owner_ref", sa.String(length=255), nullable=False),
            sa.Column("bucket_name", sa.String(length=255), nullable=False),
            sa.Column("object_key", sa.Text(), nullable=False),
            sa.Column("preview_object_key", sa.Text(), nullable=True),
            sa.Column("thumb_object_key", sa.Text(), nullable=True),
            sa.Column("original_filename", sa.String(length=255), nullable=False),
            sa.Column("mime_type", sa.String(length=255), nullable=False),
            sa.Column("size_bytes", sa.Integer(), nullable=False),
            sa.Column("checksum_sha256", sa.String(length=128), nullable=True),
            sa.Column("etag", sa.String(length=255), nullable=True),
            sa.Column("uploaded_by_user_id", sa.UUID(), nullable=False),
            sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=True),
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
            sa.Column("id", sa.UUID(), nullable=False),
            sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("object_key"),
            sa.UniqueConstraint("upload_id"),
        )
        op.create_index(op.f("ix_media_assets_owner_ref"), "media_assets", ["owner_ref"], unique=False)
        op.create_index(op.f("ix_media_assets_upload_id"), "media_assets", ["upload_id"], unique=False)
        op.create_index(
            op.f("ix_media_assets_uploaded_by_user_id"),
            "media_assets",
            ["uploaded_by_user_id"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("media_assets"):
        op.drop_index(op.f("ix_media_assets_uploaded_by_user_id"), table_name="media_assets")
        op.drop_index(op.f("ix_media_assets_upload_id"), table_name="media_assets")
        op.drop_index(op.f("ix_media_assets_owner_ref"), table_name="media_assets")
        op.drop_table("media_assets")

    if inspector.has_table("users"):
        op.drop_index(op.f("ix_users_phone"), table_name="users")
        op.drop_index(op.f("ix_users_email"), table_name="users")
        op.drop_table("users")

    media_status.drop(bind, checkfirst=True)
    media_visibility.drop(bind, checkfirst=True)
    media_purpose.drop(bind, checkfirst=True)
    user_status.drop(bind, checkfirst=True)
    user_role.drop(bind, checkfirst=True)
