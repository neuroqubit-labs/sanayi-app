"""Haversine distance — offline fallback (route estimation yok, düz mesafe)."""

from __future__ import annotations

import math

EARTH_RADIUS_M = 6_371_000.0


def haversine_distance_m(
    lat1: float, lng1: float, lat2: float, lng2: float
) -> float:
    """Great-circle distance (m) between two WGS84 points."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_M * c


def haversine_distance_km(
    lat1: float, lng1: float, lat2: float, lng2: float
) -> float:
    return haversine_distance_m(lat1, lng1, lat2, lng2) / 1000.0
