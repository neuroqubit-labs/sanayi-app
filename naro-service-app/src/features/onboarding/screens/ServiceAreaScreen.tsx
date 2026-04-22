import type { DistrictRef } from "@naro/domain";
import { suggestDistrictsInRadius } from "@naro/domain";
import {
  BackButton,
  Button,
  Icon,
  MapControlCluster,
  MapView,
  PinMarker,
  RadiusCircle,
  Screen,
  Text,
  ToggleChip,
  useMapPicker,
} from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import { Locate, MapPin, Minus, Plus } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";

import { useOnboardingStore } from "../store";

const RADIUS_OPTIONS = [5, 10, 15, 25, 50] as const;
const ZOOM_MIN = 9;
const ZOOM_MAX = 15;

export default function ServiceAreaScreen() {
  const router = useRouter();
  const serviceArea = useOnboardingStore((s) => s.service_area);
  const updateServiceArea = useOnboardingStore((s) => s.updateServiceArea);

  const initialCoord = serviceArea.workshop_lat_lng;
  const picker = useMapPicker({ initialCoord });

  const [zoom, setZoom] = useState(13);
  const [containerSize, setContainerSize] = useState({ width: 1, height: 1 });

  const pickerCoord = picker.coord;

  // Zustand store'a senkronize et — workshop pin değişince
  useEffect(() => {
    if (
      pickerCoord &&
      (pickerCoord.lat !== serviceArea.workshop_lat_lng?.lat ||
        pickerCoord.lng !== serviceArea.workshop_lat_lng?.lng)
    ) {
      updateServiceArea({
        workshop_lat_lng: pickerCoord,
        workshop_address: picker.address?.address ?? serviceArea.workshop_address,
        city_code:
          picker.address?.city === "İstanbul"
            ? "34"
            : picker.address?.city === "Ankara"
              ? "06"
              : picker.address?.city === "İzmir"
                ? "35"
                : serviceArea.city_code,
      });
    }
  }, [pickerCoord, picker.address, serviceArea, updateServiceArea]);

  const suggestedDistricts = useMemo(() => {
    if (!pickerCoord) return [];
    return suggestDistrictsInRadius(
      pickerCoord.lat,
      pickerCoord.lng,
      serviceArea.service_radius_km,
      serviceArea.city_code ?? undefined,
    );
  }, [pickerCoord, serviceArea.service_radius_km, serviceArea.city_code]);

  const toggleDistrict = useCallback(
    (ref: DistrictRef) => {
      const exists = serviceArea.working_districts.some((d) => d.id === ref.id);
      updateServiceArea({
        working_districts: exists
          ? serviceArea.working_districts.filter((d) => d.id !== ref.id)
          : [...serviceArea.working_districts, ref],
      });
    },
    [serviceArea.working_districts, updateServiceArea],
  );

  const setRadius = useCallback(
    (km: number) => {
      updateServiceArea({ service_radius_km: km });
    },
    [updateServiceArea],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize({ width, height });
  };

  const handleMapTap = useCallback(
    (event: GestureResponderEvent) => {
      if (!pickerCoord || containerSize.width < 2) return;
      const tapX = event.nativeEvent.locationX;
      const tapY = event.nativeEvent.locationY;
      const centerX = containerSize.width / 2;
      const centerY = containerSize.height / 2;
      const visibleKm = 2 ** (15 - zoom);
      const kmPerPxX = (visibleKm * 2) / containerSize.width;
      const kmPerPxY = (visibleKm * 2) / containerSize.height;
      const dxKm = (tapX - centerX) * kmPerPxX;
      const dyKm = (tapY - centerY) * kmPerPxY;
      picker.setCoord({
        lat: pickerCoord.lat - dyKm * 0.009,
        lng: pickerCoord.lng + dxKm * 0.012,
      });
    },
    [pickerCoord, containerSize, zoom, picker],
  );

  const canContinue = pickerCoord !== null;

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-4 pb-28">
      <View className="flex-row items-center gap-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="subtle">
            Adım 6 / 7 · Servis alanı
          </Text>
          <Text variant="h2" tone="inverse">
            Nerede çalışıyorsun?
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px]"
          >
            Atölye konumun + hizmet yarıçapın. Havuz eşleştirmesi bu alana göre
            çalışır.
          </Text>
        </View>
      </View>

      <Pressable
        onPress={handleMapTap}
        onLayout={handleLayout}
        accessibilityRole="adjustable"
        accessibilityLabel="Haritaya dokunarak atölye konumunu değiştir"
      >
        <View style={{ height: 260 }}>
          <MapView
            center={pickerCoord ?? undefined}
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
                    onPress: () => picker.requestGps(),
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
            {pickerCoord ? (
              <>
                <RadiusCircle
                  center={pickerCoord}
                  radiusKm={serviceArea.service_radius_km}
                />
                <PinMarker
                  kind="workshop"
                  coord={pickerCoord}
                  size="lg"
                  label="Atölye"
                />
              </>
            ) : null}
          </MapView>
        </View>
      </Pressable>

      {!pickerCoord ? (
        <View className="flex-row items-center gap-2 rounded-[18px] border border-dashed border-app-outline bg-app-surface-2 px-4 py-3">
          <Icon icon={MapPin} size={14} color="#83a7ff" />
          <Text
            variant="caption"
            tone="muted"
            className="flex-1 text-app-text-muted text-[12px]"
          >
            "Konumumu kullan" butonuna bas veya haritaya dokunarak atölye
            konumunu belirle.
          </Text>
        </View>
      ) : null}

      {picker.address?.address ? (
        <View className="rounded-[18px] border border-app-outline bg-app-surface px-4 py-3">
          <Text variant="eyebrow" tone="subtle">
            Adres
          </Text>
          <Text
            variant="label"
            tone="inverse"
            className="text-[13px]"
            numberOfLines={2}
          >
            {picker.address.address}
          </Text>
        </View>
      ) : null}

      <View className="gap-2">
        <Text variant="eyebrow" tone="subtle">
          Hizmet yarıçapı
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {RADIUS_OPTIONS.map((km) => (
            <ToggleChip
              key={km}
              label={`${km} km`}
              selected={serviceArea.service_radius_km === km}
              onPress={() => setRadius(km)}
            />
          ))}
        </View>
      </View>

      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text variant="eyebrow" tone="subtle">
            Hizmet verilen ilçeler
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-subtle text-[11px]">
            {serviceArea.working_districts.length} seçili
          </Text>
        </View>
        {suggestedDistricts.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {suggestedDistricts.map((meta) => {
              const selected = serviceArea.working_districts.some(
                (d) => d.id === meta.id,
              );
              const ref: DistrictRef = {
                id: meta.id,
                city_code: meta.city_code,
                label: meta.label,
              };
              return (
                <ToggleChip
                  key={meta.id}
                  label={meta.label}
                  selected={selected}
                  onPress={() => toggleDistrict(ref)}
                />
              );
            })}
          </View>
        ) : (
          <View className="rounded-[16px] border border-dashed border-app-outline bg-app-surface-2 px-3 py-2.5">
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[12px]"
            >
              Bu yarıçap içinde otomatik öneri yok. Yarıçapı artır veya atölye
              konumunu değiştir.
            </Text>
          </View>
        )}
      </View>

      <Button
        label={canContinue ? "Devam et" : "Atölye konumu gerekli"}
        size="lg"
        disabled={!canContinue}
        variant={canContinue ? "primary" : "outline"}
        onPress={() => router.push("/(onboarding)/review" as Href)}
        fullWidth
      />
    </Screen>
  );
}

