import type { LatLng } from "@naro/domain";
import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { Text } from "../Text";

import {
  MapContextProvider,
  type MapContextValue,
  type NormalizedPoint,
} from "./MapContext";
import {
  boundsFromCenter,
  boundsFromCoords,
  destinationPoint,
  haversineKm,
  type LatLngBounds,
} from "./utils/geo";
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MAP_THEME,
  type MapTheme,
} from "./tokens";

const PAD_X = 0.1;
const PAD_Y = 0.12;
const MIN_RADIUS_KM = 0.35;

function zoomToRadiusKm(zoom: number): number {
  // Naive inverse — zoom 13 ≈ 2 km hüzme, zoom 9 ≈ 32 km.
  return 2 ** (15 - zoom);
}

function resolveBounds(
  bounds: LatLngBounds | undefined,
  center: LatLng | undefined,
  zoom: number,
  fallbackCoords: LatLng[] | undefined,
): LatLngBounds {
  if (bounds) return bounds;
  if (fallbackCoords && fallbackCoords.length > 0) {
    const fromCoords = boundsFromCoords(fallbackCoords);
    if (fromCoords) {
      const [sw, ne] = fromCoords;
      const spanKm = haversineKm(sw, ne);
      if (spanKm < MIN_RADIUS_KM * 2) {
        return boundsFromCenter(center ?? midpoint(sw, ne), MIN_RADIUS_KM);
      }
      return expandBoundsFactor(fromCoords, 1.15);
    }
  }
  return boundsFromCenter(center ?? DEFAULT_CENTER, zoomToRadiusKm(zoom));
}

function midpoint(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

function expandBoundsFactor(
  bounds: LatLngBounds,
  factor: number,
): LatLngBounds {
  const [sw, ne] = bounds;
  const latCenter = (sw.lat + ne.lat) / 2;
  const lngCenter = (sw.lng + ne.lng) / 2;
  const halfLat = ((ne.lat - sw.lat) / 2) * factor;
  const halfLng = ((ne.lng - sw.lng) / 2) * factor;
  return [
    { lat: latCenter - halfLat, lng: lngCenter - halfLng },
    { lat: latCenter + halfLat, lng: lngCenter + halfLng },
  ];
}

export type MapViewProps = {
  /** Kesin pencere; varsa zoom/center yok sayılır. */
  bounds?: LatLngBounds;
  /** `bounds` yoksa bu koordinatlara otomatik fit. */
  fitCoords?: LatLng[];
  center?: LatLng;
  zoom?: number;
  theme?: MapTheme;
  /** Alt kısma düşen etiket/CTA banner (ETABadge gibi pozitif bilgi). */
  bottomOverlay?: ReactNode;
  /** Üst-sağ kontrol kümesi için slot (`<MapControlCluster>` koyulabilir). */
  topRightOverlay?: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * `true` → "önizleme" rozeti gizlenir. Lansman hazır native harita entegrasyonunda
   * iletilir; Faz 1 fallback için varsayılan `false`.
   */
  hideFallbackBadge?: boolean;
};

/**
 * Naro shared Map wrapper — dev client + native harita SDK ile canlıya dönecek,
 * şu an Expo Go için **fallback grid render** ediyor:
 * - Çocuk marker'lar (PinMarker, TruckMarker vs.) normalized projection ile
 *   konuma yerleştirilir
 * - Gerçek tile yok; altta "önizleme" rozeti var
 */
export function MapView({
  bounds,
  fitCoords,
  center,
  zoom = DEFAULT_ZOOM,
  theme = "dark",
  bottomOverlay,
  topRightOverlay,
  children,
  className,
  style,
  hideFallbackBadge = false,
}: MapViewProps) {
  const [containerSize, setContainerSize] = useState({ width: 1, height: 1 });
  const themeTokens = MAP_THEME[theme];

  const effectiveBounds = useMemo(
    () => resolveBounds(bounds, center, zoom, fitCoords),
    [bounds, center, zoom, fitCoords],
  );

  const project = useCallback(
    (coord: LatLng): NormalizedPoint => {
      const [sw, ne] = effectiveBounds;
      const lngSpan = Math.max(1e-5, ne.lng - sw.lng);
      const latSpan = Math.max(1e-5, ne.lat - sw.lat);
      const tx = (coord.lng - sw.lng) / lngSpan;
      const ty = 1 - (coord.lat - sw.lat) / latSpan;
      return {
        x: PAD_X + (1 - PAD_X * 2) * tx,
        y: PAD_Y + (1 - PAD_Y * 2) * ty,
      };
    },
    [effectiveBounds],
  );

  const pxPerKm = useCallback(
    (atCoord: LatLng) => {
      const east = destinationPoint(atCoord, 1, 90);
      const north = destinationPoint(atCoord, 1, 0);
      const here = project(atCoord);
      const eastProj = project(east);
      const northProj = project(north);
      return {
        x: Math.abs(eastProj.x - here.x) * containerSize.width,
        y: Math.abs(northProj.y - here.y) * containerSize.height,
      };
    },
    [project, containerSize],
  );

  const ctx: MapContextValue = useMemo(
    () => ({
      project,
      pxPerKm,
      theme,
      containerSize,
      isFallback: true,
    }),
    [project, pxPerKm, theme, containerSize],
  );

  return (
    <MapContextProvider value={ctx}>
      <View
        className={[
          "relative overflow-hidden rounded-[22px] border border-app-outline",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={[{ backgroundColor: themeTokens.background }, style]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setContainerSize((prev) =>
            prev.width === width && prev.height === height
              ? prev
              : { width, height },
          );
        }}
      >
        <GridOverlay color={themeTokens.grid} />
        <View className="absolute inset-0">{children}</View>
        {topRightOverlay ? (
          <View className="absolute right-3 top-3 gap-2">
            {topRightOverlay}
          </View>
        ) : null}
        {bottomOverlay ? (
          <View className="absolute bottom-3 left-3 right-3">
            {bottomOverlay}
          </View>
        ) : null}
        {!hideFallbackBadge ? (
          <View
            className="absolute right-3 top-3 rounded-full border border-app-outline px-2.5 py-1"
            style={{ backgroundColor: themeTokens.scrim }}
          >
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[10px]"
            >
              Önizleme · canlı harita dev build
            </Text>
          </View>
        ) : null}
      </View>
    </MapContextProvider>
  );
}

function GridOverlay({ color }: { color: string }) {
  return (
    <View className="absolute inset-0 opacity-30">
      {Array.from({ length: 5 }).map((_, i) => (
        <View
          key={`h-${i}`}
          className="absolute left-0 right-0 h-px"
          style={{ top: `${(i + 1) * 16.666}%`, backgroundColor: color }}
        />
      ))}
      {Array.from({ length: 5 }).map((_, i) => (
        <View
          key={`v-${i}`}
          className="absolute bottom-0 top-0 w-px"
          style={{ left: `${(i + 1) * 16.666}%`, backgroundColor: color }}
        />
      ))}
    </View>
  );
}
