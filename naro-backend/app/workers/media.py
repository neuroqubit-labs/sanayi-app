from __future__ import annotations

from datetime import UTC, datetime
from io import BytesIO
from uuid import UUID

from PIL import Image, ImageOps
from PIL.Image import Image as PILImage

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.integrations.storage import build_storage_gateway
from app.models.media import MediaStatus
from app.repositories.media import MediaAssetRepository

# GPS EXIF tag IDs per Exif spec (34853=GPSInfo IFD pointer)
_GPS_TAG_ID = 34853


def _resize_image(source: bytes, max_size: int) -> bytes:
    with Image.open(BytesIO(source)) as raw_image:
        image: PILImage = ImageOps.exif_transpose(raw_image) or raw_image
        if image.mode not in {"RGB", "L"}:
            image = image.convert("RGB")
        image.thumbnail((max_size, max_size))
        # Explicit GPS strip defense-in-depth (brief §3.3)
        exif = image.getexif()
        if _GPS_TAG_ID in exif:
            del exif[_GPS_TAG_ID]
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
            # Overwrite original with EXIF-stripped version (defense-in-depth;
            # brief §3.3 — GPS tag silinmiş orijinal boyutta yeniden kaydedilir)
            stripped_original = _strip_exif_in_place(original_bytes)
            if stripped_original != original_bytes:
                storage.write_bytes(
                    bucket=asset.bucket_name,
                    object_key=asset.object_key,
                    content=stripped_original,
                    content_type=asset.mime_type,
                )

            preview_bytes = _resize_image(stripped_original, 1600)
            thumb_bytes = _resize_image(stripped_original, 400)
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
            asset.exif_stripped_at = datetime.now(UTC)
            asset.status = MediaStatus.READY
            await repo.update(asset)
        except Exception:
            asset.status = MediaStatus.FAILED
            await repo.update(asset)
            raise


def _strip_exif_in_place(source: bytes) -> bytes:
    """GPS EXIF strip at original resolution; returns bytes (re-encode only if EXIF removed)."""
    with Image.open(BytesIO(source)) as raw_image:
        exif = raw_image.getexif()
        if _GPS_TAG_ID not in exif:
            return source
        del exif[_GPS_TAG_ID]
        buffer = BytesIO()
        fmt = raw_image.format or "JPEG"
        if fmt == "JPEG":
            raw_image.save(
                buffer, format=fmt, exif=exif.tobytes(), quality=95, optimize=True
            )
        else:
            raw_image.save(buffer, format=fmt, exif=exif.tobytes())
        return buffer.getvalue()
