import type { ServiceCase } from "@naro/domain";
import { getTrackingVehicleMeta } from "@naro/mobile-core";
import { Icon, Text, TrustBadge, type StatusChipTone } from "@naro/ui";
import { ChevronRight } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { CASE_KIND_META } from "@/features/cases";

import { maskCustomerName } from "./helpers";

type Props = {
  caseItem: ServiceCase;
  onPress: () => void;
  trailingBadge?: { label: string; tone: StatusChipTone };
  meta?: string;
  titleOverride?: string;
  subtitleOverride?: string;
  trailing?: ReactNode;
};

export function HomeCaseRow({
  caseItem,
  onPress,
  trailingBadge,
  meta,
  titleOverride,
  subtitleOverride,
  trailing,
}: Props) {
  const kindMeta = CASE_KIND_META[caseItem.kind];
  const vehicle = getTrackingVehicleMeta(caseItem.vehicle_id);

  const title = titleOverride ?? caseItem.title;
  const subtitle =
    subtitleOverride ??
    [
      vehicle ? maskCustomerName(vehicle.customerName) : null,
      vehicle?.plate,
      vehicle?.vehicleLabel,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} vakasını aç`}
      onPress={onPress}
      className="flex-row items-start gap-3 rounded-[18px] border border-app-outline bg-app-surface px-4 py-3.5 active:bg-app-surface-2"
    >
      <View
        className={`h-11 w-11 items-center justify-center rounded-full ${kindMeta.softBg}`}
      >
        <Icon icon={kindMeta.icon} size={18} color={kindMeta.iconColor} />
      </View>
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <TrustBadge label={kindMeta.label} tone={kindMeta.tone} />
          {meta ? (
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-subtle text-[11px]"
            >
              {meta}
            </Text>
          ) : null}
        </View>
        <Text
          variant="label"
          tone="inverse"
          className="text-[14px] leading-[18px]"
          numberOfLines={2}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px]"
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View className="items-end gap-1.5">
        {trailingBadge ? (
          <TrustBadge
            label={trailingBadge.label}
            tone={trailingBadge.tone}
          />
        ) : null}
        {trailing}
        <Icon icon={ChevronRight} size={14} color="#6f7b97" />
      </View>
    </Pressable>
  );
}
