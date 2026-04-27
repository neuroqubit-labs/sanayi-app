import type { LatLng } from "@naro/domain";
import { Platform } from "react-native";
import type { Region } from "react-native-maps";

import { env } from "@/runtime";

export const DEFAULT_PICKER_CENTER: LatLng = { lat: 38.7205, lng: 35.4826 };

const BASE_DELTA = 0.075;

export function hasGoogleMapKey() {
  return Platform.OS === "ios"
    ? Boolean(env.googleMapsIosApiKey)
    : Boolean(env.googleMapsAndroidApiKey);
}

export function toMapCoord(coord: LatLng) {
  return { latitude: coord.lat, longitude: coord.lng };
}

export function toRegion(coord: LatLng, zoom = 14): Region {
  const zoomFactor = 2 ** (14 - zoom);
  return {
    latitude: coord.lat,
    longitude: coord.lng,
    latitudeDelta: BASE_DELTA * zoomFactor,
    longitudeDelta: BASE_DELTA * zoomFactor,
  };
}

export function fromRegion(region: Region): LatLng {
  return { lat: region.latitude, lng: region.longitude };
}

export const GOOGLE_DARK_MAP_STYLE = [
  {
    elementType: "geometry",
    stylers: [{ color: "#1d2430" }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#c5d1e3" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1d2430" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#334052" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#111827" }],
  },
];
