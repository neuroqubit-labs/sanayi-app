from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(slots=True)
class RouteDistance:
    distance_km: float
    duration_minutes: int | None
    source: Literal["google", "haversine"]
    route_coords: list[tuple[float, float]] | None = None
