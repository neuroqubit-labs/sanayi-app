import {
  Button,
  Icon,
  MetricPill,
  PressableCard,
  Surface,
  Text,
  TrustBadge,
} from "@naro/ui";
import { Href, useRouter } from "expo-router";
import { Bell, Search } from "lucide-react-native";
import { useEffect, useRef, type ComponentProps } from "react";
import { Animated, Easing, View } from "react-native";

import { useUnreadNotificationCount } from "@/features/notifications";

import { useHomeSummary } from "../api";

type BadgeTone = NonNullable<ComponentProps<typeof TrustBadge>["tone"]>;

const LIVE_DOT_COLOR: Record<BadgeTone, string> = {
  accent: "#0ea5e9",
  info: "#38bdf8",
  warning: "#f59e0b",
  success: "#22c55e",
  critical: "#ef4444",
  neutral: "#94a3b8",
};

function LiveDot({ tone }: { tone: BadgeTone }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.35,
            duration: 750,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 750,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.35,
            duration: 750,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 750,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, scale]);

  return (
    <Animated.View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: LIVE_DOT_COLOR[tone],
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

function ProgressShimmer() {
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [x]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        width: "40%",
        backgroundColor: "rgba(255,255,255,0.35)",
        opacity: x.interpolate({
          inputRange: [0, 0.15, 0.85, 1],
          outputRange: [0, 0.6, 0.6, 0],
        }),
        transform: [
          {
            translateX: x.interpolate({
              inputRange: [0, 1],
              outputRange: [-80, 280],
            }),
          },
        ],
      }}
    />
  );
}

export function HomeHeader() {
  const router = useRouter();
  const { data: summary } = useHomeSummary();
  const unreadCount = useUnreadNotificationCount();
  const activeProcess = summary?.activeProcess ?? null;
  const decision = summary?.decision;

  return (
    <View className="gap-5 pb-2">
      <View className="flex-row items-center gap-3">
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
          servisAd={activeProcess.servisAd}
          title={activeProcess.title}
          status={activeProcess.status}
          nextStepLabel={activeProcess.nextStepLabel}
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
    <PressableCard
      accessibilityRole="button"
      accessibilityLabel="Usta, servis, kampanya ara"
      onPress={onPress}
      variant="flat"
      radius="lg"
      className="h-14 flex-1 flex-row items-center gap-3 border-app-outline-strong px-3"
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-500/15">
        <Icon icon={Search} size={18} color="#0ea5e9" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="label" tone="inverse" numberOfLines={1}>
          Ne arıyorsun?
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          Usta, servis, kampanya
        </Text>
      </View>
    </PressableCard>
  );
}

type NotificationButtonProps = {
  hasUnread?: boolean;
  onPress: () => void;
};

function NotificationButton({ hasUnread, onPress }: NotificationButtonProps) {
  return (
    <PressableCard
      accessibilityRole="button"
      accessibilityLabel="Bildirimler"
      onPress={onPress}
      variant="flat"
      radius="lg"
      className="h-14 w-14 items-center justify-center border-app-outline-strong"
    >
      <View>
        <Icon icon={Bell} size={22} color="#f5f7ff" />
        {hasUnread ? (
          <View className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-app-surface bg-app-critical" />
        ) : null}
      </View>
    </PressableCard>
  );
}

type ActiveProcessPinnedProps = {
  servisAd: string;
  title: string;
  status: string;
  nextStepLabel: string;
  progressValue: number;
  onPress: () => void;
  primaryLabel?: string;
  onPrimary?: () => void;
};

const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
  "Yeni teklif gelenler": "accent",
  "Teklifler geldi": "accent",
  "Teklifler geliyor": "accent",
  "Eşleşme bekleniyor": "info",
  "Çekici aranıyor": "info",
  "Randevu bekleniyor": "warning",
  "Randevu planlandı": "info",
  "Çekici planlandı": "info",
  "Servis sürüyor": "success",
  "Çekici süreci sürüyor": "success",
  "Parça onayın bekleniyor": "warning",
  "Fatura onayın bekleniyor": "warning",
};

const LIVE_STATUSES = new Set([
  "Yeni teklif gelenler",
  "Teklifler geldi",
  "Teklifler geliyor",
  "Eşleşme bekleniyor",
  "Çekici aranıyor",
  "Servis sürüyor",
  "Çekici süreci sürüyor",
  "Parça onayın bekleniyor",
  "Fatura onayın bekleniyor",
]);

function ActiveProcessPinned({
  servisAd,
  title,
  status,
  nextStepLabel,
  progressValue,
  onPress,
  primaryLabel,
  onPrimary,
}: ActiveProcessPinnedProps) {
  const tone = STATUS_BADGE_TONE[status] ?? "info";
  const isLive = LIVE_STATUSES.has(status);
  const subtitle = title?.trim() && title.trim() !== servisAd ? title.trim() : "";

  return (
    <PressableCard
      accessibilityRole="button"
      accessibilityLabel={`${servisAd} vakasını aç`}
      onPress={onPress}
      variant="elevated"
      radius="lg"
      className="gap-4 border-brand-500/30 bg-app-surface-2 px-4 py-4"
    >
      <View className="flex-row items-center gap-2">
        {isLive ? <LiveDot tone={tone} /> : null}
        <TrustBadge label={status} tone={tone} />
      </View>

      <View className="gap-1">
        <Text variant="h3" tone="inverse">
          {servisAd}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View className="gap-1.5">
        <View className="h-1.5 overflow-hidden rounded-full bg-app-surface-3">
          <View
            className="h-1.5 rounded-full bg-brand-500"
            style={{ width: `${Math.max(6, progressValue)}%` }}
          />
          {isLive ? <ProgressShimmer /> : null}
        </View>
        <Text variant="caption" tone="accent">
          Sıradaki · {nextStepLabel}
        </Text>
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
    </PressableCard>
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
    <Surface
      variant="raised"
      radius="lg"
      className="gap-4 border-app-outline-strong bg-app-surface-2 px-4 py-5"
    >
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
    </Surface>
  );
}
