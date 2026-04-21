"""Maps factory — Mapbox veya offline (haversine) fallback."""

from __future__ import annotations

from dataclasses import dataclass

from app.core.config import get_settings
from app.integrations.maps.haversine import haversine_distance_km
from app.integrations.maps.mapbox import MapboxClient


@dataclass(slots=True)
class OfflineMapsClient:
    async def reverse_geocode(self, lat: float, lng: float) -> None:
        return None

    async def distance_km(
        self, origin: tuple[float, float], dest: tuple[float, float]
    ) -> float:
        return haversine_distance_km(origin[0], origin[1], dest[0], dest[1])


def get_maps() -> MapboxClient | OfflineMapsClient:
    settings = get_settings()
    if settings.maps_provider == "mapbox" and settings.mapbox_backend_token:
        return MapboxClient(backend_token=settings.mapbox_backend_token)
    return OfflineMapsClient()
