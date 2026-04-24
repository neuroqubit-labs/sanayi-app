"""Maps factory — Google Routes veya offline (haversine) fallback."""

from __future__ import annotations

from dataclasses import dataclass

from app.core.config import get_settings
from app.integrations.maps.google import GoogleMapsClient
from app.integrations.maps.haversine import haversine_distance_km
from app.integrations.maps.types import RouteDistance


@dataclass(slots=True)
class OfflineMapsClient:
    async def reverse_geocode(self, lat: float, lng: float) -> None:
        return None

    async def distance_km(self, origin: tuple[float, float], dest: tuple[float, float]) -> float:
        return haversine_distance_km(origin[0], origin[1], dest[0], dest[1])

    async def route_distance(
        self, origin: tuple[float, float], dest: tuple[float, float]
    ) -> RouteDistance:
        return RouteDistance(
            distance_km=await self.distance_km(origin, dest),
            duration_minutes=None,
            source="haversine",
        )


def get_maps() -> GoogleMapsClient | OfflineMapsClient:
    settings = get_settings()
    if settings.maps_provider == "google" and settings.google_maps_backend_api_key:
        return GoogleMapsClient(backend_token=settings.google_maps_backend_api_key)
    return OfflineMapsClient()
