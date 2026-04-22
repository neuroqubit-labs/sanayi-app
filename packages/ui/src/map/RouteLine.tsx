import type { LatLng } from "@naro/domain";
import { Fragment } from "react";
import { View } from "react-native";

import { useMap } from "./MapContext";
import { MAP_THEME } from "./tokens";
import { buildRoutePoints } from "./utils/geo";

export type RouteLineProps = {
  /** Ham koordinatlar. 2+ nokta; fallback lineup için segmentleştirilir. */
  coords: LatLng[];
  colorOverride?: string;
  /** Nokta sayısı (fallback çizgi dot count). Default 18. */
  dotCount?: number;
  dotSize?: number;
};

/**
 * Fallback: koordinat dizisini segment'lere böler + küçük daireler çizer.
 * Gerçek Mapbox entegrasyonunda polyline.
 */
export function RouteLine({
  coords,
  colorOverride,
  dotCount = 18,
  dotSize = 5,
}: RouteLineProps) {
  const { project, theme } = useMap();
  if (coords.length < 2) return null;

  const color = colorOverride ?? MAP_THEME[theme].routeLine;

  // Eşit aralıkla resample (segment sayısı dotCount)
  const stepsPerSegment = Math.max(
    2,
    Math.floor(dotCount / Math.max(1, coords.length - 1)),
  );
  const dots: { x: number; y: number; key: string }[] = [];
  for (let i = 0; i < coords.length - 1; i += 1) {
    const from = coords[i]!;
    const to = coords[i + 1]!;
    const segment = buildRoutePoints(from, to, stepsPerSegment);
    segment.forEach((p, idx) => {
      if (i > 0 && idx === 0) return; // segment sınırında duplicate'i atla
      const proj = project(p);
      dots.push({ x: proj.x, y: proj.y, key: `${i}-${idx}` });
    });
  }

  return (
    <Fragment>
      {dots.map((dot) => (
        <View
          key={dot.key}
          pointerEvents="none"
          className="absolute rounded-full"
          style={{
            left: `${dot.x * 100}%`,
            top: `${dot.y * 100}%`,
            width: dotSize,
            height: dotSize,
            backgroundColor: color,
            transform: [{ translateX: -dotSize / 2 }, { translateY: -dotSize / 2 }],
          }}
        />
      ))}
    </Fragment>
  );
}
