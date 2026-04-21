import { useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  View,
  type ImageSourcePropType,
} from "react-native";
import type { LucideIcon } from "lucide-react-native";

import { BackButton } from "./BackButton";
import { Button, type ButtonVariant } from "./Button";
import { Icon } from "./Icon";
import { Screen } from "./Screen";
import { StatusChip, type StatusChipTone } from "./StatusChip";
import { Text } from "./Text";
import { NARO_LOGO, NARO_WORDMARK } from "./brandAssets";
import { shellMotion } from "./tokens";

export type BrandWaitStateMode =
  | "pending"
  | "coming_soon"
  | "unavailable"
  | "retryable_loading";

export type BrandWaitStateAction = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
};

export type BrandWaitStateProps = {
  mode: BrandWaitStateMode;
  title: string;
  description: string;
  eyebrow?: string;
  note?: string;
  primaryAction?: BrandWaitStateAction;
  secondaryAction?: BrandWaitStateAction;
  showBack?: boolean;
  onBack?: () => void;
  brandingVariant?: "logo" | "logo+wordmark";
  contextIcon?: LucideIcon;
  contextIconTone?: StatusChipTone;
  progressLabel?: string;
  wordmarkSource?: ImageSourcePropType;
  logoSource?: ImageSourcePropType;
};

const MODE_TONE: Record<BrandWaitStateMode, StatusChipTone> = {
  pending: "warning",
  coming_soon: "accent",
  unavailable: "critical",
  retryable_loading: "info",
};

const MODE_LABEL: Record<BrandWaitStateMode, string> = {
  pending: "Beklemede",
  coming_soon: "Yakında",
  unavailable: "Şu An Ulaşılamıyor",
  retryable_loading: "Hazırlanıyor",
};

const CONTEXT_ICON_COLOR: Record<StatusChipTone, string> = {
  accent: "#f45f25",
  neutral: "#dbe5f5",
  success: "#2dd28d",
  warning: "#f5b33f",
  critical: "#ff7e7e",
  info: "#83a7ff",
};

export function BrandWaitState({
  mode,
  title,
  description,
  eyebrow,
  note,
  primaryAction,
  secondaryAction,
  showBack = false,
  onBack,
  brandingVariant = "logo+wordmark",
  contextIcon,
  contextIconTone = "accent",
  progressLabel,
  wordmarkSource = NARO_WORDMARK,
  logoSource = NARO_LOGO,
}: BrandWaitStateProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: shellMotion.base,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: shellMotion.slow,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  const statusLabel = eyebrow ?? MODE_LABEL[mode];
  const showSpinner = mode === "pending" || mode === "retryable_loading";
  const resolvedProgressLabel =
    progressLabel ??
    (mode === "pending"
      ? "Naro senin için hazırlıyor"
      : mode === "retryable_loading"
        ? "Yeniden bağlanmaya çalışılıyor"
        : null);

  const hasActions = Boolean(primaryAction || secondaryAction);
  const contextIconColor = useMemo(
    () => CONTEXT_ICON_COLOR[contextIconTone],
    [contextIconTone],
  );

  return (
    <Screen
      backgroundClassName="bg-app-bg"
      padded={false}
      className="flex-1 px-5 pb-5 pt-4"
    >
      {showBack && onBack ? (
        <View className="pb-3">
          <BackButton onPress={onBack} />
        </View>
      ) : null}

      <View className="flex-1 justify-center">
        <Animated.View
          style={{
            opacity,
            transform: [{ translateY }],
          }}
        >
          <View className="overflow-hidden rounded-[34px] border border-app-outline-strong bg-app-surface-2 px-6 py-7">
            <View
              pointerEvents="none"
              className="absolute -left-12 top-8 h-40 w-40 rounded-full bg-[#0ea5e9]/10"
            />
            <View
              pointerEvents="none"
              className="absolute -right-10 bottom-0 h-36 w-36 rounded-full bg-brand-500/10"
            />
            <View
              pointerEvents="none"
              className="absolute inset-x-6 top-0 h-px bg-white/10"
            />

            <View className="items-center gap-5">
              <StatusChip label={statusLabel} tone={MODE_TONE[mode]} />

              <View className="items-center gap-4">
                <View className="relative items-center justify-center">
                  <View className="absolute h-[136px] w-[136px] rounded-full bg-[#0d8fd7]/8" />
                  <View className="absolute h-[104px] w-[104px] rounded-full border border-white/5 bg-white/5" />

                  <View className="h-[92px] w-[92px] items-center justify-center rounded-[28px] border border-app-outline bg-app-surface px-5 py-5">
                    <Image
                      source={logoSource}
                      resizeMode="contain"
                      style={{ width: 52, height: 52 }}
                    />
                  </View>

                  {contextIcon ? (
                    <View className="absolute -bottom-1 -right-1 h-9 w-9 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
                      <Icon
                        icon={contextIcon}
                        size={16}
                        color={contextIconColor}
                      />
                    </View>
                  ) : null}
                </View>

                {brandingVariant === "logo+wordmark" ? (
                  <Image
                    source={wordmarkSource}
                    resizeMode="contain"
                    style={{ width: 122, height: 28 }}
                  />
                ) : null}
              </View>

              <View className="items-center gap-2">
                <Text
                  variant="h1"
                  tone="inverse"
                  className="text-center text-[30px] leading-[34px]"
                >
                  {title}
                </Text>
                <Text
                  tone="muted"
                  className="max-w-[320px] text-center text-app-text-muted"
                >
                  {description}
                </Text>
              </View>

              {showSpinner || resolvedProgressLabel ? (
                <View className="items-center gap-2">
                  {showSpinner ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        MODE_TONE[mode] === "warning" ? "#f5b33f" : "#83a7ff"
                      }
                    />
                  ) : null}
                  {resolvedProgressLabel ? (
                    <Text
                      variant="caption"
                      tone="subtle"
                      className="text-center text-app-text-subtle"
                    >
                      {resolvedProgressLabel}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {note ? (
                <Text
                  variant="caption"
                  tone="subtle"
                  className="max-w-[320px] text-center text-app-text-subtle"
                >
                  {note}
                </Text>
              ) : null}

              {hasActions ? (
                <View className="w-full gap-3 pt-1">
                  {primaryAction ? (
                    <Button
                      label={primaryAction.label}
                      onPress={primaryAction.onPress}
                      variant={primaryAction.variant ?? "primary"}
                      loading={primaryAction.loading}
                      fullWidth
                      size="lg"
                    />
                  ) : null}
                  {secondaryAction ? (
                    <Button
                      label={secondaryAction.label}
                      onPress={secondaryAction.onPress}
                      variant={secondaryAction.variant ?? "outline"}
                      loading={secondaryAction.loading}
                      fullWidth
                      size="lg"
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        </Animated.View>
      </View>
    </Screen>
  );
}
