import type { ServiceCase } from "@naro/domain";
import { getTrackingVehicleMeta } from "@naro/mobile-core";
import { ChevronRight, Image as ImageIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Icon } from "../Icon";
import { StatusChip } from "../StatusChip";
import { Text } from "../Text";
import { TrustBadge } from "../TrustBadge";

import { maskCustomerName } from "./helpers";
import {
  BREAKDOWN_LABEL,
  CASE_KIND_META,
  DAMAGE_AREA_LABEL,
  URGENCY_META,
} from "./kind-meta";

type Props = {
  caseItem: ServiceCase;
  onPress: () => void;
  label?: string;
};

export function VakaCard({ caseItem, onPress, label = "Vaka" }: Props) {
  const kindMeta = CASE_KIND_META[caseItem.kind];
  const urgencyMeta = URGENCY_META[caseItem.request.urgency];
  const vehicle = getTrackingVehicleMeta(caseItem.vehicle_id);
  const d = caseItem.request;
  const attachmentCount = caseItem.attachments.length;
  const hasPhoto = caseItem.attachments.some((a) => a.kind === "photo");

  const chips: {
    label: string;
    tone: "critical" | "warning" | "info" | "accent" | "success";
  }[] = [];
  if (caseItem.kind === "accident" && d.damage_area) {
    chips.push({
      label: DAMAGE_AREA_LABEL[d.damage_area] ?? d.damage_area,
      tone: "critical",
    });
  }
  if (caseItem.kind === "breakdown" && d.breakdown_category) {
    chips.push({
      label: BREAKDOWN_LABEL[d.breakdown_category] ?? d.breakdown_category,
      tone: "warning",
    });
  }
  if (d.kasko_selected) chips.push({ label: "Kasko", tone: "info" });
  if (d.towing_required) chips.push({ label: "Çekici", tone: "warning" });
  if (d.valet_requested) chips.push({ label: "Valet", tone: "accent" });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${caseItem.title} vaka profilini aç`}
      onPress={onPress}
      className="overflow-hidden rounded-[28px] border border-app-outline-strong bg-app-surface active:opacity-92"
      style={{ borderColor: `${kindMeta.iconColor}3a` }}
    >
      {/* Hero band — kind-colored soft gradient */}
      <View
        className="gap-3 px-5 pt-5 pb-4"
        style={{ backgroundColor: `${kindMeta.iconColor}15` }}
      >
        <View className="flex-row items-center justify-between">
          <Text variant="eyebrow" tone="subtle">
            {label}
          </Text>
          <View className="flex-row items-center gap-1">
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-subtle text-[11px]"
            >
              Hasar profilini aç
            </Text>
            <Icon icon={ChevronRight} size={13} color="#83a7ff" />
          </View>
        </View>

        <View className="flex-row items-start gap-4">
          <View
            className="h-24 w-24 items-center justify-center rounded-[22px]"
            style={{ backgroundColor: `${kindMeta.iconColor}26` }}
          >
            <Icon
              icon={kindMeta.icon}
              size={42}
              color={kindMeta.iconColor}
              strokeWidth={2.2}
            />
            {hasPhoto ? (
              <View className="absolute -bottom-1 -right-1 h-7 w-7 items-center justify-center rounded-full border-2 border-app-surface bg-app-surface-2">
                <Icon icon={ImageIcon} size={12} color="#83a7ff" />
              </View>
            ) : null}
          </View>

          <View className="flex-1 gap-1.5">
            <View className="flex-row flex-wrap items-center gap-1.5">
              <TrustBadge label={kindMeta.label} tone={kindMeta.tone} />
              <StatusChip label={urgencyMeta.label} tone={urgencyMeta.tone} />
            </View>
            <Text
              variant="h3"
              tone="inverse"
              className="text-[17px] leading-[22px]"
              numberOfLines={2}
            >
              {caseItem.title}
            </Text>
            {vehicle ? (
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[12px]"
                numberOfLines={1}
              >
                {maskCustomerName(vehicle.customerName)} · {vehicle.plate} ·{" "}
                {vehicle.vehicleLabel}
              </Text>
            ) : null}
          </View>
        </View>

        {caseItem.summary ? (
          <Text
            tone="muted"
            className="text-app-text-muted text-[12px] leading-[18px]"
            numberOfLines={2}
          >
            {caseItem.summary}
          </Text>
        ) : null}
      </View>

      {/* Footer — chips + attachment count */}
      {chips.length > 0 || attachmentCount > 0 ? (
        <View className="flex-row flex-wrap items-center gap-1.5 border-t border-app-outline bg-app-surface px-4 py-3">
          {chips.map((chip) => (
            <StatusChip key={chip.label} label={chip.label} tone={chip.tone} />
          ))}
          {attachmentCount > 0 ? (
            <View className="ml-auto flex-row items-center gap-1 rounded-full border border-app-outline bg-app-surface-2 px-2.5 py-1">
              <Icon icon={ImageIcon} size={11} color="#83a7ff" />
              <Text variant="caption" tone="muted" className="text-[11px]">
                {attachmentCount} dosya
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
