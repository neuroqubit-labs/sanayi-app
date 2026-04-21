"""Mapbox adapter — geocode + distance_matrix + directions.

V1'de opsiyonel; `MAPS_PROVIDER=offline` (default) → haversine fallback.
`MAPS_PROVIDER=mapbox` + `MAPBOX_BACKEND_TOKEN` ayarlıyken aktif.

Redis cache 30g (key: `mapbox:geocode:{lat_lng_rounded}`) — TODO Faz 10f.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class GeocodeResult:
    address: str
    lat: float
    lng: float


class MapboxClient:
    def __init__(self, *, backend_token: str, base_url: str = "https://api.mapbox.com") -> None:
        if not backend_token:
            raise ValueError("Mapbox backend token required")
        self._token = backend_token
        self._base_url = base_url

    async def reverse_geocode(self, lat: float, lng: float) -> GeocodeResult | None:
        """V1 stub — V1.1 gerçek HTTP call. Offline fallback None döner."""
        # HTTP integration ile ilerleyen faz; şu an None → caller adres yok der.
        return None

    async def distance_km(
        self, origin: tuple[float, float], dest: tuple[float, float]
    ) -> float:
        """V1 stub — haversine fallback zaten kullanılıyor."""
        from app.integrations.maps.haversine import haversine_distance_km

        return haversine_distance_km(origin[0], origin[1], dest[0], dest[1])
