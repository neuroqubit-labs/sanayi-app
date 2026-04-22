import type { LatLng } from "@naro/domain";
import {
  Flag,
  MapPin,
  MapPinned,
  Store,
  Target,
  User,
  type LucideIcon,
} from "lucide-react-native";
import { View } from "react-native";

import { Icon } from "../Icon";
import { Text } from "../Text";

import { useMap } from "./MapContext";
import { MAP_PIN_COLORS, MAP_THEME, type MapPinKind } from "./tokens";

const ICON_BY_KIND: Record<MapPinKind, LucideIcon> = {
  pickup: MapPin,
  dropoff: MapPinned,
  workshop: Store,
  self: User,
  arrived: Target,
  driver: Flag,
};

export type PinMarkerProps = {
  kind: MapPinKind;
  coord: LatLng;
  label?: string;
  size?: "sm" | "md" | "lg";
  colorOverride?: string;
};

const SIZE_PX: Record<NonNullable<PinMarkerProps["size"]>, number> = {
  sm: 28,
  md: 36,
  lg: 44,
};

const ICON_SIZE: Record<NonNullable<PinMarkerProps["size"]>, number> = {
  sm: 12,
  md: 14,
  lg: 18,
};

export function PinMarker({
  kind,
  coord,
  label,
  size = "md",
  colorOverride,
}: PinMarkerProps) {
  const { project, theme } = useMap();
  const pos = project(coord);
  const color = colorOverride ?? MAP_PIN_COLORS[kind];
  const circleSize = SIZE_PX[size];
  const iconSize = ICON_SIZE[size];
  const icon = ICON_BY_KIND[kind];
  const themeTokens = MAP_THEME[theme];

  return (
    <View
      pointerEvents="none"
      className="absolute items-center"
      style={{
        left: `${pos.x * 100}%`,
        top: `${pos.y * 100}%`,
        transform: [
          { translateX: -circleSize / 2 },
          { translateY: -circleSize / 2 },
        ],
      }}
    >
      <View
        className="items-center justify-center rounded-full border-2"
        style={{
          width: circleSize,
          height: circleSize,
          backgroundColor: `${color}26`,
          borderColor: `${color}88`,
        }}
      >
        <Icon icon={icon} size={iconSize} color={color} />
      </View>
      {label ? (
        <View
          className="mt-1 rounded-full border px-2 py-0.5"
          style={{
            backgroundColor: themeTokens.scrim,
            borderColor: themeTokens.grid,
          }}
        >
          <Text
            variant="caption"
            tone="muted"
            className="text-[10px]"
            style={{ color: themeTokens.textOnMap }}
          >
            {label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
