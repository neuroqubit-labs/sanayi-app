"""Google Routes adapter for tow quote distance.

`MAPS_PROVIDER=google` + `GOOGLE_MAPS_BACKEND_API_KEY` enables route distance.
Any upstream failure falls back to local haversine so quote creation remains
available during provider incidents.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import ceil

import httpx

from app.integrations.maps.haversine import haversine_distance_km
from app.integrations.maps.types import RouteDistance


@dataclass(slots=True)
class GeocodeResult:
    address: str
    lat: float
    lng: float


class GoogleMapsClient:
    def __init__(
        self,
        *,
        backend_token: str,
        base_url: str = "https://routes.googleapis.com",
    ) -> None:
        if not backend_token:
            raise ValueError("Google Maps backend token required")
        self._token = backend_token
        self._base_url = base_url.rstrip("/")

    async def reverse_geocode(self, lat: float, lng: float) -> GeocodeResult | None:
        """V1 quote flow does not need reverse geocoding yet."""
        return None

    async def distance_km(
        self, origin: tuple[float, float], dest: tuple[float, float]
    ) -> float:
        return (await self.route_distance(origin, dest)).distance_km

    async def route_distance(
        self, origin: tuple[float, float], dest: tuple[float, float]
    ) -> RouteDistance:
        fallback = RouteDistance(
            distance_km=haversine_distance_km(origin[0], origin[1], dest[0], dest[1]),
            duration_minutes=None,
            source="haversine",
        )
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                response = await client.post(
                    f"{self._base_url}/directions/v2:computeRoutes",
                    headers={
                        "Content-Type": "application/json",
                        "X-Goog-Api-Key": self._token,
                        "X-Goog-FieldMask": (
                            "routes.distanceMeters,routes.duration,routes.polyline"
                        ),
                    },
                    json={
                        "origin": {
                            "location": {
                                "latLng": {
                                    "latitude": origin[0],
                                    "longitude": origin[1],
                                }
                            }
                        },
                        "destination": {
                            "location": {
                                "latLng": {
                                    "latitude": dest[0],
                                    "longitude": dest[1],
                                }
                            }
                        },
                        "travelMode": "DRIVE",
                        "routingPreference": "TRAFFIC_AWARE",
                        "computeAlternativeRoutes": False,
                        "polylineQuality": "OVERVIEW",
                        "polylineEncoding": "GEO_JSON_LINESTRING",
                    },
                )
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            return fallback

        routes = payload.get("routes")
        if not isinstance(routes, list) or not routes:
            return fallback
        route = routes[0]
        if not isinstance(route, dict):
            return fallback
        distance_m = route.get("distanceMeters")
        if not isinstance(distance_m, (int, float)) or distance_m <= 0:
            return fallback

        duration_minutes = _parse_duration_minutes(route.get("duration"))
        return RouteDistance(
            distance_km=float(distance_m) / 1000,
            duration_minutes=duration_minutes,
            source="google",
            route_coords=_parse_geojson_coords(route.get("polyline")),
        )


def _parse_duration_minutes(value: object) -> int | None:
    if not isinstance(value, str) or not value.endswith("s"):
        return None
    try:
        seconds = float(value[:-1])
    except ValueError:
        return None
    return max(1, ceil(seconds / 60)) if seconds > 0 else None


def _parse_geojson_coords(polyline: object) -> list[tuple[float, float]] | None:
    if not isinstance(polyline, dict):
        return None
    geojson = polyline.get("geoJsonLinestring")
    if not isinstance(geojson, dict):
        return None
    coords = geojson.get("coordinates")
    if not isinstance(coords, list):
        return None
    parsed: list[tuple[float, float]] = []
    for coord in coords:
        if (
            isinstance(coord, list)
            and len(coord) >= 2
            and isinstance(coord[0], (int, float))
            and isinstance(coord[1], (int, float))
        ):
            # Google returns GeoJSON as [lng, lat]; app schemas use lat/lng.
            parsed.append((float(coord[1]), float(coord[0])))
    return parsed if len(parsed) > 1 else None
