import type { LatLng } from "@naro/domain";
import {
  Icon,
  StaticMapPreview,
  StatusChip,
  Text,
  useMapPicker,
} from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import {
  Building,
  Home,
  MapPin,
  Navigation,
  Pencil,
  Sparkles,
} from "lucide-react-native";
import { useCallback, useEffect, useId, useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import {
  useMapPickerBridge,
  type MapPickerPurpose,
} from "@/features/map-picker";

export type FrequentPlace = {
  id: string;
  label: string;
  address: string;
  kind: "home" | "work" | "previous";
  coord?: LatLng;
};

type Props = {
  value: string;
  onChange: (next: string) => void;
  description?: string;
  frequentPlaces?: FrequentPlace[];
  /** Default handler full-screen map modal açar; caller override edebilir. */
  onOpenMapPicker?: () => void;
  /** Şu an seçili koordinat — map preview pin'i için. */
  coord?: LatLng | null;
  /** Koordinat değişince caller çağrılır (GPS veya map pick). */
  onCoordChange?: (next: LatLng | null) => void;
  /** Modal purpose'u — pin rengi + başlık: pickup (default), dropoff, vb. */
  mapPurpose?: MapPickerPurpose;
};

const DEFAULT_FREQUENT_PLACES: FrequentPlace[] = [
  {
    id: "home",
    label: "Ev",
    address: "Maslak Mah. Sarıyer / İstanbul",
    kind: "home",
    coord: { lat: 41.112, lng: 29.022 },
  },
  {
    id: "work",
    label: "İş",
    address: "Levent 4. Lev · Beşiktaş / İstanbul",
    kind: "work",
    coord: { lat: 41.083, lng: 29.011 },
  },
  {
    id: "previous-1",
    label: "Önceki",
    address: "AutoPro Servis · Güngören Sanayi",
    kind: "previous",
    coord: { lat: 41.028, lng: 28.889 },
  },
];

export function LocationPicker({
  value,
  onChange,
  description,
  frequentPlaces = DEFAULT_FREQUENT_PLACES,
  onOpenMapPicker,
  coord = null,
  onCoordChange,
  mapPurpose = "pickup",
}: Props) {
  const [showManual, setShowManual] = useState(!value);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const router = useRouter();
  const session = useId();
  const bridge = useMapPickerBridge();
  const pendingResult = useMapPickerBridge((s) =>
    s.result?.session === session ? s.result : null,
  );

  const picker = useMapPicker({
    initialCoord: coord,
    frequentPlaces: frequentPlaces
      .filter((p): p is FrequentPlace & { coord: LatLng } => p.coord !== undefined)
      .map((p) => ({ id: p.id, label: p.label, coord: p.coord, short_label: p.address })),
    onChange: ({ coord: nextCoord, address }) => {
      onCoordChange?.(nextCoord);
      if (address?.address) {
        onChange(address.address);
      }
    },
  });

  // Caller koordinat prop'u değiştirirse picker state'i de sync olsun
  const pickerCoord = picker.coord;
  const pickerSetCoord = picker.setCoord;
  useEffect(() => {
    if (coord && (pickerCoord?.lat !== coord.lat || pickerCoord?.lng !== coord.lng)) {
      pickerSetCoord(coord);
    }
  }, [coord, pickerCoord, pickerSetCoord]);

  const handleUseCurrent = useCallback(async () => {
    const result = await picker.requestGps();
    if (!result.ok) {
      setPermissionDenied(result.reason === "permission_denied");
    } else {
      setPermissionDenied(false);
    }
  }, [picker]);

  const handleSelectFrequent = useCallback(
    (place: FrequentPlace) => {
      if (place.coord) {
        picker.setCoord(place.coord);
      }
      onChange(place.address);
      onCoordChange?.(place.coord ?? null);
      setShowManual(false);
    },
    [picker, onChange, onCoordChange],
  );

  // Default — modal'ı aç
  const handleOpenMap = useCallback(() => {
    if (onOpenMapPicker) {
      onOpenMapPicker();
      return;
    }
    bridge.open({
      session,
      initialCoord: picker.coord ?? coord ?? null,
      purpose: mapPurpose,
    });
    router.push("/(modal)/harita-sec" as Href);
  }, [onOpenMapPicker, bridge, session, picker.coord, coord, mapPurpose, router]);

  // Modal'dan gelen sonucu consume et
  useEffect(() => {
    if (!pendingResult) return;
    const consumed = bridge.consume(session);
    if (!consumed) return;
    picker.setCoord(consumed.coord);
    onCoordChange?.(consumed.coord);
    onChange(consumed.address);
    setShowManual(false);
    setPermissionDenied(false);
  }, [pendingResult, bridge, session, picker, onChange, onCoordChange]);

  return (
    <View className="gap-3 rounded-[22px] border border-app-outline bg-app-surface-2 px-4 py-4">
      <View className="gap-1">
        <Text variant="eyebrow" tone="subtle">
          Konum
        </Text>
        {description ? (
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px]"
          >
            {description}
          </Text>
        ) : null}
      </View>

      {/* Harita preview — coord varsa pin, yoksa skeleton */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Haritada seç"
        onPress={handleOpenMap}
        className="active:opacity-90"
      >
        {picker.coord ? (
          <StaticMapPreview
            height={132}
            pins={[
              {
                coord: picker.coord,
                kind: "pickup",
                label: picker.address?.short_label ?? "Seçili konum",
              },
            ]}
            bottomCaption={
              <Text
                variant="caption"
                tone="inverse"
                className="text-[11px]"
                numberOfLines={1}
              >
                📍 {value || picker.address?.address || "Konum seçildi"}
              </Text>
            }
          />
        ) : (
          <View className="relative h-32 overflow-hidden rounded-[18px] border border-app-outline bg-app-surface">
            <View className="absolute inset-0 opacity-25">
              {Array.from({ length: 4 }).map((_, i) => (
                <View
                  key={`h-${i}`}
                  className="absolute left-0 right-0 h-px bg-app-outline"
                  style={{ top: `${(i + 1) * 20}%` }}
                />
              ))}
              {Array.from({ length: 4 }).map((_, i) => (
                <View
                  key={`v-${i}`}
                  className="absolute bottom-0 top-0 w-px bg-app-outline"
                  style={{ left: `${(i + 1) * 20}%` }}
                />
              ))}
            </View>
            <View className="absolute inset-0 items-center justify-center">
              <View className="h-11 w-11 items-center justify-center rounded-full border-2 border-brand-500/40 bg-brand-500/20">
                <Icon icon={MapPin} size={20} color="#0ea5e9" />
              </View>
            </View>
            <View className="absolute bottom-2 left-2 right-2 rounded-full border border-dashed border-app-outline bg-app-surface/80 px-3 py-1.5">
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[11px]"
                numberOfLines={1}
              >
                {value ? `📍 ${value}` : "Haritadan seç veya aşağıdan doldur"}
              </Text>
            </View>
          </View>
        )}
      </Pressable>

      {/* Primary CTA — konumumu kullan (GPS) */}
      <View className="flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Konumumu kullan"
          onPress={handleUseCurrent}
          disabled={picker.gpsFetching}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-[16px] border border-brand-500/30 bg-brand-500/10 px-3 py-2.5 active:opacity-85"
        >
          <Icon icon={Navigation} size={14} color="#0ea5e9" />
          <Text variant="label" tone="accent" className="text-[13px]">
            {picker.gpsFetching ? "Bulunuyor..." : "Konumumu kullan"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Haritada değiştir"
          onPress={handleOpenMap}
          className="flex-row items-center justify-center gap-2 rounded-[16px] border border-app-outline bg-app-surface px-3 py-2.5 active:bg-app-surface-2"
        >
          <Icon icon={Pencil} size={13} color="#83a7ff" />
          <Text variant="label" tone="inverse" className="text-[12px]">
            Değiştir
          </Text>
        </Pressable>
      </View>

      {/* Sık kullanılan */}
      {frequentPlaces.length > 0 ? (
        <View className="gap-2">
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-subtle text-[11px]"
          >
            Sık kullanılan
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            {frequentPlaces.map((place) => (
              <FrequentPlaceChip
                key={place.id}
                place={place}
                onPress={() => handleSelectFrequent(place)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* Manuel fallback — permission denied veya toggle */}
      {showManual || permissionDenied ? (
        <View className="gap-1.5">
          {permissionDenied ? (
            <Pressable
              onPress={picker.permission.openSettings}
              accessibilityRole="button"
              accessibilityLabel="Ayarlara git"
            >
              <StatusChip
                label="Konum izni verilmedi — ayarlara git"
                tone="warning"
              />
            </Pressable>
          ) : null}
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="Semt / ilçe — ör. Maslak / Sarıyer"
            placeholderTextColor="#6f7b97"
            className="rounded-[16px] border border-app-outline bg-app-surface px-3.5 py-2.5 text-base text-app-text"
          />
        </View>
      ) : null}
    </View>
  );
}

function FrequentPlaceChip({
  place,
  onPress,
}: {
  place: FrequentPlace;
  onPress: () => void;
}) {
  const icon =
    place.kind === "home"
      ? Home
      : place.kind === "work"
        ? Building
        : Sparkles;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${place.label} — ${place.address}`}
      onPress={onPress}
      className="flex-row items-center gap-1.5 rounded-full border border-app-outline bg-app-surface px-2.5 py-1.5 active:bg-app-surface-2"
    >
      <Icon icon={icon} size={11} color="#83a7ff" />
      <Text variant="caption" tone="inverse" className="text-[11px]">
        {place.label}
      </Text>
    </Pressable>
  );
}
