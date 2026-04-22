import type { LatLng } from "@naro/domain";
import {
  BackButton,
  Button,
  MapControlCluster,
  MapView,
  PinMarker,
  Text,
  useMapPicker,
} from "@naro/ui";
import { useRouter } from "expo-router";
import { Locate, Plus, Minus } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Pressable,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

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
  const bridge = useMapPickerBridge();
  const purpose = useMapPickerBridge((s) => s.purpose);
  const initial = useMapPickerBridge((s) => s.initialCoord);

  const picker = useMapPicker({ initialCoord: initial });
  const [zoom, setZoom] = useState(14);
  const [containerSize, setContainerSize] = useState({ width: 1, height: 1 });

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize({ width, height });
  };

  const handleTap = useCallback(
    (event: GestureResponderEvent) => {
      if (!picker.coord || containerSize.width < 2) return;
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
        lat: picker.coord.lat - dyKm * 0.009,
        lng: picker.coord.lng + dxKm * 0.012,
      };
      picker.setCoord(next);
    },
    [picker, containerSize, zoom],
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

      <Pressable
        onPress={handleTap}
        onLayout={handleLayout}
        accessibilityRole="adjustable"
        accessibilityLabel="Harita üzerinde dokunarak konum seç"
        className="flex-1 mx-4 mb-2"
      >
        <MapView
          center={picker.coord ?? undefined}
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
                  onPress: () => setZoom((z) => Math.min(ZOOM_MAX, z + 1)),
                  disabled: zoom >= ZOOM_MAX,
                },
                {
                  key: "zoom-out",
                  icon: Minus,
                  accessibilityLabel: "Uzaklaş",
                  onPress: () => setZoom((z) => Math.max(ZOOM_MIN, z - 1)),
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
        </MapView>
      </Pressable>

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
              Haritaya dokun veya "Konumumu kullan" ile başla.
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
