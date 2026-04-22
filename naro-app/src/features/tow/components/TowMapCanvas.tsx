import type { LatLng, TowDispatchStage } from "@naro/domain";
import {
  ETABadge,
  GpsPulse,
  MapView,
  PinMarker,
  RouteLine,
  TruckMarker,
  bearingDeg,
} from "@naro/ui";
import { useMemo } from "react";

type Props = {
  stage: TowDispatchStage;
  pickup: LatLng | null;
  dropoff: LatLng | null;
  current: LatLng | null;
  etaMinutes: number | null;
};

/**
 * Müşteri tarafı çekici canlı takip haritası. `packages/ui/map` primitif'leri
 * üzerine inşa. Fallback render Expo Go'da çalışır; dev client + Mapbox
 * SDK geçince aynı prop API'si canlı tile üzerine yansır.
 */
export function TowMapCanvas({
  stage,
  pickup,
  dropoff,
  current,
  etaMinutes,
}: Props) {
  const showTransitRoute = stage === "in_transit" || stage === "delivered";
  const routeFrom = showTransitRoute ? pickup : current;
  const routeTo = showTransitRoute ? dropoff : pickup;

  const fitCoords = useMemo(
    () => [pickup, dropoff, current].filter((c): c is LatLng => c !== null),
    [pickup, dropoff, current],
  );

  const truckHeading = useMemo(() => {
    if (!current) return undefined;
    const target = showTransitRoute ? dropoff : pickup;
    if (!target) return undefined;
    return bearingDeg(current, target);
  }, [current, pickup, dropoff, showTransitRoute]);

  const showTruck =
    current !== null && stage !== "searching" && stage !== "bidding_open";

  return (
    <MapView
      fitCoords={fitCoords.length > 0 ? fitCoords : undefined}
      theme="dark"
      className="h-60"
      hideFallbackBadge
    >
      {routeFrom && routeTo ? (
        <RouteLine coords={[routeFrom, routeTo]} dotCount={16} />
      ) : null}

      {pickup ? (
        <PinMarker kind="pickup" coord={pickup} label="Konumun" />
      ) : null}
      {dropoff ? (
        <PinMarker kind="dropoff" coord={dropoff} label="Varış" />
      ) : null}

      {(stage === "searching" || stage === "bidding_open") && pickup ? (
        <GpsPulse coord={pickup} color="#0ea5e9" />
      ) : null}

      {showTruck && current ? (
        <TruckMarker coord={current} heading={truckHeading} pulse />
      ) : null}

      {etaMinutes !== null && etaMinutes > 0 && showTruck && current ? (
        <ETABadge minutes={etaMinutes} coord={current} tone="accent" />
      ) : null}
    </MapView>
  );
}
