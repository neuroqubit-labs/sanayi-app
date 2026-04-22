import type { LatLng } from "@naro/domain";
import { View } from "react-native";

import { useMap } from "./MapContext";
import { MAP_THEME } from "./tokens";

export type RadiusCircleProps = {
  center: LatLng;
  radiusKm: number;
  fillOverride?: string;
  strokeOverride?: string;
};

export function RadiusCircle({
  center,
  radiusKm,
  fillOverride,
  strokeOverride,
}: RadiusCircleProps) {
  const { project, pxPerKm, theme, containerSize } = useMap();
  const pos = project(center);
  const themeTokens = MAP_THEME[theme];
  const fill = fillOverride ?? themeTokens.radiusFill;
  const stroke = strokeOverride ?? themeTokens.radiusStroke;

  // Ekran boyutu bilinmiyorsa nothing
  if (containerSize.width < 2 || containerSize.height < 2) return null;

  const { x: pxKmX, y: pxKmY } = pxPerKm(center);
  const radiusPx = Math.min(
    (Math.max(pxKmX, pxKmY) || 1) * radiusKm,
    Math.min(containerSize.width, containerSize.height) * 0.48,
  );

  return (
    <View
      pointerEvents="none"
      className="absolute rounded-full border"
      style={{
        left: `${pos.x * 100}%`,
        top: `${pos.y * 100}%`,
        width: radiusPx * 2,
        height: radiusPx * 2,
        transform: [{ translateX: -radiusPx }, { translateY: -radiusPx }],
        backgroundColor: fill,
        borderColor: stroke,
        borderStyle: "dashed",
      }}
    />
  );
}
