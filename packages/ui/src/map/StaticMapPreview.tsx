import type { LatLng } from "@naro/domain";
import type { LucideIcon } from "lucide-react-native";
import { MapPin, MapPinned, Store, Target, Truck, User } from "lucide-react-native";
import { type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { Icon } from "../Icon";
import { Text } from "../Text";

import { MAP_PIN_COLORS, MAP_THEME, type MapTheme } from "./tokens";
import {
  boundsFromCenter,
  boundsFromCoords,
  type LatLngBounds,
} from "./utils/geo";

const ICON_BY_KIND: Record<keyof typeof MAP_PIN_COLORS, LucideIcon> = {
  pickup: MapPin,
  dropoff: MapPinned,
  workshop: Store,
  self: User,
  arrived: Target,
  driver: Truck,
};

type PinSpec = {
  coord: LatLng;
  kind: keyof typeof MAP_PIN_COLORS;
  label?: string;
};

export type StaticMapPreviewProps = {
  pins: PinSpec[];
  /** Çubuklu route — ardışık koordinatlar arası dot line. */
  routeCoords?: LatLng[];
  height?: number;
  theme?: MapTheme;
  bottomCaption?: ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
};

/**
 * Non-interactive map snapshot. Accept sheet mini-map + delivered özet +
 * feed summary gibi yerlerde kullanılır. Fallback grid + marker kümesi.
 */
export function StaticMapPreview({
  pins,
  routeCoords,
  height = 160,
  theme = "dark",
  bottomCaption,
  className,
  style,
}: StaticMapPreviewProps) {
  const themeTokens = MAP_THEME[theme];

  const coords = pins.map((p) => p.coord);
  if (routeCoords) coords.push(...routeCoords);
  const bounds: LatLngBounds =
    boundsFromCoords(coords) ?? boundsFromCenter(pins[0]?.coord ?? ANKARA, 2);

  const project = (coord: LatLng) => {
    const [sw, ne] = bounds;
    const lngSpan = Math.max(1e-5, ne.lng - sw.lng);
    const latSpan = Math.max(1e-5, ne.lat - sw.lat);
    const padX = 0.14;
    const padY = 0.18;
    return {
      x: padX + (1 - padX * 2) * ((coord.lng - sw.lng) / lngSpan),
      y: padY + (1 - padY * 2) * (1 - (coord.lat - sw.lat) / latSpan),
    };
  };

  return (
    <View
      className={[
        "relative overflow-hidden rounded-[18px] border border-app-outline",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={[{ height, backgroundColor: themeTokens.background }, style]}
    >
      <View className="absolute inset-0 opacity-25">
        {Array.from({ length: 4 }).map((_, i) => (
          <View
            key={`h-${i}`}
            className="absolute left-0 right-0 h-px"
            style={{ top: `${(i + 1) * 20}%`, backgroundColor: themeTokens.grid }}
          />
        ))}
        {Array.from({ length: 4 }).map((_, i) => (
          <View
            key={`v-${i}`}
            className="absolute bottom-0 top-0 w-px"
            style={{ left: `${(i + 1) * 20}%`, backgroundColor: themeTokens.grid }}
          />
        ))}
      </View>

      {routeCoords && routeCoords.length >= 2
        ? routeCoords.slice(1).map((to, i) => {
            const from = routeCoords[i]!;
            return <MiniRouteSegment key={i} from={from} to={to} project={project} color={themeTokens.routeLine} />;
          })
        : null}

      {pins.map((p, i) => {
        const pos = project(p.coord);
        const color = MAP_PIN_COLORS[p.kind];
        const icon = ICON_BY_KIND[p.kind];
        return (
          <View
            key={`${p.kind}-${i}`}
            pointerEvents="none"
            className="absolute items-center"
            style={{
              left: `${pos.x * 100}%`,
              top: `${pos.y * 100}%`,
              transform: [{ translateX: -16 }, { translateY: -16 }],
            }}
          >
            <View
              className="items-center justify-center rounded-full border-2"
              style={{
                width: 32,
                height: 32,
                backgroundColor: `${color}26`,
                borderColor: `${color}99`,
              }}
            >
              <Icon icon={icon} size={13} color={color} />
            </View>
            {p.label ? (
              <View
                className="mt-1 rounded-full border px-1.5 py-0.5"
                style={{
                  backgroundColor: themeTokens.scrim,
                  borderColor: themeTokens.grid,
                }}
              >
                <Text
                  variant="caption"
                  className="text-[9px]"
                  style={{ color: themeTokens.textOnMap }}
                >
                  {p.label}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}

      {bottomCaption ? (
        <View
          className="absolute bottom-2 left-2 right-2 flex-row items-center justify-center rounded-full border px-2.5 py-0.5"
          style={{
            backgroundColor: themeTokens.scrim,
            borderColor: themeTokens.grid,
          }}
        >
          {bottomCaption}
        </View>
      ) : null}
    </View>
  );
}

const ANKARA: LatLng = { lat: 39.9334, lng: 32.8597 };

function MiniRouteSegment({
  from,
  to,
  project,
  color,
}: {
  from: LatLng;
  to: LatLng;
  project: (c: LatLng) => { x: number; y: number };
  color: string;
}) {
  const f = project(from);
  const t = project(to);
  const dots = 8;
  return (
    <>
      {Array.from({ length: dots }).map((_, i) => {
        const k = (i + 1) / (dots + 1);
        const x = f.x + (t.x - f.x) * k;
        const y = f.y + (t.y - f.y) * k;
        return (
          <View
            key={i}
            pointerEvents="none"
            className="absolute rounded-full"
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              width: 4,
              height: 4,
              backgroundColor: `${color}cc`,
              transform: [{ translateX: -2 }, { translateY: -2 }],
            }}
          />
        );
      })}
    </>
  );
}
