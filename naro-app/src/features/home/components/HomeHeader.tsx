import {
  Button,
  Icon,
  MetricPill,
  Text,
  TrustBadge,
} from "@naro/ui";
import { Href, useRouter } from "expo-router";
import { Bell, Search } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { useUnreadNotificationCount } from "@/features/notifications";

import { useHomeSummary } from "../api";

export function HomeHeader() {
  const router = useRouter();
  const { data: summary } = useHomeSummary();
  const unreadCount = useUnreadNotificationCount();
  const activeProcess = summary?.activeProcess ?? null;
  const decision = summary?.decision;

  return (
    <View className="gap-5 pb-2">
      <View className="flex-row items-stretch gap-3">
        <SearchPill
          onPress={() => router.push("/(modal)/ara" as Href)}
        />
        <NotificationButton
          hasUnread={unreadCount > 0}
          onPress={() => router.push("/bildirimler" as Href)}
        />
      </View>

      {activeProcess ? (
        <ActiveProcessPinned
          title={activeProcess.title}
          servisAd={activeProcess.servisAd}
          status={activeProcess.status}
          waitLabel={activeProcess.waitLabel}
          priceLabel={activeProcess.priceLabel}
          nextStepLabel={activeProcess.nextStepLabel}
          progressLabel={activeProcess.progressLabel}
          progressValue={activeProcess.progressValue}
          onPress={() => router.push(activeProcess.cardRoute as Href)}
          primaryLabel={activeProcess.primaryActionLabel}
          onPrimary={
            activeProcess.primaryActionRoute
              ? () => router.push(activeProcess.primaryActionRoute as Href)
              : undefined
          }
        />
      ) : decision ? (
        <CalmDecisionPinned
          eyebrow={decision.eyebrow}
          title={decision.title}
          description={decision.description}
          primaryLabel={decision.primaryActionLabel}
          onPrimary={
            decision.primaryActionRoute
              ? () => router.push(decision.primaryActionRoute as Href)
              : undefined
          }
          secondaryLabel={decision.secondaryActionLabel}
          onSecondary={
            decision.secondaryActionRoute
              ? () => router.push(decision.secondaryActionRoute as Href)
              : undefined
          }
          metrics={decision.metrics}
        />
      ) : null}
    </View>
  );
}

type SearchPillProps = {
  onPress: () => void;
};

function SearchPill({ onPress }: SearchPillProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Usta, servis, kampanya ara"
      onPress={onPress}
      className="flex-1 flex-row items-center gap-3 rounded-[24px] border border-app-outline-strong bg-app-surface px-4 py-4 active:bg-app-surface-2"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/15">
        <Icon icon={Search} size={20} color="#0ea5e9" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="label" tone="inverse">
          Ne arıyorsun? Hemen bul.
        </Text>
        <Text variant="caption" tone="muted" className="text-app-text-muted">
          Usta, servis, kampanya — 50+ hizmet keşfet
        </Text>
      </View>
    </Pressable>
  );
}

type NotificationButtonProps = {
  hasUnread?: boolean;
  onPress: () => void;
};

function NotificationButton({ hasUnread, onPress }: NotificationButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Bildirimler"
      onPress={onPress}
      className="w-[60px] items-center justify-center rounded-[24px] border border-app-outline-strong bg-app-surface active:bg-app-surface-2"
    >
      <View>
        <Icon icon={Bell} size={22} color="#f5f7ff" />
        {hasUnread ? (
          <View className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-app-surface bg-app-critical" />
        ) : null}
      </View>
    </Pressable>
  );
}

type ActiveProcessPinnedProps = {
  title: string;
  servisAd: string;
  status: string;
  waitLabel: string;
  priceLabel: string;
  nextStepLabel: string;
  progressLabel: string;
  progressValue: number;
  onPress: () => void;
  primaryLabel?: string;
  onPrimary?: () => void;
};

function ActiveProcessPinned({
  title,
  servisAd,
  status,
  waitLabel,
  priceLabel,
  nextStepLabel,
  progressLabel,
  progressValue,
  onPress,
  primaryLabel,
  onPrimary,
}: ActiveProcessPinnedProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} vakasını aç`}
      onPress={onPress}
      className="gap-4 rounded-[24px] border border-brand-500/30 bg-app-surface-2 px-4 py-4 active:opacity-95"
    >
      <View className="flex-row flex-wrap items-center gap-2">
        <TrustBadge label="İşlem devam ediyor" tone="accent" />
        <TrustBadge label={waitLabel} tone="warning" />
      </View>

      <View className="gap-1.5">
        <Text variant="eyebrow" tone="subtle">
          Odak penceresi
        </Text>
        <Text variant="h3" tone="inverse">
          {servisAd}
        </Text>
        <Text variant="caption" tone="muted" className="text-app-text-muted">
          {title} · {status}
        </Text>
      </View>

      <View className="gap-2">
        <View className="h-1.5 rounded-full bg-app-surface-3">
          <View
            className="h-1.5 rounded-full bg-brand-500"
            style={{ width: `${Math.max(6, progressValue)}%` }}
          />
        </View>
        <Text variant="caption" tone="accent">
          {progressLabel}
        </Text>
      </View>

      <View className="flex-row gap-2">
        <MetricPill value={priceLabel} label="Güncel tutar" />
        <MetricPill value={nextStepLabel} label="Sıradaki eşik" />
      </View>

      {primaryLabel && onPrimary ? (
        <Button
          label={primaryLabel}
          onPress={(event) => {
            event.stopPropagation();
            onPrimary();
          }}
          fullWidth
        />
      ) : null}
    </Pressable>
  );
}

type CalmDecisionPinnedProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  metrics: { value: string; label: string; hint?: string }[];
};

function CalmDecisionPinned({
  eyebrow,
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  metrics,
}: CalmDecisionPinnedProps) {
  return (
    <View className="gap-4 rounded-[24px] border border-app-outline-strong bg-app-surface-2 px-4 py-5">
      <View className="gap-1.5">
        <Text variant="eyebrow" tone="subtle">
          {eyebrow}
        </Text>
        <Text variant="h2" tone="inverse">
          {title}
        </Text>
        <Text tone="muted" className="text-app-text-muted">
          {description}
        </Text>
      </View>

      {metrics.length ? (
        <View className="flex-row gap-2">
          {metrics.slice(0, 3).map((metric) => (
            <MetricPill
              key={metric.label}
              value={metric.value}
              label={metric.label}
              hint={metric.hint}
            />
          ))}
        </View>
      ) : null}

      {primaryLabel && onPrimary ? (
        <View className="gap-2">
          <Button label={primaryLabel} onPress={onPrimary} fullWidth />
          {secondaryLabel && onSecondary ? (
            <Button
              label={secondaryLabel}
              variant="outline"
              onPress={onSecondary}
              fullWidth
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
