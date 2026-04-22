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
from app.observability.metrics import (
    media_upload_complete_total,
    media_upload_intent_total,
)
from app.repositories.media import MediaAssetRepository
from app.schemas.media import (
    CompleteUploadRequest,
    MediaAssetResponse,
    UploadIntentRequest,
    UploadIntentResponse,
)
from app.services import media_policy

# FE wrapper `owner_ref` prefix → BE polymorphic owner_kind mapping.
# Faz A parity audit P2: FE tek `owner_ref` string gönderir; BE parse
# edip owner_kind + owner_id'yi otomatik doldurur. Bilinmeyen prefix
# veya draft-style composite ref (`draft:kind:vehicle:step`) → None
# (fallback policy.rule.owner_kind + owner_id=None).
_OWNER_REF_KIND_MAP: dict[str, str] = {
    "case": "service_case",
    "service_case": "service_case",
    "vehicle": "vehicle",
    "technician": "technician_profile",
    "technician_profile": "technician_profile",
    "technician_certificate": "technician_certificate",
    "insurance_claim": "insurance_claim",
    "user": "user",
    "campaign": "campaign",
}


def _parse_owner_ref(owner_ref: str) -> tuple[str, UUID] | None:
    """`kind:{uuid}` formatını parse et. Geçersizse None döner.

    Örnek:
        'vehicle:{uuid}'            → ('vehicle', UUID)
        'case:{uuid}'               → ('service_case', UUID)
        'draft:maintenance:..:step' → None (fallback policy'ye)
    """
    if ":" not in owner_ref:
        return None
    prefix, _, rest = owner_ref.partition(":")
    kind = _OWNER_REF_KIND_MAP.get(prefix)
    if kind is None:
        return None
    uuid_str = rest.partition(":")[0]
    try:
        return (kind, UUID(uuid_str))
    except ValueError:
        return None

