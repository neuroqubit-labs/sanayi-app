import { Avatar, Button, MetricPill, Text, TrustBadge } from "@naro/ui";
import { Href, useRouter } from "expo-router";
import { Pressable, View, type ViewStyle } from "react-native";

import {
  attachTechnicianToCase,
  prefillDraftForTechnician,
  useTechnicianCaseAction,
} from "@/features/cases";
import { useActiveVehicle } from "@/features/vehicles";

import type { TechnicianMatch } from "../types";

type TechnicianDecisionCardProps = {
  technician: TechnicianMatch;
};

const DEFAULT_VEHICLE_ID = "veh-bmw-34-abc-42";
const CARD_SHADOW_STYLE: ViewStyle = {
  shadowColor: "#020617",
  shadowOffset: { width: 0, height: 18 },
  shadowOpacity: 0.32,
  shadowRadius: 28,
  elevation: 12,
};

export function TechnicianDecisionCard({
  technician,
}: TechnicianDecisionCardProps) {
  const router = useRouter();
  const action = useTechnicianCaseAction(technician.id);
  const { data: activeVehicle } = useActiveVehicle();
  const primaryLabel =
    action.mode === "open_case" ? "Profili Gör" : action.primaryLabel;
  const buttonClassName = action.disabled
    ? "rounded-[16px] border border-white/10 bg-white/5 active:bg-white/5"
    : "rounded-[16px] px-5";

  const route = `/usta/${technician.id}` as Href;

  function handlePrimary() {
    if (action.mode === "open_case") {
      router.push(route);
      return;
    }
    if (action.attachOnPrimary && action.caseId) {
      attachTechnicianToCase(action.caseId, technician.id);
    }

    if (action.prefillOnPrimary) {
      prefillDraftForTechnician(
        action.kind,
        technician.id,
        activeVehicle?.id ?? DEFAULT_VEHICLE_ID,
      );
    }

    router.push(action.primaryRoute as Href);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${technician.name} profilini ac`}
      onPress={() => router.push(route)}
      style={CARD_SHADOW_STYLE}
      className="gap-5 overflow-hidden rounded-[30px] border border-white/10 bg-app-surface px-5 py-5 active:opacity-95"
    >
      <View className="absolute inset-x-0 top-0 h-px bg-white/20" />
      <View className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-brand-500/15" />
      <View className="absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-white/5" />

      <View className="flex-row items-start gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${technician.name} profilini ac`}
          onPress={() => router.push(route)}
        >
          <View className="rounded-[22px] border border-white/10 bg-black/20 p-1.5">
            <Avatar
              name={technician.name}
              size="lg"
              className="border-white/10 bg-white/10"
            />
          </View>
        </Pressable>

        <View className="flex-1 gap-2.5">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${technician.name} profilini ac`}
            onPress={() => router.push(route)}
            className="gap-1"
          >
            <Text
              variant="h3"
              tone="inverse"
              className="text-[28px] leading-[30px]"
            >
              {technician.name}
            </Text>
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[13px] leading-[18px]"
            >
              {technician.tagline}
            </Text>
          </Pressable>

          <View className="flex-row flex-wrap gap-2">
            {technician.badges.map((badge) => (
              <TrustBadge
                key={badge.id}
                label={badge.label}
                tone={badge.tone}
              />
            ))}
          </View>
        </View>
      </View>

      <View className="gap-2 rounded-[22px] border border-white/10 bg-white/5 px-4 py-3.5">
        <Text variant="eyebrow" tone="subtle" className="tracking-[0.28em]">
          Neden bu servis
        </Text>
        <Text variant="label" tone="accent" className="text-[14px]">
          {technician.reason}
        </Text>
        <Text tone="muted" className="text-app-text-muted leading-[19px]">
          {technician.summary}
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {technician.specialties.map((specialty) => (
          <TrustBadge key={specialty} label={specialty} tone="neutral" />
        ))}
      </View>

      <View className="flex-row gap-3">
        <MetricPill
          value={`${technician.rating.toFixed(1)} (${technician.reviewCount})`}
          label="Puan"
        />
        <MetricPill
          value={`${technician.distanceKm.toFixed(1)} km`}
          label="Mesafe"
        />
        <MetricPill value={`~${technician.responseMinutes} dk`} label="Yanit" />
      </View>

      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text
            variant="h3"
            tone="inverse"
            className="text-[30px] leading-[32px]"
          >
            {technician.priceLabel}
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-subtle">
            {action.description}
          </Text>
        </View>
        <Button
          label={primaryLabel}
          variant={action.disabled ? "outline" : "primary"}
          size="md"
          className={buttonClassName}
          disabled={action.disabled}
          onPress={(event) => {
            event.stopPropagation();
            handlePrimary();
          }}
        />
      </View>
    </Pressable>
  );
}
