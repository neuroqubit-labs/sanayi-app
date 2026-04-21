import { MapPin, MapPinned, Truck } from "lucide-react-native";
import { View } from "react-native";

import { Icon } from "../../Icon";
import { StatusChip } from "../../StatusChip";
import { Text } from "../../Text";
import { CollapsibleSection } from "../CollapsibleSection";

import type { CaseCard } from "./types";

export const towSummaryCard: CaseCard = {
  id: "tow-summary",
  appliesTo: ["towing"],
  priority: 40,
  shouldShow: ({ caseItem }) => {
    const d = caseItem.request;
    return Boolean(
      d.location_label || d.dropoff_label || d.vehicle_drivable !== null,
    );
  },
  render: ({ caseItem }) => {
    const d = caseItem.request;
    const modeLabel = d.urgency === "urgent" ? "Hemen" : "Randevulu";
    const drivableLabel =
      d.vehicle_drivable === null
        ? null
        : d.vehicle_drivable
          ? "Sürülebiliyor"
          : "Sürülemiyor";

    return (
      <CollapsibleSection
        title="Çekici özeti"
        accent="#0ea5e9"
        titleIcon={Truck}
        description="Alınacak / varış noktası, araç durumu, mod"
        preview={
          <View className="flex-row flex-wrap gap-1.5">
            <StatusChip label={modeLabel} tone="accent" />
            {drivableLabel ? (
              <StatusChip
                label={drivableLabel}
                tone={d.vehicle_drivable ? "success" : "warning"}
              />
            ) : null}
          </View>
        }
      >
        <View className="gap-2">
          {d.location_label ? (
            <TowRow
              icon={MapPin}
              iconColor="#2dd28d"
              label="Alınacak"
              value={d.location_label}
            />
          ) : null}
          {d.dropoff_label ? (
            <TowRow
              icon={MapPinned}
              iconColor="#ff7e7e"
              label="Varış"
              value={d.dropoff_label}
            />
          ) : null}
          <TowRow
            icon={Truck}
            iconColor="#0ea5e9"
            label="Mod"
            value={modeLabel}
          />
          {drivableLabel ? (
            <TowRow
              icon={Truck}
              iconColor={d.vehicle_drivable ? "#2dd28d" : "#f5b33f"}
              label="Araç"
              value={drivableLabel}
            />
          ) : null}
        </View>
      </CollapsibleSection>
    );
  },
};

function TowRow({
  icon,
  iconColor,
  label,
  value,
}: {
  icon: typeof Truck;
  iconColor: string;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-start gap-3 rounded-[14px] border border-app-outline bg-app-surface px-3 py-2.5">
      <Icon icon={icon} size={14} color={iconColor} />
      <View className="flex-1 gap-0.5">
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-subtle text-[10px]"
        >
          {label}
        </Text>
        <Text variant="label" tone="inverse" className="text-[13px]">
          {value}
        </Text>
      </View>
    </View>
  );
}
