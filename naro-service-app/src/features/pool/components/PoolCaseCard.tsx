import type { ServiceCase } from "@naro/domain";
import { getTrackingVehicleMeta } from "@naro/mobile-core";
import { Button, Icon, StatusChip, Text, TrustBadge } from "@naro/ui";
import { Car, ChevronRight, Image as ImageIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";

import {
  BREAKDOWN_LABEL,
  CASE_KIND_META,
  DAMAGE_AREA_LABEL,
  URGENCY_META,
} from "@/features/cases";

type PoolCaseCardProps = {
  caseItem: ServiceCase;
  onPress?: () => void;
  onOffer?: () => void;
};

export function PoolCaseCard({ caseItem, onPress, onOffer }: PoolCaseCardProps) {
  const kindMeta = CASE_KIND_META[caseItem.kind];
  const urgencyMeta = URGENCY_META[caseItem.request.urgency];
  const vehicle = getTrackingVehicleMeta(caseItem.vehicle_id);
  const attachmentCount = caseItem.attachments.length;
  const offerCount = caseItem.offers.length;

  const subline: string[] = [];
  if (caseItem.kind === "accident" && caseItem.request.damage_area) {
    subline.push(
      DAMAGE_AREA_LABEL[caseItem.request.damage_area] ??
        caseItem.request.damage_area,
    );
  }
  if (caseItem.kind === "breakdown" && caseItem.request.breakdown_category) {
    subline.push(
      BREAKDOWN_LABEL[caseItem.request.breakdown_category] ??
        caseItem.request.breakdown_category,
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${caseItem.title} detayını aç`}
      onPress={onPress}
      className="gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4 active:bg-app-surface-2"
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-row flex-wrap items-center gap-1.5">
          <TrustBadge label={kindMeta.label} tone={kindMeta.tone} />
          <StatusChip label={urgencyMeta.label} tone={urgencyMeta.tone} />
          {offerCount > 0 ? (
            <TrustBadge label={`${offerCount} teklif`} tone="accent" />
          ) : null}
        </View>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-subtle text-[11px]"
        >
          {caseItem.created_at_label}
        </Text>
      </View>

      <View className="gap-1">
        <Text
          variant="label"
          tone="inverse"
          className="text-[15px] leading-[19px]"
          numberOfLines={2}
        >
          {caseItem.title}
        </Text>
        {subline.length > 0 ? (
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px]"
          >
            {subline.join(" · ")}
          </Text>
        ) : null}
        {caseItem.summary ? (
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px] leading-[17px]"
            numberOfLines={2}
          >
            {caseItem.summary}
          </Text>
        ) : null}
      </View>

      {vehicle ? (
        <View className="flex-row items-center gap-2 rounded-[14px] border border-app-outline bg-app-surface-2 px-3 py-2">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-500/15">
            <Icon icon={Car} size={14} color="#f45f25" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text
              variant="caption"
              tone="inverse"
              className="text-[12px]"
              numberOfLines={1}
            >
              {vehicle.plate} · {vehicle.vehicleLabel}
            </Text>
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-subtle text-[10px]"
              numberOfLines={1}
            >
              {maskCustomerName(vehicle.customerName)}
              {attachmentCount > 0 ? ` · ${attachmentCount} dosya` : ""}
            </Text>
          </View>
        </View>
      ) : attachmentCount > 0 ? (
        <View className="flex-row items-center gap-1.5 self-start rounded-full border border-app-outline bg-app-surface-2 px-2.5 py-1">
          <Icon icon={ImageIcon} size={11} color="#83a7ff" />
          <Text variant="caption" tone="muted" className="text-[11px]">
            {attachmentCount} dosya
          </Text>
        </View>
      ) : null}

      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-1">
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-subtle text-[11px]"
          >
            Detayları incele
          </Text>
          <Icon icon={ChevronRight} size={12} color="#83a7ff" />
        </View>
        {onOffer ? (
          <View className="min-w-[140px]">
            <Button label="Teklif Gönder" size="sm" onPress={onOffer} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function maskCustomerName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1]!.charAt(0)}.`;
}
