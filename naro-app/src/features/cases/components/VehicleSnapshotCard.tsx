import { Icon, Text } from "@naro/ui";
import { CarFront } from "lucide-react-native";
import { View } from "react-native";

import type { VehicleSnapshotResponse } from "../schemas/case-create";

/**
 * Canonical vehicle snapshot render — BE `CaseDetailResponse.vehicle_snapshot`.
 * Subtype tablolarındaki immutable 7-alan snapshot'tan okunur.
 *
 * QA tur 0 T4 fix (2026-04-23) — önceki `VehicleDetailSection` mock
 * `getTrackingVehicleMeta(vehicleId)` lookup'ına dayanıyordu; canonical
 * akışta plaka/marka/model/yıl görünmüyordu.
 */
type Props = {
  snapshot: VehicleSnapshotResponse | null | undefined;
};

export function VehicleSnapshotCard({ snapshot }: Props) {
  if (!snapshot) return null;
  const titleParts = [snapshot.make, snapshot.model].filter(
    (v): v is string => Boolean(v),
  );
  const titleText = titleParts.join(" ");
  const subtitleParts = [
    snapshot.year ? `${snapshot.year}` : null,
    snapshot.fuel_type,
    snapshot.current_km ? `${snapshot.current_km.toLocaleString("tr-TR")} km` : null,
  ].filter((v): v is string => Boolean(v));

  return (
    <View className="flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5">
      <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-500/15">
        <Icon icon={CarFront} size={18} color="#83a7ff" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="label" tone="inverse" className="text-[14px]">
          {snapshot.plate}
        </Text>
        {titleText ? (
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px]"
            numberOfLines={1}
          >
            {titleText}
            {subtitleParts.length > 0 ? ` · ${subtitleParts.join(" · ")}` : ""}
          </Text>
        ) : subtitleParts.length > 0 ? (
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px]"
            numberOfLines={1}
          >
            {subtitleParts.join(" · ")}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
