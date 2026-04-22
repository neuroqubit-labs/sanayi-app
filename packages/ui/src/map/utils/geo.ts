import type { LatLng } from "@naro/domain";

const EARTH_RADIUS_KM = 6371;

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function toDeg(value: number) {
  return (value * 180) / Math.PI;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function lerpLatLng(a: LatLng, b: LatLng, t: number): LatLng {
  const clamped = Math.min(1, Math.max(0, t));
  return {
    lat: a.lat + (b.lat - a.lat) * clamped,
    lng: a.lng + (b.lng - a.lng) * clamped,
  };
}

export function bearingDeg(a: LatLng, b: LatLng): number {
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function etaMinutes(distanceKm: number, avgSpeedKmh: number): number {
  if (avgSpeedKmh <= 0) return 0;
  return Math.max(1, Math.round((distanceKm / avgSpeedKmh) * 60));
}

export function buildRoutePoints(
  from: LatLng,
  to: LatLng,
  segmentCount = 12,
): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i <= segmentCount; i += 1) {
    out.push(lerpLatLng(from, to, i / segmentCount));
  }
  return out;
}

/**
 * `origin`'den `bearing`° yönünde `distanceKm` mesafedeki noktayı döner.
 * Spherical earth approximation — görsel amaçlar için yeterli.
 */
export function destinationPoint(
  origin: LatLng,
  distanceKm: number,
  bearing: number,
): LatLng {
  const angular = distanceKm / EARTH_RADIUS_KM;
  const brng = toRad(bearing);
  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(brng),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: toDeg(lat2), lng: ((toDeg(lng2) + 540) % 360) - 180 };
}

export type LatLngBounds = [LatLng, LatLng]; // [southwest, northeast]

export function boundsFromCoords(coords: LatLng[]): LatLngBounds | null {
  if (coords.length === 0) return null;
  let minLat = coords[0]!.lat;
  let maxLat = coords[0]!.lat;
  let minLng = coords[0]!.lng;
  let maxLng = coords[0]!.lng;
  for (const c of coords) {
    minLat = Math.min(minLat, c.lat);
    maxLat = Math.max(maxLat, c.lat);
    minLng = Math.min(minLng, c.lng);
    maxLng = Math.max(maxLng, c.lng);
  }
  return [
    { lat: minLat, lng: minLng },
    { lat: maxLat, lng: maxLng },
  ];
}

export function boundsFromCenter(
  center: LatLng,
  radiusKm: number,
): LatLngBounds {
  const sw = destinationPoint(center, radiusKm * Math.SQRT2, 225);
  const ne = destinationPoint(center, radiusKm * Math.SQRT2, 45);
  return [sw, ne];
}

export function expandBounds(
  bounds: LatLngBounds,
  paddingKm: number,
): LatLngBounds {
  const [sw, ne] = bounds;
  return [
    destinationPoint(sw, paddingKm * Math.SQRT2, 225),
    destinationPoint(ne, paddingKm * Math.SQRT2, 45),
  ];
}
