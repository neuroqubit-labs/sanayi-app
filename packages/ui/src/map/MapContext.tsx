import type { LatLng } from "@naro/domain";
import { createContext, useContext } from "react";

import type { MapTheme } from "./tokens";

export type NormalizedPoint = { x: number; y: number };

export type MapContextValue = {
  project: (coord: LatLng) => NormalizedPoint;
  pxPerKm: (atCoord: LatLng) => { x: number; y: number };
  theme: MapTheme;
  containerSize: { width: number; height: number };
  isFallback: boolean;
};

const MapContext = createContext<MapContextValue | null>(null);

export const MapContextProvider = MapContext.Provider;

export function useMap(): MapContextValue {
  const ctx = useContext(MapContext);
  if (!ctx) {
    throw new Error("Map child components must be rendered inside <MapView>");
  }
  return ctx;
}
