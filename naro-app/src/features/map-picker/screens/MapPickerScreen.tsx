import type { LatLng } from "@naro/domain";
import {
  BackButton,
  Button,
  Icon,
  MapControlCluster,
  MapView as FallbackMapView,
  PinMarker,
  Text,
  useMapPicker,
  useNaroTheme,
} from "@naro/ui";
import { useRouter } from "expo-router";
import { Locate, Plus, Minus } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import NativeMapView, {
  Marker,
  PROVIDER_GOOGLE,
  type MapPressEvent,
} from "react-native-maps";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import {
  DEFAULT_PICKER_CENTER,
  GOOGLE_DARK_MAP_STYLE,
  hasGoogleMapKey,
  toMapCoord,
  toRegion,
} from "../mapSurface";
import { useMapPickerBridge } from "../store";

const ZOOM_MIN = 10;
const ZOOM_MAX = 17;

/**
 * Full-screen harita picker. Bridge store'daki `initialCoord` ile açılır.
 * Kullanıcı merkez pin'i sürükleyerek konumu değiştirir (fallback: tap-to-set).
 * "Onayla" → `bridge.commit` + `router.back()`; "Vazgeç" → `bridge.cancel`.
 */
export function MapPickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useNaroTheme();
  const bridge = useMapPickerBridge();
  const purpose = useMapPickerBridge((s) => s.purpose);
  const initial = useMapPickerBridge((s) => s.initialCoord);

  const picker = useMapPicker({ initialCoord: initial });
  const mapRef = useRef<NativeMapView | null>(null);
  const [zoom, setZoom] = useState(14);
  const [containerSize, setContainerSize] = useState({ width: 1, height: 1 });
  const mapCenter = picker.coord ?? initial ?? DEFAULT_PICKER_CENTER;
  const useGoogleMap = hasGoogleMapKey();

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize({ width, height });
  };

  const handleTap = useCallback(
    (event: GestureResponderEvent) => {
      if (containerSize.width < 2) return;
      const tapX = event.nativeEvent.locationX;
      const tapY = event.nativeEvent.locationY;
      const centerX = containerSize.width / 2;
      const centerY = containerSize.height / 2;

      // ~1 derece lng ≈ zoom'a göre scale — kabaca
      const radiusKm = 2 ** (15 - zoom);
      const kmPerPxX = (radiusKm * 2) / containerSize.width;
      const kmPerPxY = (radiusKm * 2) / containerSize.height;
      const dxKm = (tapX - centerX) * kmPerPxX;
      const dyKm = (tapY - centerY) * kmPerPxY;
      // 1 km lat ≈ 0.009°, 1 km lng ≈ 0.012° (Türkiye enleminde yaklaşık)
      const next: LatLng = {
        lat: mapCenter.lat - dyKm * 0.009,
        lng: mapCenter.lng + dxKm * 0.012,
      };
      picker.setCoord(next);
    },
    [picker, containerSize, mapCenter, zoom],
  );

  const handleNativePress = useCallback(
    (event: MapPressEvent) => {
      picker.setCoord({
        lat: event.nativeEvent.coordinate.latitude,
        lng: event.nativeEvent.coordinate.longitude,
      });
    },
    [picker],
  );

  const handleZoom = useCallback(
    (nextZoom: number) => {
      setZoom(nextZoom);
      mapRef.current?.animateToRegion(toRegion(mapCenter, nextZoom), 180);
    },
    [mapCenter],
  );

  const handleConfirm = () => {
    if (!picker.coord) return;
    bridge.commit({
      coord: picker.coord,
      address: picker.address?.address ?? formatCoord(picker.coord),
      short_label: picker.address?.short_label,
    });
    router.back();
  };

  const handleCancel = () => {
    bridge.cancel();
    router.back();
  };

  const handleGps = async () => {
    await picker.requestGps();
  };

  const title = {
    pickup: "Konumunu seç",
    dropoff: "Varış noktasını seç",
    vehicle_home: "Araç park noktası",
    custom: "Konum seç",
  }[purpose];

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-app-bg">
      <View className="flex-row items-center gap-3 px-5 pb-3 pt-2">
        <BackButton onPress={handleCancel} />
        <View className="flex-1 gap-0.5">
          <Text variant="eyebrow" tone="subtle">
            Harita
          </Text>
          <Text variant="h3" tone="inverse" className="text-[16px]">
            {title}
          </Text>
        </View>
      </View>

      {useGoogleMap ? (
        <View className="mx-4 mb-2 flex-1 overflow-hidden rounded-[30px] border border-app-outline">
          <NativeMapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            initialRegion={toRegion(mapCenter, zoom)}
            customMapStyle={scheme === "dark" ? GOOGLE_DARK_MAP_STYLE : undefined}
            showsCompass={false}
            showsMyLocationButton={false}
            toolbarEnabled={false}
            onPress={handleNativePress}
          >
            {picker.coord ? (
              <Marker
                coordinate={toMapCoord(picker.coord)}
                title={picker.address?.short_label ?? "Seçili konum"}
                pinColor={colors.success}
              />
            ) : null}
          </NativeMapView>
          <View className="absolute right-3 top-3">
            <NativeMapControlCluster
              scheme={scheme}
              buttons={[
                {
                  key: "gps",
                  icon: Locate,
                  accessibilityLabel: "Konumumu kullan",
                  onPress: handleGps,
                  active: picker.gpsFetching,
                  disabled: picker.gpsFetching,
                },
                {
                  key: "zoom-in",
                  icon: Plus,
                  accessibilityLabel: "Yakınlaş",
                  onPress: () => handleZoom(Math.min(ZOOM_MAX, zoom + 1)),
                  disabled: zoom >= ZOOM_MAX,
                },
                {
                  key: "zoom-out",
                  icon: Minus,
                  accessibilityLabel: "Uzaklaş",
                  onPress: () => handleZoom(Math.max(ZOOM_MIN, zoom - 1)),
                  disabled: zoom <= ZOOM_MIN,
                },
              ]}
            />
          </View>
        </View>
      ) : (
        <Pressable
          onPress={handleTap}
          onLayout={handleLayout}
          accessibilityRole="adjustable"
          accessibilityLabel="Harita üzerinde dokunarak konum seç"
          className="mx-4 mb-2 flex-1"
        >
          <FallbackMapView
            center={mapCenter}
            zoom={zoom}
            theme="dark"
            className="flex-1"
            topRightOverlay={
              <MapControlCluster
                buttons={[
                  {
                    key: "gps",
                    icon: Locate,
                    accessibilityLabel: "Konumumu kullan",
                    onPress: handleGps,
                    active: picker.gpsFetching,
                    disabled: picker.gpsFetching,
                  },
                  {
                    key: "zoom-in",
                    icon: Plus,
                    accessibilityLabel: "Yakınlaş",
                    onPress: () => handleZoom(Math.min(ZOOM_MAX, zoom + 1)),
                    disabled: zoom >= ZOOM_MAX,
                  },
                  {
                    key: "zoom-out",
                    icon: Minus,
                    accessibilityLabel: "Uzaklaş",
                    onPress: () => handleZoom(Math.max(ZOOM_MIN, zoom - 1)),
                    disabled: zoom <= ZOOM_MIN,
                  },
                ]}
              />
            }
          >
            {picker.coord ? (
              <PinMarker
                kind={purpose === "dropoff" ? "dropoff" : "pickup"}
                coord={picker.coord}
                size="lg"
                label={picker.address?.short_label}
              />
            ) : null}
          </FallbackMapView>
        </Pressable>
      )}

      <View className="gap-2 border-t border-app-outline bg-app-surface px-5 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        {picker.address?.address ? (
          <View className="rounded-[14px] border border-app-outline bg-app-surface-2 px-3 py-2.5">
            <Text variant="caption" tone="muted" className="text-[11px] text-app-text-subtle">
              Seçili adres
            </Text>
            <Text variant="label" tone="inverse" className="text-[13px]" numberOfLines={2}>
              {picker.address.address}
            </Text>
          </View>
        ) : picker.coord ? (
          <View className="rounded-[14px] border border-app-outline bg-app-surface-2 px-3 py-2.5">
            <Text variant="caption" tone="muted" className="text-[11px]">
              {picker.addressLoading ? "Adres aranıyor…" : formatCoord(picker.coord)}
            </Text>
          </View>
        ) : (
          <View className="rounded-[14px] border border-dashed border-app-outline bg-app-surface-2 px-3 py-2.5">
            <Text variant="caption" tone="muted" className="text-[12px]">
              Haritaya dokun veya GPS düğmesiyle başla.
            </Text>
          </View>
        )}

        <View className="flex-row gap-2">
          <View className="flex-1">
            <Button
              label="Vazgeç"
              variant="outline"
              onPress={handleCancel}
              fullWidth
            />
          </View>
          <View className="flex-[1.6]">
            <Button
              label="Bu konumu kullan"
              onPress={handleConfirm}
              disabled={!picker.coord}
              fullWidth
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function formatCoord(coord: LatLng): string {
  return `${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}`;
}

