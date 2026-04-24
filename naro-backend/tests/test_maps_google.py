from __future__ import annotations

import httpx
import pytest

from app.api.v1.routes.tow import cases as tow_cases
from app.integrations.maps.google import GoogleMapsClient
from app.integrations.maps.types import RouteDistance
from app.schemas.tow import LatLng, TowFareQuoteRequest, TowModeSchema


class _FakeResponse:
    def __init__(self, payload: dict[str, object]) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, object]:
        return self._payload


class _FakeAsyncClient:
    def __init__(
        self, payload: dict[str, object] | None = None, error: Exception | None = None
    ) -> None:
        self.payload = payload or {}
        self.error = error

    async def __aenter__(self) -> _FakeAsyncClient:
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None

    async def post(self, *_args: object, **_kwargs: object) -> _FakeResponse:
        if self.error:
            raise self.error
        return _FakeResponse(self.payload)


@pytest.mark.asyncio
async def test_google_distance_uses_compute_routes(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.integrations.maps.google.httpx.AsyncClient",
        lambda **_kwargs: _FakeAsyncClient(
            {
                "routes": [
                    {
                        "distanceMeters": 12_345,
                        "duration": "1234s",
                        "polyline": {
                            "geoJsonLinestring": {
                                "coordinates": [
                                    [28.9784, 41.0082],
                                    [29.022, 41.112],
                                ]
                            }
                        },
                    }
                ]
            }
        ),
    )

    result = await GoogleMapsClient(backend_token="test-token").route_distance(
        (41.0082, 28.9784),
        (41.112, 29.022),
    )

    assert result.distance_km == 12.345
    assert result.duration_minutes == 21
    assert result.source == "google"
    assert result.route_coords == [(41.0082, 28.9784), (41.112, 29.022)]


@pytest.mark.asyncio
async def test_google_distance_falls_back_to_haversine(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.integrations.maps.google.httpx.AsyncClient",
        lambda **_kwargs: _FakeAsyncClient(error=httpx.ConnectError("offline")),
    )

    result = await GoogleMapsClient(backend_token="test-token").route_distance(
        (41.0082, 28.9784),
        (41.112, 29.022),
    )

    assert result.distance_km > 0
    assert result.duration_minutes is None
    assert result.source == "haversine"
    assert result.route_coords is None


@pytest.mark.asyncio
async def test_quote_fare_returns_google_distance_source(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeMaps:
        async def route_distance(
            self,
            _origin: tuple[float, float],
            _dest: tuple[float, float],
        ) -> RouteDistance:
            return RouteDistance(
                distance_km=10.0,
                duration_minutes=18,
                source="google",
                route_coords=[(41.0082, 28.9784), (41.112, 29.022)],
            )

    monkeypatch.setattr(tow_cases, "get_maps", lambda: FakeMaps())

    response = await tow_cases.quote_fare(
        TowFareQuoteRequest(
            mode=TowModeSchema.IMMEDIATE,
            pickup_lat_lng=LatLng(lat=41.0082, lng=28.9784),
            dropoff_lat_lng=LatLng(lat=41.112, lng=29.022),
            urgency_bump=True,
        ),
        object(),
    )

    assert response.distance_source == "google"
    assert response.duration_minutes == 18
    assert response.distance_km == 10
    assert response.route_coords == [
        LatLng(lat=41.0082, lng=28.9784),
        LatLng(lat=41.112, lng=29.022),
    ]
    assert response.quote.cap_amount > 0
