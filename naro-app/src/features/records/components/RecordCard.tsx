import { Button, Icon, PressableCard, Text, TrustBadge } from "@naro/ui";
import { useRouter } from "expo-router";
import {
  ArrowRight,
  CalendarClock,
  CarFront,
  MapPin,
  Sparkles,
} from "lucide-react-native";
import { View } from "react-native";

import type { RecordItem } from "../types";

type RecordCardProps = {
  item: RecordItem;
  mode?: "active" | "archive";
  prominent?: boolean;
};

export function RecordCard({
  item,
  mode,
  prominent = false,
}: RecordCardProps) {
  const router = useRouter();
  const resolvedMode = mode ?? (prominent ? "active" : "archive");
  const openRecord = () => router.push(item.route as never);

  if (resolvedMode === "active") {
    return (
      <PressableCard
        accessibilityRole="button"
        accessibilityLabel={`${item.title} kaydını aç`}
        onPress={openRecord}
        variant="elevated"
        radius="xl"
        className="gap-4 border-brand-500/30 bg-app-surface-2 px-4 py-4"
      >
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-2">
            <LiveDot />
            <TrustBadge label={item.statusLabel} tone={item.statusTone} />
            {item.hasOffers ? (
              <TrustBadge
                label={
                  item.offerCount > 0
                    ? `${item.offerCount} teklif`
                    : "Teklif geldi"
                }
                tone="accent"
              />
            ) : null}
          </View>
          <Text variant="caption" tone="subtle" numberOfLines={1}>
            {item.updatedLabel}
          </Text>
        </View>

        <View className="gap-2">
          <Text variant="eyebrow" tone="accent">
            {item.kindLabel}
          </Text>
          <Text variant="h3" tone="inverse" className="text-[17px] leading-[22px]">
            {item.title}
          </Text>
          {item.subtitle ? (
            <Text
              tone="muted"
              numberOfLines={2}
              className="text-app-text-muted leading-[20px]"
            >
              {item.subtitle}
            </Text>
          ) : null}
        </View>

        <View className="gap-2">
          <MetaLine
            icon={CarFront}
            label={item.vehicleLabel ?? "Araç kaydı"}
          />
          {item.locationLabel ? (
            <MetaLine icon={MapPin} label={item.locationLabel} />
          ) : null}
        </View>

        {typeof item.progressValue === "number" ? (
          <View className="gap-2">
            <View className="h-1.5 overflow-hidden rounded-full bg-app-surface-3">
              <View
                className="h-1.5 rounded-full bg-brand-500"
                style={{ width: `${Math.max(6, item.progressValue)}%` }}
              />
            </View>
            <View className="flex-row items-center justify-between gap-3">
              <Text variant="caption" tone="accent">
                Sıradaki · {item.nextStepLabel}
              </Text>
              {item.urgencyLabel ? (
                <TrustBadge
                  label={item.urgencyLabel}
                  tone={item.urgencyTone ?? "neutral"}
                />
              ) : null}
            </View>
          </View>
        ) : null}

        {item.primaryActionLabel ? (
          <Button
            label={item.primaryActionLabel}
            size="md"
            fullWidth
            onPress={(event) => {
              event.stopPropagation();
              router.push((item.primaryActionRoute ?? item.route) as never);
            }}
          />
        ) : null}
      </PressableCard>
    );
  }

  return (
    <PressableCard
      accessibilityRole="button"
      accessibilityLabel={`${item.title} kaydını aç`}
      onPress={openRecord}
      variant="flat"
      radius="xl"
      className="gap-3 px-4 py-4"
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-2">
          <TrustBadge label={item.kindLabel} tone="neutral" />
          <TrustBadge label={item.statusLabel} tone={item.statusTone} />
          {item.hasOffers ? (
            <TrustBadge label="Teklif izi" tone="accent" />
          ) : null}
        </View>
        <Text variant="caption" tone="subtle" numberOfLines={1}>
          {item.updatedLabel}
        </Text>
      </View>

      <View className="gap-1">
        <Text variant="label" tone="inverse" numberOfLines={2}>
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text
            variant="caption"
            tone="muted"
            numberOfLines={2}
            className="text-app-text-muted leading-[18px]"
          >
            {item.subtitle}
          </Text>
        ) : null}
      </View>

      <View className="gap-2">
        <View className="flex-row flex-wrap gap-2">
          <MiniMeta
            icon={CalendarClock}
            label={`Açılış ${item.createdLabel}`}
          />
          {item.vehicleLabel ? (
            <MiniMeta icon={CarFront} label={item.vehicleLabel} />
          ) : null}
        </View>
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1">
            {item.locationLabel ? (
              <MiniMeta icon={MapPin} label={item.locationLabel} />
            ) : (
              <MiniMeta icon={Sparkles} label={item.nextStepLabel} />
            )}
          </View>
          <View className="h-9 w-9 items-center justify-center rounded-full bg-app-surface-2">
            <Icon icon={ArrowRight} size={14} color="#83a7ff" />
          </View>
        </View>
      </View>
    </PressableCard>
  );
}

function LiveDot() {
  return <View className="h-2.5 w-2.5 rounded-full bg-app-success" />;
}

function MetaLine({
  icon,
  label,
}: {
  icon: Parameters<typeof Icon>[0]["icon"];
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <View className="h-7 w-7 items-center justify-center rounded-full bg-app-surface-3">
        <Icon icon={icon} size={13} color="#83a7ff" />
      </View>
      <Text
        variant="caption"
        tone="muted"
        numberOfLines={1}
        className="text-app-text-muted"
      >
        {label}
      </Text>
    </View>
  );
}

function MiniMeta({
  icon,
  label,
}: {
  icon: Parameters<typeof Icon>[0]["icon"];
  label: string;
}) {
  return (
    <View className="max-w-full flex-row items-center gap-1.5 rounded-full bg-app-surface-2 px-2.5 py-1.5">
      <Icon icon={icon} size={12} color="#6f7b97" />
      <Text
        variant="caption"
        tone="muted"
        numberOfLines={1}
        className="text-app-text-muted text-[11px]"
      >
        {label}
      </Text>
    </View>
  );
}