# Purpose → allowed uploader rol(s). Faz 11: 18 purpose matrix.
TECHNICIAN_PURPOSES: frozenset[MediaPurpose] = frozenset({
    MediaPurpose.TECHNICIAN_CERTIFICATE,
    MediaPurpose.TECHNICIAN_GALLERY,
    MediaPurpose.TECHNICIAN_PROMO,
    MediaPurpose.TECHNICIAN_AVATAR,
    MediaPurpose.TECHNICIAN_GALLERY_PHOTO,
    MediaPurpose.TECHNICIAN_GALLERY_VIDEO,
    MediaPurpose.TECHNICIAN_PROMO_VIDEO,
})
CASE_PURPOSES: frozenset[MediaPurpose] = frozenset({
    MediaPurpose.CASE_ATTACHMENT,
    MediaPurpose.CASE_DAMAGE_PHOTO,
    MediaPurpose.CASE_EVIDENCE_PHOTO,
    MediaPurpose.CASE_EVIDENCE_VIDEO,
    MediaPurpose.CASE_EVIDENCE_AUDIO,
    MediaPurpose.ACCIDENT_PROOF,
    MediaPurpose.TOW_ARRIVAL_PHOTO,
    MediaPurpose.TOW_LOADING_PHOTO,
    MediaPurpose.TOW_DELIVERY_PHOTO,
})
VEHICLE_PURPOSES: frozenset[MediaPurpose] = frozenset({
    MediaPurpose.VEHICLE_LICENSE_PHOTO,
    MediaPurpose.VEHICLE_PHOTO,
})
ADMIN_ONLY_PURPOSES: frozenset[MediaPurpose] = frozenset({
    MediaPurpose.CAMPAIGN_ASSET,
})


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
        # Faz 11 — canonical policy enforcement (mime + size + dim + duration)
        dim_tuple = None
        if payload.dimensions:
            w = int(payload.dimensions.get("width", 0))
            h = int(payload.dimensions.get("height", 0))
            if w and h:
                dim_tuple = (w, h)
        try:
            rule = media_policy.enforce(
                payload.purpose,
                mime=payload.mime_type,
                size_bytes=payload.size_bytes,
                dimensions=dim_tuple,
                duration_sec=payload.duration_sec,
            )
        except media_policy.PolicyViolationError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            ) from exc
        except media_policy.UnknownPurposeError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc
        bucket_name = self._bucket_for_purpose(payload.purpose)
        self._storage.ensure_bucket_exists(bucket=bucket_name)

        # Faz A parity: owner_kind + owner_id'yi önce explicit payload,
        # sonra owner_ref parse, son olarak policy rule fallback ile doldur
        derived_kind: str
        derived_id: UUID | None
        if payload.owner_kind is not None:
            derived_kind = payload.owner_kind.value
            derived_id = payload.owner_id
        else:
            parsed = _parse_owner_ref(payload.owner_ref)
            if parsed is not None:
                derived_kind, parsed_id = parsed
                derived_id = payload.owner_id or parsed_id
            else:
                derived_kind = rule.owner_kind
                derived_id = payload.owner_id

        asset = MediaAsset(
            purpose=payload.purpose,
            visibility=rule.visibility,
            status=MediaStatus.PENDING_UPLOAD,
            owner_ref=payload.owner_ref,
            owner_kind=derived_kind,
            owner_id=derived_id,
            bucket_name=bucket_name,
            object_key=f"pending/{uuid4()}",
            original_filename=payload.filename,
            mime_type=payload.mime_type,
            size_bytes=payload.size_bytes,
            checksum_sha256=payload.checksum_sha256,
            dimensions_json=payload.dimensions,
            duration_sec=payload.duration_sec,
            uploaded_by_user_id=user.id,
        )
        asset = await self._repo.create(asset)
        media_upload_intent_total.labels(purpose=payload.purpose.value).inc()

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

        if (
            payload.checksum_sha256
            and asset.checksum_sha256
            and payload.checksum_sha256 != asset.checksum_sha256
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="checksum mismatch",
            )

        asset.uploaded_at = datetime.now(UTC)
        asset.etag = payload.etag or self._normalize_etag(head.get("ETag"))
        is_image = asset.mime_type.startswith("image/")
        if is_image:
            enqueued = await self._enqueue_processing_job(str(asset.id))
            asset.status = MediaStatus.PROCESSING if enqueued else MediaStatus.READY
        else:
            asset.status = MediaStatus.READY
        asset = await self._repo.update(asset)
        media_upload_complete_total.labels(
            purpose=asset.purpose.value, status=asset.status.value
        ).inc()
        # Faz 11 — antivirus_required purposes → enqueue scan
        rule = media_policy.get(asset.purpose)
        if rule.antivirus_required:
            await self._enqueue_antivirus_scan(str(asset.id))
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
                "dimensions": asset.dimensions_json,
                "duration_sec": asset.duration_sec,
                "exif_stripped_at": asset.exif_stripped_at,
                "antivirus_verdict": asset.antivirus_verdict,
                "created_at": asset.created_at,
                "uploaded_at": asset.uploaded_at,
            }
        )

    def _assert_upload_allowed(self, *, user: User, payload: UploadIntentRequest) -> None:
        if user.role == UserRole.ADMIN:
            return

        if payload.purpose in ADMIN_ONLY_PURPOSES:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not allowed")

        if payload.purpose in CASE_PURPOSES:
            if user.role not in {UserRole.CUSTOMER, UserRole.TECHNICIAN}:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not allowed")
            return

        if payload.purpose in TECHNICIAN_PURPOSES:
            if user.role != UserRole.TECHNICIAN:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not allowed")
            return

        if payload.purpose in VEHICLE_PURPOSES:
            # Customer + technician ikisi de yükler (assigned technician'ın aracı değil müşterinin
            # aracına fotoğraf yükleyebilmesi bir use-case).
            if user.role not in {UserRole.CUSTOMER, UserRole.TECHNICIAN}:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="not allowed")
            return

        if payload.purpose in {MediaPurpose.USER_AVATAR, MediaPurpose.INSURANCE_DOC}:
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
        """Delegate to canonical policy matrix."""
        return media_policy.get(purpose).visibility

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
        """policy.visibility → prefix; policy.owner_kind → path scope."""
        extension = self._guess_extension(filename)
        clean_owner_ref = self._sanitize_path_segment(owner_ref)
        rule = media_policy.get(purpose)
        prefix = "public" if rule.visibility == MediaVisibility.PUBLIC else "private"
        scope = rule.owner_kind  # e.g. 'service_case', 'technician_profile'
        return (
            f"{prefix}/{scope}/{clean_owner_ref}/{purpose.value}/"
            f"{asset_id}/original.{extension}"
        )

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
        return await self._enqueue_arq_job("process_media_asset", asset_id)

    async def _enqueue_antivirus_scan(self, asset_id: str) -> bool:
        return await self._enqueue_arq_job("media_antivirus_scan", asset_id)

    async def _enqueue_arq_job(self, job_name: str, *args: object) -> bool:
        pool = None
        try:
            pool = await create_pool(
                RedisSettings(
                    host=self._settings.redis_host,
                    port=self._settings.redis_port,
                )
            )
            await pool.enqueue_job(job_name, *args)
            return True
        except Exception:
            return False
        finally:
            if pool is not None:
                await pool.aclose()
