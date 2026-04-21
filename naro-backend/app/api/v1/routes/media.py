from uuid import UUID

from fastapi import APIRouter

from app.api.v1.deps import CurrentUserDep, DbDep, SettingsDep
from app.integrations.storage import build_storage_gateway
from app.schemas.media import (
    CompleteUploadRequest,
    MediaAssetEnvelope,
    UploadIntentRequest,
    UploadIntentResponse,
)
from app.services.media import MediaService

router = APIRouter(prefix="/media", tags=["media"])


def create_media_service(db: DbDep, settings: SettingsDep) -> MediaService:
    return MediaService(db=db, settings=settings, storage=build_storage_gateway(settings))


@router.post("/uploads/intents", response_model=UploadIntentResponse)
async def create_upload_intent(
    payload: UploadIntentRequest,
    db: DbDep,
    settings: SettingsDep,
    user: CurrentUserDep,
) -> UploadIntentResponse:
    service = create_media_service(db, settings)
    response = await service.create_upload_intent(user=user, payload=payload)
    await db.commit()
    return response


@router.post("/uploads/{upload_id}/complete", response_model=MediaAssetEnvelope)
async def complete_upload(
    upload_id: UUID,
    payload: CompleteUploadRequest,
    db: DbDep,
    settings: SettingsDep,
    user: CurrentUserDep,
) -> MediaAssetEnvelope:
    service = create_media_service(db, settings)
    asset = await service.complete_upload(user=user, upload_id=upload_id, payload=payload)
    await db.commit()
    return MediaAssetEnvelope(asset=asset)


@router.get("/assets/{asset_id}", response_model=MediaAssetEnvelope)
async def get_asset(
    asset_id: UUID,
    db: DbDep,
    settings: SettingsDep,
    user: CurrentUserDep,
) -> MediaAssetEnvelope:
    service = create_media_service(db, settings)
    asset = await service.get_asset(user=user, asset_id=asset_id)
    return MediaAssetEnvelope(asset=asset)


@router.delete("/assets/{asset_id}", response_model=MediaAssetEnvelope)
async def delete_asset(
    asset_id: UUID,
    db: DbDep,
    settings: SettingsDep,
    user: CurrentUserDep,
) -> MediaAssetEnvelope:
    service = create_media_service(db, settings)
    asset = await service.delete_asset(user=user, asset_id=asset_id)
    await db.commit()
    return MediaAssetEnvelope(asset=asset)
