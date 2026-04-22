export const MAP_PIN_COLORS = {
  pickup: "#2dd28d",
  dropoff: "#ff7e7e",
  workshop: "#83a7ff",
  self: "#f5b33f",
  arrived: "#0ea5e9",
  driver: "#f5b33f",
} as const;

export type MapPinKind = keyof typeof MAP_PIN_COLORS;

export const MAP_THEME = {
  dark: {
    background: "#0d1324",
    grid: "#26344f",
    scrim: "rgba(13, 19, 36, 0.72)",
    textOnMap: "#f5f7ff",
    routeLine: "#f5b33f",
    radiusFill: "rgba(14, 165, 233, 0.12)",
    radiusStroke: "#0ea5e9",
  },
  light: {
    background: "#eaeef6",
    grid: "#c5cddd",
    scrim: "rgba(240, 244, 252, 0.72)",
    textOnMap: "#11182a",
    routeLine: "#d97706",
    radiusFill: "rgba(14, 165, 233, 0.15)",
    radiusStroke: "#0ea5e9",
  },
} as const;

export type MapTheme = keyof typeof MAP_THEME;

export const DEFAULT_CENTER = { lat: 41.0082, lng: 28.9784 }; // Istanbul (Sultanahmet)
export const DEFAULT_ZOOM = 13;
