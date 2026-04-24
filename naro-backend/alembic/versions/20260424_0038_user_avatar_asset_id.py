"""users.avatar_asset_id column (FK to media_assets)

Revision ID: 20260424_0038
Revises: 20260424_0037
Create Date: 2026-04-24 17:00:00.000000

Plan: register/login schema alignment §F — customer user için avatar alanı.
(docs/audits/2026-04-24-register-login-schema-alignment.md)

UI şu an avatar picker göstermiyor; kolon eklenir ama yazılmaz. S3/MinIO
transfer pipeline'ı tamamlandıktan sonra profil ekranına avatar picker
(purpose=user_avatar) bağlanır; bu kolon doğrudan kullanılır.

FK ondelete=SET NULL: asset silinirse user kaydı bozulmasın.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op


revision: str = "20260424_0038"
down_revision: str | None = "20260424_0037"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {col["name"] for col in inspector.get_columns("users")}

    if "avatar_asset_id" not in existing_cols:
        op.add_column(
            "users",
            sa.Column("avatar_asset_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        )
        op.create_foreign_key(
            "fk_users_avatar_asset_id_media_assets",
            "users",
            "media_assets",
            ["avatar_asset_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {col["name"] for col in inspector.get_columns("users")}
    existing_fks = {fk["name"] for fk in inspector.get_foreign_keys("users")}

    if "fk_users_avatar_asset_id_media_assets" in existing_fks:
        op.drop_constraint(
            "fk_users_avatar_asset_id_media_assets", "users", type_="foreignkey"
        )
    if "avatar_asset_id" in existing_cols:
        op.drop_column("users", "avatar_asset_id")
