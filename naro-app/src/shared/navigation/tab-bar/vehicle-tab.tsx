import { useNaroTheme } from "@naro/ui";
import type { ReactNode } from "react";
import { Image, Text as RNText, View } from "react-native";

import type { Vehicle } from "@/features/vehicles";

export type VehicleTabIdentity =
  | { kind: "thumbnail"; uri: string }
  | { kind: "plate"; label: string }
  | { kind: "profile" };

export function getVehiclePlatePreview(plate: string | undefined | null) {
  if (!plate) return null;

  const parts = plate
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .map((entry) => entry.replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean);

  const alphaNumericPart = parts.find(
    (entry) => /[A-Z]/.test(entry) && !/^\d+$/.test(entry),
  );

  if (!alphaNumericPart) return null;

  const preview = alphaNumericPart.slice(0, 3);
  return preview.length > 0 ? preview : null;
}

export function getVehicleTabIdentity(
  vehicle: Pick<Vehicle, "plate" | "tabThumbnailUri"> | null | undefined,
): VehicleTabIdentity {
  const thumbnailUri = vehicle?.tabThumbnailUri?.trim();
  if (thumbnailUri) {
    return { kind: "thumbnail", uri: thumbnailUri };
  }

  const preview = getVehiclePlatePreview(vehicle?.plate);
  if (preview) {
    return { kind: "plate", label: preview };
  }

  return { kind: "profile" };
}

type VehicleProfileTabVisualProps = {
  vehicle: Pick<Vehicle, "plate" | "tabThumbnailUri"> | null | undefined;
  focused: boolean;
  fallback: ReactNode;
};

export function VehicleProfileTabVisual({
  vehicle,
  focused,
  fallback,
}: VehicleProfileTabVisualProps) {
  const identity = getVehicleTabIdentity(vehicle);
  const { colors, scheme } = useNaroTheme();
  const quietBorder = scheme === "dark" ? "#31405d" : colors.outlineStrong;
  const quietSurface = scheme === "dark" ? "#11192b" : colors.surface2;
  const focusedPlateSurface =
    scheme === "dark" ? "rgba(40, 194, 255, 0.12)" : colors.infoSoft;

  if (identity.kind === "thumbnail") {
    return (
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 10,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: focused ? "rgba(66, 196, 255, 0.52)" : quietBorder,
          backgroundColor: quietSurface,
        }}
      >
        <Image
          source={{ uri: identity.uri }}
          resizeMode="cover"
          style={{ width: "100%", height: "100%" }}
        />
      </View>
    );
  }

  if (identity.kind === "plate") {
    return (
      <View
        style={{
          minWidth: 34,
          height: 28,
          paddingHorizontal: 7,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: focused ? "rgba(66, 196, 255, 0.52)" : quietBorder,
          backgroundColor: focused ? focusedPlateSurface : quietSurface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <RNText
          style={{
            color: focused ? colors.text : colors.textMuted,
            fontSize: 10,
            fontWeight: "800",
            letterSpacing: 0,
          }}
        >
          {identity.label}
        </RNText>
      </View>
    );
  }

  return <>{fallback}</>;
}
