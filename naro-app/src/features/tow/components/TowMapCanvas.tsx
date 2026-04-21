import type { LatLng, TowDispatchStage } from "@naro/domain";
import { Icon, Text } from "@naro/ui";
import { MapPin, MapPinned, Truck } from "lucide-react-native";
import { useMemo } from "react";
import { View } from "react-native";

type Props = {
  stage: TowDispatchStage;
  pickup: LatLng | null;
  dropoff: LatLng | null;
  current: LatLng | null;
  etaMinutes: number | null;
};

type PlotPoint = { x: number; y: number };

function plotPoints(
  points: { key: string; lat_lng: LatLng | null }[],
): Map<string, PlotPoint | null> {
  const bounded = points.filter(
    (p): p is { key: string; lat_lng: LatLng } => p.lat_lng !== null,
  );
  const result = new Map<string, PlotPoint | null>();
  if (bounded.length === 0) {
    for (const p of points) result.set(p.key, null);
    return result;
  }

  let minLat = bounded[0]!.lat_lng.lat;
  let maxLat = bounded[0]!.lat_lng.lat;
  let minLng = bounded[0]!.lat_lng.lng;
  let maxLng = bounded[0]!.lat_lng.lng;
  for (const p of bounded) {
    minLat = Math.min(minLat, p.lat_lng.lat);
    maxLat = Math.max(maxLat, p.lat_lng.lat);
    minLng = Math.min(minLng, p.lat_lng.lng);
    maxLng = Math.max(maxLng, p.lat_lng.lng);
  }
  const latSpan = Math.max(0.005, maxLat - minLat);
  const lngSpan = Math.max(0.005, maxLng - minLng);
  const padX = 0.12;
  const padY = 0.14;

  for (const p of points) {
    if (!p.lat_lng) {
      result.set(p.key, null);
      continue;
    }
    const tx = (p.lat_lng.lng - minLng) / lngSpan;
    const ty = 1 - (p.lat_lng.lat - minLat) / latSpan;
    result.set(p.key, {
      x: padX + (1 - padX * 2) * tx,
      y: padY + (1 - padY * 2) * ty,
    });
  }
  return result;
}

export function TowMapCanvas({
  stage,
  pickup,
  dropoff,
  current,
  etaMinutes,
}: Props) {
  const plotted = useMemo(
    () =>
      plotPoints([
        { key: "pickup", lat_lng: pickup },
        { key: "dropoff", lat_lng: dropoff },
        { key: "current", lat_lng: current },
      ]),
    [pickup, dropoff, current],
  );

  const pickupPos = plotted.get("pickup") ?? null;
  const dropoffPos = plotted.get("dropoff") ?? null;
  const currentPos = plotted.get("current") ?? null;

  const showTransitRoute = stage === "in_transit" || stage === "delivered";
  const routeFrom = showTransitRoute ? pickupPos : currentPos;
  const routeTo = showTransitRoute ? dropoffPos : pickupPos;

  return (
    <View className="relative h-60 overflow-hidden rounded-[24px] border border-app-outline bg-app-surface-2">
      <View className="absolute inset-0 opacity-20">
        {Array.from({ length: 5 }).map((_, i) => (
          <View
            key={`h-${i}`}
            className="absolute left-0 right-0 h-px bg-app-outline"
            style={{ top: `${(i + 1) * 16.666}%` }}
          />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <View
            key={`v-${i}`}
            className="absolute bottom-0 top-0 w-px bg-app-outline"
            style={{ left: `${(i + 1) * 16.666}%` }}
          />
        ))}
      </View>

      {routeFrom && routeTo ? (
        <RouteDots from={routeFrom} to={routeTo} />
      ) : null}

      {pickupPos ? (
        <Pin
          pos={pickupPos}
          color="#2dd28d"
          icon={MapPin}
          label="Konumun"
          tone="success"
        />
      ) : null}
      {dropoffPos ? (
        <Pin
          pos={dropoffPos}
          color="#ff7e7e"
          icon={MapPinned}
          label="Varış"
          tone="critical"
        />
      ) : null}
      {currentPos && stage !== "searching" && stage !== "bidding_open" ? (
        <Pin
          pos={currentPos}
          color="#0ea5e9"
          icon={Truck}
          label="Çekici"
          tone="accent"
          big
        />
      ) : null}

      <View className="absolute bottom-3 left-3 right-3 flex-row items-center justify-between gap-2 rounded-full border border-app-outline bg-app-surface/80 px-3 py-1.5">
        <View className="flex-row items-center gap-1.5">
          <View className="h-1.5 w-1.5 rounded-full bg-app-success" />
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            {stage === "in_transit" ? "Servise yönlendiriliyor" : "Canlı konum"}
          </Text>
        </View>
        {etaMinutes !== null && etaMinutes > 0 ? (
          <Text variant="caption" tone="accent">
            ETA {etaMinutes} dk
          </Text>
        ) : null}
      </View>
    </View>
  );
}

type PinProps = {
  pos: PlotPoint;
  color: string;
  icon: React.ComponentProps<typeof Icon>["icon"];
  label: string;
  tone: "success" | "critical" | "accent";
  big?: boolean;
};

function Pin({ pos, color, icon, label, big = false }: PinProps) {
  const size = big ? 44 : 36;
  return (
    <View
      pointerEvents="none"
      className="absolute items-center"
      style={{
        left: `${pos.x * 100}%`,
        top: `${pos.y * 100}%`,
        transform: [{ translateX: -size / 2 }, { translateY: -size / 2 }],
      }}
    >
      <View
        className="items-center justify-center rounded-full border-2"
        style={{
          width: size,
          height: size,
          backgroundColor: `${color}22`,
          borderColor: `${color}55`,
        }}
      >
        <Icon icon={icon} size={big ? 18 : 14} color={color} />
      </View>
      <View
        className="mt-1 rounded-full border border-app-outline bg-app-surface/90 px-2 py-0.5"
      >
        <Text variant="caption" tone="muted" className="text-[10px]">
          {label}
        </Text>
      </View>
    </View>
  );
}

function RouteDots({ from, to }: { from: PlotPoint; to: PlotPoint }) {
  const dots = 16;
  const items = Array.from({ length: dots }).map((_, i) => {
    const t = (i + 1) / (dots + 1);
    return {
      key: i,
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    };
  });
  return (
    <>
      {items.map((dot) => (
        <View
          key={dot.key}
          pointerEvents="none"
          className="absolute h-1.5 w-1.5 rounded-full bg-brand-500/60"
          style={{
            left: `${dot.x * 100}%`,
            top: `${dot.y * 100}%`,
            transform: [{ translateX: -3 }, { translateY: -3 }],
          }}
        />
      ))}
    </>
  );
}
