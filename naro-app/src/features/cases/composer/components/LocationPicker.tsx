import { Icon, StatusChip, Text } from "@naro/ui";
import {
  Building,
  Home,
  MapPin,
  Navigation,
  Pencil,
  Sparkles,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

export type FrequentPlace = {
  id: string;
  label: string;
  address: string;
  kind: "home" | "work" | "previous";
};

type Props = {
  value: string;
  onChange: (next: string) => void;
  description?: string;
  frequentPlaces?: FrequentPlace[];
  onOpenMapPicker?: () => void;
  onUseCurrentLocation?: () => Promise<string | null> | string | null;
};

const DEFAULT_FREQUENT_PLACES: FrequentPlace[] = [
  {
    id: "home",
    label: "Ev",
    address: "Maslak Mah. Sarıyer / İstanbul",
    kind: "home",
  },
  {
    id: "work",
    label: "İş",
    address: "Levent 4. Lev · Beşiktaş / İstanbul",
    kind: "work",
  },
  {
    id: "previous-1",
    label: "Önceki",
    address: "AutoPro Servis · Güngören Sanayi",
    kind: "previous",
  },
];

export function LocationPicker({
  value,
  onChange,
  description,
  frequentPlaces = DEFAULT_FREQUENT_PLACES,
  onOpenMapPicker,
  onUseCurrentLocation,
}: Props) {
  const [showManual, setShowManual] = useState(!value);
  const [detecting, setDetecting] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const handleUseCurrent = async () => {
    setDetecting(true);
    try {
      if (onUseCurrentLocation) {
        const result = await onUseCurrentLocation();
        if (result) {
          onChange(result);
          setPermissionDenied(false);
        } else {
          setPermissionDenied(true);
        }
      } else {
        // V1 scaffold: gerçek expo-location yok; mock reverse geocode cevabı.
        await new Promise((resolve) => setTimeout(resolve, 400));
        onChange("Maslak Mah. Sarıyer / İstanbul");
      }
    } finally {
      setDetecting(false);
    }
  };

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

      {/* Harita preview scaffold — gerçek Mapbox V2'de devreye girer */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Haritada seç"
        onPress={onOpenMapPicker}
        className="relative h-32 overflow-hidden rounded-[18px] border border-app-outline bg-app-surface active:opacity-90"
      >
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
        {value ? (
          <View className="absolute bottom-2 left-2 right-2 rounded-full border border-app-outline bg-app-surface/90 px-3 py-1.5">
            <Text
              variant="caption"
              tone="inverse"
              className="text-[11px]"
              numberOfLines={1}
            >
              📍 {value}
            </Text>
          </View>
        ) : (
          <View className="absolute bottom-2 left-2 right-2 rounded-full border border-dashed border-app-outline bg-app-surface/80 px-3 py-1.5">
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[11px]"
              numberOfLines={1}
            >
              Haritadan seç veya aşağıdan doldur
            </Text>
          </View>
        )}
      </Pressable>

      {/* Primary CTA — konumumu kullan (GPS) */}
      <View className="flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Konumumu kullan"
          onPress={handleUseCurrent}
          disabled={detecting}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-[16px] border border-brand-500/30 bg-brand-500/10 px-3 py-2.5 active:opacity-85"
        >
          <Icon icon={Navigation} size={14} color="#0ea5e9" />
          <Text
            variant="label"
            tone="accent"
            className="text-[13px]"
          >
            {detecting ? "Bulunuyor..." : "Konumumu kullan"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Haritada değiştir"
          onPress={onOpenMapPicker ?? (() => setShowManual(true))}
          className="flex-row items-center justify-center gap-2 rounded-[16px] border border-app-outline bg-app-surface px-3 py-2.5 active:bg-app-surface-2"
        >
          <Icon icon={Pencil} size={13} color="#83a7ff" />
          <Text
            variant="label"
            tone="inverse"
            className="text-[12px]"
          >
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
                onPress={() => {
                  onChange(place.address);
                  setShowManual(false);
                }}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* Manuel fallback — permission denied veya toggle */}
      {showManual || permissionDenied ? (
        <View className="gap-1.5">
          {permissionDenied ? (
            <StatusChip
              label="Konum izni verilmedi — manuel yaz"
              tone="warning"
            />
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
