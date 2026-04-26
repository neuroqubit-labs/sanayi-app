from __future__ import annotations

import asyncio
from io import BytesIO
from uuid import UUID, uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image

from app.core.security import create_token
from app.db.session import AsyncSessionLocal
from app.main import app
from app.models.media import MediaStatus
from app.models.user import UserRole
from app.repositories.media import MediaAssetRepository
from app.repositories.user import UserRepository
from app.workers.media import process_media_asset


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _create_access_token(role: UserRole = UserRole.CUSTOMER) -> str:
    async with AsyncSessionLocal() as db:
        user = await UserRepository(db).create(
            role=role,
            email=f"media-smoke-{uuid4()}@example.com",
        )
        await db.commit()
    return create_token(str(user.id), "access", {"role": user.role.value})


def _build_png_bytes() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (48, 48), "#1398e7").save(buffer, format="PNG")
    return buffer.getvalue()


async def _upload_via_presigned_url(
    *,
    upload_url: str,
    headers: dict[str, str],
    content: bytes,
) -> str | None:
    async with AsyncClient() as client:
        response = await client.put(upload_url, headers=headers, content=content)
    assert response.is_success, response.text
    return response.headers.get("etag")


@pytest.mark.asyncio
async def test_media_case_attachment_smoke() -> None:
    token = await _create_access_token()
    content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers=_auth_headers(token),
    ) as client:
        intent_response = await client.post(
            "/api/v1/media/uploads/intents",
            json={
                "purpose": "case_attachment",
                "owner_ref": "case:smoke",
                "filename": "smoke.pdf",
                "mime_type": "application/pdf",
                "size_bytes": len(content),
            },
        )
        assert intent_response.status_code == 200
        intent = intent_response.json()

        etag = await _upload_via_presigned_url(
            upload_url=intent["upload_url"],
            headers=intent["upload_headers"],
            content=content,
        )

        complete_response = await client.post(
            f"/api/v1/media/uploads/{intent['upload_id']}/complete",
            json={"etag": etag},
        )
        assert complete_response.status_code == 200
        asset = complete_response.json()["asset"]
        assert asset["id"] == intent["asset_id"]
        assert asset["visibility"] == "private"
        assert asset["download_url"]

        get_response = await client.get(f"/api/v1/media/assets/{asset['id']}")
        assert get_response.status_code == 200
        assert get_response.json()["asset"]["download_url"]

        delete_response = await client.delete(f"/api/v1/media/assets/{asset['id']}")
        assert delete_response.status_code == 200
        assert delete_response.json()["asset"]["status"] == "deleted"

        missing_response = await client.get(f"/api/v1/media/assets/{asset['id']}")
        assert missing_response.status_code == 404


@pytest.mark.asyncio
async def test_media_worker_generates_preview_variants() -> None:
    token = await _create_access_token()
    content = _build_png_bytes()

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers=_auth_headers(token),
    ) as client:
        intent_response = await client.post(
            "/api/v1/media/uploads/intents",
            json={
                "purpose": "case_attachment",
                "owner_ref": "case:worker-smoke",
                "filename": "worker-smoke.png",
                "mime_type": "image/png",
                "size_bytes": len(content),
            },
        )
        assert intent_response.status_code == 200
        intent = intent_response.json()

        etag = await _upload_via_presigned_url(
            upload_url=intent["upload_url"],
            headers=intent["upload_headers"],
            content=content,
        )

        complete_response = await client.post(
            f"/api/v1/media/uploads/{intent['upload_id']}/complete",
            json={"etag": etag},
        )
        assert complete_response.status_code == 200
        asset = complete_response.json()["asset"]
        assert asset["status"] in {"processing", "ready"}

        await process_media_asset({}, asset["id"])

        media_repo = MediaAssetRepository
        stored_asset = None
        for _ in range(10):
            await asyncio.sleep(0.1)
            async with AsyncSessionLocal() as db:
                stored_asset = await media_repo(db).get_by_id(UUID(asset["id"]))
                if (
                    stored_asset is not None
                    and stored_asset.status == MediaStatus.READY
                    and stored_asset.preview_object_key
                    and stored_asset.thumb_object_key
                ):
                    break

        assert stored_asset is not None
        assert stored_asset.status == MediaStatus.READY
        assert stored_asset.preview_object_key is not None
        assert stored_asset.thumb_object_key is not None

        refreshed_response = await client.get(f"/api/v1/media/assets/{asset['id']}")
        assert refreshed_response.status_code == 200
        refreshed = refreshed_response.json()["asset"]
        assert refreshed["preview_url"]
        assert refreshed["download_url"]