type NativeMapControlButton = {
  key: string;
  icon: LucideIcon;
  accessibilityLabel: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
};

function NativeMapControlCluster({
  buttons,
  scheme,
}: {
  buttons: NativeMapControlButton[];
  scheme: "light" | "dark";
}) {
  const idleBackground =
    scheme === "dark" ? "rgba(15, 23, 42, 0.78)" : "rgba(255, 255, 255, 0.94)";
  const idleBorder =
    scheme === "dark" ? "rgba(148, 163, 184, 0.45)" : "#d7e2f1";
  const idleIcon = scheme === "dark" ? "#f8fafc" : "#111827";

  return (
    <View className="gap-2">
      {buttons.map((button) => (
        <Pressable
          key={button.key}
          accessibilityRole="button"
          accessibilityLabel={button.accessibilityLabel}
          disabled={button.disabled}
          onPress={button.onPress}
          className="items-center justify-center rounded-full border active:opacity-80"
          style={{
            width: 38,
            height: 38,
            backgroundColor: button.active ? "#e0f2fe" : idleBackground,
            borderColor: button.active ? "#38bdf8" : idleBorder,
            opacity: button.disabled ? 0.5 : 1,
          }}
        >
          <Icon
            icon={button.icon}
            size={15}
            color={button.active ? "#0ea5e9" : idleIcon}
          />
        </Pressable>
      ))}
    </View>
  );
}
