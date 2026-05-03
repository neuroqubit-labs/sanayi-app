import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_health() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_ready_smoke() -> None:
    """Lokal infra ayaktayken /ready 200 dönmeli — DB+Redis+alembic OK.

    CI'da postgres+redis service container'ları sağlıklı; bağlanılabilirlik
    fiilen kanıtlanır. Tek bağımlılık düşse 503 ve payload'da hangi check'in
    fail olduğu görünür (rolling restart probe için kritik).
    """

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/ready")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "ready"
    assert payload["checks"]["db"]["ok"] is True
    assert payload["checks"]["redis"]["ok"] is True
    assert payload["checks"]["alembic"]["ok"] is True
