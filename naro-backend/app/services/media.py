from __future__ import annotations

import mimetypes
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.integrations.storage import S3StorageGateway
from app.models.media import MediaAsset, MediaPurpose, MediaStatus, MediaVisibility
from app.models.user import User, UserRole
from app.repositories.media import MediaAssetRepository
from app.schemas.media import (
    CompleteUploadRequest,
    MediaAssetResponse,
    UploadIntentRequest,
    UploadIntentResponse,
)

ALLOWED_IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
}
ALLOWED_DOCUMENT_MIME_TYPES = {"application/pdf"}
ALLOWED_AUDIO_MIME_TYPES = {"audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav"}
ALLOWED_VIDEO_MIME_TYPES = {"video/mp4", "video/quicktime"}

MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024
MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024
MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024
MAX_VIDEO_SIZE_BYTES = 150 * 1024 * 1024

TECHNICIAN_PURPOSES = {
    MediaPurpose.TECHNICIAN_CERTIFICATE,
    MediaPurpose.TECHNICIAN_GALLERY,
    MediaPurpose.TECHNICIAN_PROMO,
}


class MediaService:
    def __init__(
        self,
        *,
        db: AsyncSession,
        settings: Settings,
        storage: S3StorageGateway,
    ) -> None:
        self._db = db
        self._settings = settings
        self._storage = storage
        self._repo = MediaAssetRepository(db)

    async def create_upload_intent(
        self,
        *,
        user: User,
        payload: UploadIntentRequest,
    ) -> UploadIntentResponse:
        self._assert_upload_allowed(user=user, payload=payload)
        self._validate_mime_and_size(payload.mime_type, payload.size_bytes)
        bucket_name = self._bucket_for_purpose(payload.purpose)
        self._storage.ensure_bucket_exists(bucket=bucket_name)

        asset = MediaAsset(
            purpose=payload.purpose,
            visibility=self._visibility_for_purpose(payload.purpose),
            status=MediaStatus.PENDING_UPLOAD,
            owner_ref=payload.owner_ref,
            bucket_name=bucket_name,
            object_key=f"pending/{uuid4()}",
            original_filename=payload.filename,
            mime_type=payload.mime_type,
            size_bytes=payload.size_bytes,
            checksum_sha256=payload.checksum_sha256,
            uploaded_by_user_id=user.id,
        )
        asset = await self._repo.create(asset)

        object_key = self._build_object_key(
            purpose=payload.purpose,
            owner_ref=payload.owner_ref,
            asset_id=str(asset.id),
            filename=payload.filename,
        )
        asset.object_key = object_key
        asset = await self._repo.update(asset)

        expires_at = datetime.now(UTC) + timedelta(
            seconds=self._settings.media_upload_url_ttl_seconds
        )
        upload_url = self._storage.create_presigned_upload(
            bucket=asset.bucket_name,
            object_key=asset.object_key,
            content_type=payload.mime_type,
            expires_in=self._settings.media_upload_url_ttl_seconds,
        )

        return UploadIntentResponse(
            upload_id=str(asset.upload_id),
            asset_id=str(asset.id),
            object_key=asset.object_key,
            upload_method="single_put",
            upload_url=upload_url,
            upload_headers={"Content-Type": payload.mime_type},
            expires_at=expires_at,
        )

    async def complete_upload(
        self,
        *,
        user: User,
        upload_id: UUID,
        payload: CompleteUploadRequest,
    ) -> MediaAssetResponse:
        asset = await self._repo.get_by_upload_id(upload_id)
        if asset is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="upload not found")

        self._assert_asset_access(user=user, asset=asset)
        if asset.status != MediaStatus.PENDING_UPLOAD:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="upload already completed",
            )

        try:
            head = self._storage.head_object(bucket=asset.bucket_name, object_key=asset.object_key)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="uploaded object not found",
            ) from exc

        content_length = int(head.get("ContentLength", 0))
        if content_length <= 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="uploaded object is empty",
            )

        if payload.checksum_sha256 and asset.checksum_sha256:
            if payload.checksum_sha256 != asset.checksum_sha256:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="checksum mismatch",
                )

        asset.uploaded_at = datetime.now(UTC)
        asset.etag = payload.etag or self._normalize_etag(head.get("ETag"))
        if asset.mime_type in ALLOWED_IMAGE_MIME_TYPES:
            enqueued = await self._enqueue_processing_job(str(asset.id))
            asset.status = MediaStatus.PROCESSING if enqueued else MediaStatus.READY
        else:
            asset.status = MediaStatus.READY
        asset = await self._repo.update(asset)
        return self._serialize_asset(asset)

    async def get_asset(self, *, user: User, asset_id: UUID) -> MediaAssetResponse:
        asset = await self._repo.get_by_id(asset_id)
        if asset is None or asset.status == MediaStatus.DELETED:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="asset not found")

        self._assert_asset_access(user=user, asset=asset)
        return self._serialize_asset(asset)

    async def delete_asset(self, *, user: User, asset_id: UUID) -> MediaAssetResponse:
        asset = await self._repo.get_by_id(asset_id)
        if asset is None or asset.status == MediaStatus.DELETED:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="asset not found")

        self._assert_asset_access(user=user, asset=asset)
        self._storage.delete_object(bucket=asset.bucket_name, object_key=asset.object_key)
        if asset.preview_object_key:
            self._storage.delete_object(
                bucket=asset.bucket_name,
                object_key=asset.preview_object_key,
            )
        if asset.thumb_object_key:
            self._storage.delete_object(
                bucket=asset.bucket_name,
                object_key=asset.thumb_object_key,
            )
        asset = await self._repo.mark_deleted(asset)
        return self._serialize_asset(asset)

    def _serialize_asset(self, asset: MediaAsset) -> MediaAssetResponse:
        preview_key = asset.preview_object_key or asset.object_key
        if asset.visibility == MediaVisibility.PUBLIC:
            download_url = self._public_url(asset.object_key)
            preview_url = self._public_url(preview_key)
        else:
            download_url = self._storage.create_presigned_download(
                bucket=asset.bucket_name,
                object_key=asset.object_key,
                expires_in=self._settings.media_download_url_ttl_seconds,
            )
            preview_url = self._storage.create_presigned_download(
                bucket=asset.bucket_name,
                object_key=preview_key,
                expires_in=self._settings.media_download_url_ttl_seconds,
            )

        return MediaAssetResponse.model_validate(
            {
                "id": str(asset.id),
                "purpose": asset.purpose,
                "visibility": asset.visibility,
                "status": asset.status,
                "mime_type": asset.mime_type,
                "size_bytes": asset.size_bytes,
                "checksum_sha256": asset.checksum_sha256,
                "preview_url": preview_url,
                "download_url": download_url,
                "created_at": asset.created_at,
                "uploaded_at": asset.uploaded_at,
            }
        )

    def _assert_upload_allowed(self, *, user: User, payload: UploadIntentRequest) -> None:
        if user.role == UserRole.ADMIN:
            return

        if payload.purpose == MediaPurpose.CASE_ATTACHMENT:
            if user.role not in {UserRole.CUSTOMER, UserRole.TECHNICIAN}:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not allowed")
            return

        if payload.purpose in TECHNICIAN_PURPOSES:
            if user.role != UserRole.TECHNICIAN:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not allowed")
            return

        if payload.purpose == MediaPurpose.USER_AVATAR:
            return

        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not allowed")

    def _assert_asset_access(self, *, user: User, asset: MediaAsset) -> None:
        if user.role == UserRole.ADMIN or asset.uploaded_by_user_id == user.id:
            return

        if asset.purpose == MediaPurpose.CASE_ATTACHMENT and user.role in {
            UserRole.CUSTOMER,
            UserRole.TECHNICIAN,
        }:
            return

        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not allowed")

    def _visibility_for_purpose(self, purpose: MediaPurpose) -> MediaVisibility:
        if purpose in {
            MediaPurpose.TECHNICIAN_GALLERY,
            MediaPurpose.TECHNICIAN_PROMO,
            MediaPurpose.USER_AVATAR,
        }:
            return MediaVisibility.PUBLIC
        return MediaVisibility.PRIVATE

    def _bucket_for_purpose(self, purpose: MediaPurpose) -> str:
        visibility = self._visibility_for_purpose(purpose)
        return (
            self._settings.s3_public_bucket
            if visibility == MediaVisibility.PUBLIC
            else self._settings.s3_private_bucket
        )

    def _build_object_key(
        self,
        *,
        purpose: MediaPurpose,
        owner_ref: str,
        asset_id: str,
        filename: str,
    ) -> str:
        extension = self._guess_extension(filename)
        clean_owner_ref = self._sanitize_path_segment(owner_ref)
        if purpose == MediaPurpose.CASE_ATTACHMENT:
            return f"private/cases/{clean_owner_ref}/{asset_id}/original.{extension}"
        if purpose == MediaPurpose.TECHNICIAN_CERTIFICATE:
            return (
                f"private/technicians/{clean_owner_ref}/certificates/"
                f"{asset_id}/original.{extension}"
            )
        if purpose == MediaPurpose.TECHNICIAN_GALLERY:
            return f"public/technicians/{clean_owner_ref}/gallery/{asset_id}/original.{extension}"
        if purpose == MediaPurpose.TECHNICIAN_PROMO:
            return f"public/technicians/{clean_owner_ref}/promo/{asset_id}/original.{extension}"
        return f"public/users/{clean_owner_ref}/avatar/{asset_id}/original.{extension}"

    def _guess_extension(self, filename: str) -> str:
        suffix = Path(filename).suffix.strip(".").lower()
        if suffix:
            return suffix

        guessed = mimetypes.guess_extension(filename)
        if guessed:
            return guessed.strip(".")
        return "bin"

    def _sanitize_path_segment(self, value: str) -> str:
        normalized = re.sub(r"[^a-zA-Z0-9._-]+", "-", value).strip("-")
        return normalized or "unknown"

    def _validate_mime_and_size(self, mime_type: str, size_bytes: int) -> None:
        if mime_type in ALLOWED_IMAGE_MIME_TYPES and size_bytes <= MAX_IMAGE_SIZE_BYTES:
            return
        if mime_type in ALLOWED_DOCUMENT_MIME_TYPES and size_bytes <= MAX_DOCUMENT_SIZE_BYTES:
            return
        if mime_type in ALLOWED_AUDIO_MIME_TYPES and size_bytes <= MAX_AUDIO_SIZE_BYTES:
            return
        if mime_type in ALLOWED_VIDEO_MIME_TYPES and size_bytes <= MAX_VIDEO_SIZE_BYTES:
            return

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="unsupported media type or file too large",
        )

    def _normalize_etag(self, etag: object) -> str | None:
        if not isinstance(etag, str):
            return None
        return etag.strip('"')

    def _public_url(self, object_key: str) -> str:
        base_url = self._settings.cloudfront_public_base_url.rstrip("/")
        if base_url:
            return f"{base_url}/{object_key}"
        endpoint = self._settings.aws_s3_endpoint_url.rstrip("/")
        if endpoint:
            return f"{endpoint}/{self._settings.s3_public_bucket}/{object_key}"
        return f"https://{self._settings.s3_public_bucket}.s3.amazonaws.com/{object_key}"

    async def _enqueue_processing_job(self, asset_id: str) -> bool:
        pool = None
        try:
            pool = await create_pool(
                RedisSettings(
                    host=self._settings.redis_host,
                    port=self._settings.redis_port,
                )
            )
            await pool.enqueue_job("process_media_asset", asset_id)
            return True
        except Exception:
            return False
        finally:
            if pool is not None:
                await pool.aclose()
