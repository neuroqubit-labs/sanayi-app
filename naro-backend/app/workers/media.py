from __future__ import annotations

from io import BytesIO
from uuid import UUID

from PIL import Image, ImageOps

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.integrations.storage import build_storage_gateway
from app.models.media import MediaStatus
from app.repositories.media import MediaAssetRepository


def _resize_image(source: bytes, max_size: int) -> bytes:
    with Image.open(BytesIO(source)) as image:
        image = ImageOps.exif_transpose(image)
        if image.mode not in {"RGB", "L"}:
            image = image.convert("RGB")
        image.thumbnail((max_size, max_size))
        buffer = BytesIO()
        image.save(buffer, format="JPEG", quality=85, optimize=True)
        return buffer.getvalue()


def _replace_variant_key(object_key: str, variant: str) -> str:
    prefix, extension = object_key.rsplit(".", 1)
    if prefix.endswith("/original"):
        prefix = prefix[: -len("/original")]
    return f"{prefix}/{variant}.{extension}"


async def process_media_asset(_: dict[str, object], asset_id: str) -> None:
    settings = get_settings()
    storage = build_storage_gateway(settings)

    async with AsyncSessionLocal() as db:
        repo = MediaAssetRepository(db)
        asset = await repo.get_by_id(UUID(asset_id))
        if asset is None or not asset.mime_type.startswith("image/"):
            return

        try:
            asset.status = MediaStatus.PROCESSING
            await repo.update(asset)

            original_bytes = storage.read_bytes(
                bucket=asset.bucket_name,
                object_key=asset.object_key,
            )
            preview_bytes = _resize_image(original_bytes, 1600)
            thumb_bytes = _resize_image(original_bytes, 400)
            preview_key = _replace_variant_key(asset.object_key, "preview")
            thumb_key = _replace_variant_key(asset.object_key, "thumb")

            storage.write_bytes(
                bucket=asset.bucket_name,
                object_key=preview_key,
                content=preview_bytes,
                content_type="image/jpeg",
            )
            storage.write_bytes(
                bucket=asset.bucket_name,
                object_key=thumb_key,
                content=thumb_bytes,
                content_type="image/jpeg",
            )

            asset.preview_object_key = preview_key
            asset.thumb_object_key = thumb_key
            asset.status = MediaStatus.READY
            await repo.update(asset)
        except Exception:
            asset.status = MediaStatus.FAILED
            await repo.update(asset)
            raise
