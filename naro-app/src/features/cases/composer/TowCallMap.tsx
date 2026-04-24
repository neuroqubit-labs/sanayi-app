import type { LatLng } from "@naro/domain";
import {
  DEFAULT_CENTER,
  Icon,
  MapView as FallbackMapView,
  PinMarker,
  RouteLine,
  Text,
  useNaroTheme,
  withAlphaHex,
} from "@naro/ui";
import { LocateFixed, MapPin, Navigation } from "lucide-react-native";
import { useEffect, useMemo, useRef } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type MapPressEvent,
  type Region,
} from "react-native-maps";

import { env } from "@/runtime";

type TowCallMapProps = {
  pickup: LatLng | null;
  dropoff: LatLng | null;
  routeCoords?: LatLng[] | null;
  activePoint: "pickup" | "dropoff";
  picking: boolean;
  onMapPress: (coord: LatLng) => void;
  onCenterChange?: (coord: LatLng) => void;
  onUseGps: () => void;
  gpsLoading?: boolean;
};

const DEFAULT_DELTA = {
  latitudeDelta: 0.075,
  longitudeDelta: 0.075,
};

function midpoint(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

function resolveCenter(pickup: LatLng | null, dropoff: LatLng | null): LatLng {
  if (pickup && dropoff) return midpoint(pickup, dropoff);
  return pickup ?? dropoff ?? DEFAULT_CENTER;
}

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

function fromRegion(region: Region): LatLng {
  return { lat: region.latitude, lng: region.longitude };
}

function hasGoogleKey() {
  return Platform.OS === "ios"
    ? Boolean(env.googleMapsIosApiKey)
    : Boolean(env.googleMapsAndroidApiKey);
}

export function TowCallMap({
  pickup,
  dropoff,
  routeCoords,
  activePoint,
  picking,
  onMapPress,
  onCenterChange,
  onUseGps,
  gpsLoading = false,
}: TowCallMapProps) {
  const { colors, scheme } = useNaroTheme();
  const mapRef = useRef<MapView | null>(null);
  const center = useMemo(
    () => resolveCenter(pickup, dropoff),
    [dropoff, pickup],
  );
  const fitCoords = useMemo(
    () => [pickup, dropoff].filter(Boolean) as LatLng[],
    [dropoff, pickup],
  );
  const lineCoords = useMemo(() => {
    if (routeCoords && routeCoords.length > 1) return routeCoords;
    if (pickup && dropoff) return [pickup, dropoff];
    return [];
  }, [dropoff, pickup, routeCoords]);

  useEffect(() => {
    if (picking) {
      onCenterChange?.(center);
    }
  }, [center, onCenterChange, picking]);

  useEffect(() => {
    if (!mapRef.current || picking || fitCoords.length === 0) return;
    if (fitCoords.length === 1) {
      mapRef.current.animateToRegion(toRegion(fitCoords[0]!), 280);
      return;
    }
    mapRef.current.fitToCoordinates(fitCoords.map(toMapCoord), {
      animated: true,
      edgePadding: { bottom: 260, left: 56, right: 56, top: 136 },
    });
  }, [fitCoords, picking]);

  if (!hasGoogleKey()) {
    return (
      <View className="flex-1">
        <FallbackMapView
          className="h-full w-full rounded-none border-0"
          theme={scheme === "dark" ? "dark" : "light"}
          center={center}
          fitCoords={fitCoords.length > 0 ? fitCoords : undefined}
          hideFallbackBadge
        >
          {lineCoords.length > 1 ? (
            <RouteLine coords={lineCoords} dotCount={24} />
          ) : null}
          {pickup ? (
            <PinMarker kind="pickup" coord={pickup} label="Alım" size="lg" />
          ) : null}
          {dropoff ? (
            <PinMarker
              kind="dropoff"
              coord={dropoff}
              label="Teslim"
              size="lg"
            />
          ) : null}
        </FallbackMapView>
        {picking ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${activePoint === "pickup" ? "Alım" : "Teslim"} noktasını harita merkezinden seç`}
            className="absolute inset-0"
            onPress={() => onMapPress(center)}
          />
        ) : null}
        {picking ? <MapCenterPin activePoint={activePoint} /> : null}
        {!picking ? (
          <DevFallbackBadge label="Google Maps key yok; dev fallback" />
        ) : null}
        <GpsButton onPress={onUseGps} loading={gpsLoading} />
      </View>
    );
  }

  const handlePress = (event: MapPressEvent) => {
    if (!picking) return;
    onMapPress({
      lat: event.nativeEvent.coordinate.latitude,
      lng: event.nativeEvent.coordinate.longitude,
    });
  };

  const handleRegionChangeComplete = (region: Region) => {
    if (!picking) return;
    onCenterChange?.(fromRegion(region));
  };

  return (
    <View className="flex-1">
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={toRegion(center)}
        customMapStyle={scheme === "dark" ? DARK_MAP_STYLE : undefined}
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        onPress={handlePress}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {lineCoords.length > 1 ? (
          <Polyline
            coordinates={lineCoords.map(toMapCoord)}
            strokeColor={colors.info}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}
        {pickup ? (
          <Marker
            coordinate={toMapCoord(pickup)}
            title="Alım"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <MapPinBubble tone="pickup" label="Alım" />
          </Marker>
        ) : null}
        {dropoff ? (
          <Marker
            coordinate={toMapCoord(dropoff)}
            title="Teslim"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <MapPinBubble tone="dropoff" label="Teslim" />
          </Marker>
        ) : null}
      </MapView>
      {picking ? <MapCenterPin activePoint={activePoint} /> : null}
      <GpsButton onPress={onUseGps} loading={gpsLoading} />
    </View>
  );
}

function MapPinBubble({
  tone,
  label,
}: {
  tone: "pickup" | "dropoff";
  label: string;
}) {
  const { colors } = useNaroTheme();
  const color = tone === "pickup" ? colors.success : colors.info;
  return (
    <View className="items-center">
      <View
        className="h-10 w-10 items-center justify-center rounded-full border-2"
        style={{
          backgroundColor: withAlphaHex(color, 0.18),
          borderColor: withAlphaHex(color, 0.76),
        }}
      >
        <Icon
          icon={tone === "pickup" ? LocateFixed : MapPin}
          size={18}
          color={color}
        />
      </View>
      <View
        className="mt-1 rounded-full px-2 py-0.5"
        style={{ backgroundColor: withAlphaHex(colors.bg, 0.78) }}
      >
        <Text variant="caption" tone="inverse" className="text-[10px]">
          {label}
        </Text>
      </View>
    </View>
  );
}

function MapCenterPin({ activePoint }: { activePoint: "pickup" | "dropoff" }) {
  const { colors } = useNaroTheme();
  const isPickup = activePoint === "pickup";
  const color = isPickup ? colors.success : colors.info;
  return (
    <View
      pointerEvents="none"
      className="absolute left-1/2 top-1/2 items-center"
    >
      <View
        className="h-11 w-11 items-center justify-center rounded-full border-2"
        style={{
          backgroundColor: withAlphaHex(color, 0.17),
          borderColor: withAlphaHex(color, 0.76),
          transform: [{ translateX: -22 }, { translateY: -40 }],
        }}
      >
        <Icon
          icon={isPickup ? LocateFixed : Navigation}
          size={19}
          color={color}
        />
      </View>
      <View
        className="h-3 w-3 rounded-full"
        style={{
          backgroundColor: color,
          transform: [{ translateX: -6 }, { translateY: -41 }],
        }}
      />
    </View>
  );
}

function GpsButton({
  onPress,
  loading,
}: {
  onPress: () => void;
  loading: boolean;
}) {
  const { colors } = useNaroTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Konumumu kullan"
      hitSlop={8}
      onPress={onPress}
      className="absolute right-4 top-[112px] h-11 w-11 items-center justify-center rounded-full border border-app-outline bg-app-surface active:bg-app-surface-2"
      disabled={loading}
    >
      <Icon
        icon={LocateFixed}
        size={18}
        color={loading ? colors.textSubtle : colors.info}
      />
    </Pressable>
  );
}

function DevFallbackBadge({ label }: { label: string }) {
  const { colors } = useNaroTheme();
  return (
    <View
      pointerEvents="none"
      className="absolute left-4 top-[112px] rounded-full border border-app-outline px-3 py-1.5"
      style={{ backgroundColor: withAlphaHex(colors.surface, 0.84) }}
    >
      <Text variant="caption" tone="muted" className="text-[11px]">
        {label}
      </Text>
    </View>
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
