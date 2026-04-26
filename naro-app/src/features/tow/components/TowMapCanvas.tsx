import type { LatLng, TowDispatchStage } from "@naro/domain";
import {
  DEFAULT_CENTER,
  ETABadge,
  GpsPulse,
  MapView as FallbackMapView,
  PinMarker,
  RouteLine,
  TruckMarker,
  bearingDeg,
  useNaroTheme,
} from "@naro/ui";
import { useEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type Region,
} from "react-native-maps";

import { env } from "@/runtime";

type Props = {
  stage: TowDispatchStage;
  pickup: LatLng | null;
  dropoff: LatLng | null;
  current: LatLng | null;
  etaMinutes: number | null;
};

const DEFAULT_DELTA = {
  latitudeDelta: 0.075,
  longitudeDelta: 0.075,
};

function toRegion(coord: LatLng): Region {
  return {
    latitude: coord.lat,
    longitude: coord.lng,
    ...DEFAULT_DELTA,
  };
}

function toMapCoord(coord: LatLng) {
  return { latitude: coord.lat, longitude: coord.lng };
}

function resolveCenter(coords: LatLng[]): LatLng {
  if (coords.length === 0) return DEFAULT_CENTER;
  const total = coords.reduce(
    (acc, coord) => ({
      lat: acc.lat + coord.lat,
      lng: acc.lng + coord.lng,
    }),
    { lat: 0, lng: 0 },
  );
  return {
    lat: total.lat / coords.length,
    lng: total.lng / coords.length,
  };
}

function hasGoogleKey() {
  return Platform.OS === "ios"
    ? Boolean(env.googleMapsIosApiKey)
    : Boolean(env.googleMapsAndroidApiKey);
}

/**
 * Müşteri tarafı çekici canlı takip haritası. `packages/ui/map` primitif'leri
 * fallback olarak kalır; Google key olan native build gerçek tile gösterir.
 */
export function TowMapCanvas({
  stage,
  pickup,
  dropoff,
  current,
  etaMinutes,
}: Props) {
  const { colors, scheme } = useNaroTheme();
  const mapRef = useRef<MapView | null>(null);
  const showTransitRoute = stage === "in_transit" || stage === "delivered";
  const showRequestRoute =
    stage === "payment_required" ||
    stage === "searching" ||
    stage === "no_candidate_found" ||
    stage === "timeout_converted_to_pool" ||
    stage === "bidding_open";
  const routeFrom = showTransitRoute || showRequestRoute ? pickup : current;
  const routeTo = showTransitRoute || showRequestRoute ? dropoff : pickup;

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
    current !== null &&
    stage !== "searching" &&
    stage !== "no_candidate_found" &&
    stage !== "bidding_open";

  const center = useMemo(() => resolveCenter(fitCoords), [fitCoords]);
  const routeCoords = useMemo(
    () => (routeFrom && routeTo ? [routeFrom, routeTo] : []),
    [routeFrom, routeTo],
  );

  useEffect(() => {
    if (!mapRef.current || fitCoords.length === 0) return;
    if (fitCoords.length === 1) {
      mapRef.current.animateToRegion(toRegion(fitCoords[0]!), 280);
      return;
    }
    mapRef.current.fitToCoordinates(fitCoords.map(toMapCoord), {
      animated: true,
      edgePadding: { bottom: 48, left: 48, right: 48, top: 48 },
    });
  }, [fitCoords]);

  if (hasGoogleKey()) {
    return (
      <View className="h-60 overflow-hidden rounded-[30px] border border-app-outline">
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={toRegion(center)}
          customMapStyle={scheme === "dark" ? DARK_MAP_STYLE : undefined}
          showsCompass={false}
          showsMyLocationButton={false}
          toolbarEnabled={false}
        >
          {routeCoords.length > 1 ? (
            <Polyline
              coordinates={routeCoords.map(toMapCoord)}
              strokeColor={colors.info}
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
          ) : null}
          {pickup ? (
            <Marker
              coordinate={toMapCoord(pickup)}
              title="Konumun"
              pinColor={colors.success}
            />
          ) : null}
          {dropoff ? (
            <Marker
              coordinate={toMapCoord(dropoff)}
              title="Varış"
              pinColor={colors.critical}
            />
          ) : null}
          {showTruck && current ? (
            <Marker
              coordinate={toMapCoord(current)}
              title="Çekici"
              pinColor={colors.info}
              rotation={truckHeading}
            />
          ) : null}
        </MapView>
      </View>
    );
  }

  return (
    <FallbackMapView
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
    </FallbackMapView>
  );
}

const DARK_MAP_STYLE = [
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
