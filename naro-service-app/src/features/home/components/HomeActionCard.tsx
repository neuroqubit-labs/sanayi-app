import type { ServiceCase } from "@naro/domain";
import {
  buildTechnicianTrackingView,
  getTrackingVehicleMeta,
} from "@naro/mobile-core";
import { Icon, StatusChip, Text, TrustBadge } from "@naro/ui";
import type { StatusChipTone } from "@naro/ui";
import { ChevronRight } from "lucide-react-native";
import { Pressable, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import {
  BREAKDOWN_LABEL,
  CASE_KIND_META,
  DAMAGE_AREA_LABEL,
} from "@/features/cases";

import { maskCustomerName } from "./helpers";

type Props = {
  caseItem: ServiceCase;
  onPress: () => void;
  trailingBadge: { label: string; tone: StatusChipTone };
  titleOverride?: string;
  meta?: string;
};

const RING_SIZE = 64;
const RING_STROKE = 4;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const DISC_SIZE = 48;

export function HomeActionCard({
  caseItem,
  onPress,
  trailingBadge,
  titleOverride,
  meta,
}: Props) {
  const kindMeta = CASE_KIND_META[caseItem.kind];
  const vehicle = getTrackingVehicleMeta(caseItem.vehicle_id);
  const view = buildTechnicianTrackingView(caseItem);
  const progress = Math.max(0, Math.min(100, view.progressValue));
  const progressOffset =
    RING_CIRCUMFERENCE - (progress / 100) * RING_CIRCUMFERENCE;

  const title =
    titleOverride ?? view.primaryAction?.label ?? view.header.summaryTitle;

  const chips: { label: string; tone: "info" | "warning" | "critical" | "accent" }[] = [];
  if (caseItem.kind === "accident" && caseItem.request.damage_area) {
    chips.push({
      label: DAMAGE_AREA_LABEL[caseItem.request.damage_area] ?? caseItem.request.damage_area,
      tone: "critical",
    });
  }
  if (caseItem.kind === "breakdown" && caseItem.request.breakdown_category) {
    chips.push({
      label: BREAKDOWN_LABEL[caseItem.request.breakdown_category] ?? caseItem.request.breakdown_category,
      tone: "warning",
    });
  }
  if (caseItem.request.kasko_selected) chips.push({ label: "Kasko", tone: "info" });
  if (caseItem.request.towing_required) chips.push({ label: "Çekici", tone: "warning" });
  if (caseItem.request.valet_requested) chips.push({ label: "Valet", tone: "accent" });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} görevini aç`}
      onPress={onPress}
      className="flex-row items-start gap-3 rounded-[22px] border border-app-outline-strong bg-app-surface px-4 py-4 active:bg-app-surface-2"
    >
      {/* Progress ring + kind icon disc */}
      <View
        style={{
          width: RING_SIZE,
          height: RING_SIZE,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg
          width={RING_SIZE}
          height={RING_SIZE}
          style={{ position: "absolute" }}
        >
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke="#2a3446"
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={kindMeta.iconColor}
            strokeWidth={RING_STROKE}
            strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
            strokeDashoffset={progressOffset}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>
        <View
          style={{
            width: DISC_SIZE,
            height: DISC_SIZE,
            borderRadius: DISC_SIZE / 2,
            backgroundColor: `${kindMeta.iconColor}25`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon icon={kindMeta.icon} size={20} color={kindMeta.iconColor} />
        </View>
      </View>

      <View className="flex-1 gap-1.5">
        <View className="flex-row flex-wrap items-center gap-1.5">
          <TrustBadge label={kindMeta.label} tone={kindMeta.tone} />
          <TrustBadge label={trailingBadge.label} tone={trailingBadge.tone} />
          <Text
            variant="caption"
            tone="muted"
            className="ml-auto text-app-text-subtle text-[11px]"
          >
            %{Math.round(progress)}
          </Text>
        </View>
        <Text
          variant="label"
          tone="inverse"
          className="text-[15px] leading-[19px]"
          numberOfLines={2}
        >
          {title}
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
        {chips.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5">
            {chips.slice(0, 3).map((chip) => (
              <StatusChip key={chip.label} label={chip.label} tone={chip.tone} />
            ))}
          </View>
        ) : null}
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

      <Icon icon={ChevronRight} size={16} color="#6f7b97" />
    </Pressable>
  );
}
