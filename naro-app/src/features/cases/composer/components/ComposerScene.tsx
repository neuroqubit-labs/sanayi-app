import {
  BackButton,
  Icon,
  Text,
  type TextTone,
} from "@naro/ui";
import { ChevronRight } from "lucide-react-native";
import { useEffect, useRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  type ScrollView as NativeScrollView,
  View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

export type ComposerSceneStep = {
  key: string;
  title: string;
  description?: string;
};

export type ComposerSceneProps = {
  title: string;
  subtitle?: string;
  vehicleLabel?: string;
  steps: readonly ComposerSceneStep[];
  activeIndex: number;
  onClose: () => void;
  onStepPress?: (index: number) => void;
  trailingAction?: ReactNode;
  children: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  footerHidden?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  helperText?: string;
  helperTone?: TextTone;
};

export function ComposerScene({
  title,
  vehicleLabel,
  steps,
  activeIndex,
  onClose,
  trailingAction,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  footerHidden = false,
  secondaryLabel,
  onSecondary,
  helperText,
  helperTone = "subtle",
}: ComposerSceneProps) {
  const activeStep = steps[activeIndex];
  const safeTotal = Math.max(1, steps.length);
  const percent = Math.min(1, Math.max(0, (activeIndex + 1) / safeTotal));
  const scrollRef = useRef<NativeScrollView | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [activeIndex]);

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-app-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="gap-3 px-5 pt-3">
          <View className="flex-row items-center gap-3">
            <BackButton onPress={onClose} variant="close" />
            <View className="flex-1 items-center">
              <Text
                variant="h3"
                tone="inverse"
                numberOfLines={1}
                className="text-[17px] leading-[22px]"
              >
                {activeStep?.title ?? title}
              </Text>
              {vehicleLabel ? (
                <View className="mt-1 rounded-full border border-app-outline bg-app-surface px-2.5 py-0.5">
                  <Text
                    variant="caption"
                    tone="accent"
                    className="text-[11px] leading-[14px]"
                  >
                    {vehicleLabel}
                  </Text>
                </View>
              ) : null}
            </View>
            {trailingAction ? (
              <View>{trailingAction}</View>
            ) : (
              <View className="w-9" />
            )}
          </View>

          <View className="gap-2">
            <View className="flex-row items-center">
              <Text variant="eyebrow" tone="subtle">
                Adım {activeIndex + 1} / {steps.length}
              </Text>
            </View>
            <View className="h-1 w-full overflow-hidden rounded-full bg-app-surface-2">
              <View
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${percent * 100}%` }}
              />
            </View>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          className="flex-1"
          disableScrollViewPanResponder
          contentContainerClassName="px-5 pb-6 pt-5"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        >
          <View className="flex-1 justify-between gap-6">
            <View className="gap-5">
              {children}
            </View>

            {footerHidden ? null : (
              <View className="gap-3 pt-1">
                {helperText ? (
                  <Text
                    variant="caption"
                    tone={helperTone}
                    className="text-center leading-[18px]"
                  >
                    {helperText}
                  </Text>
                ) : null}
                <View className="flex-row gap-3">
                  {secondaryLabel && onSecondary ? (
                    <SceneButton
                      label={secondaryLabel}
                      variant="secondary"
                      onPress={onSecondary}
                    />
                  ) : null}
                  <SceneButton
                    label={primaryLabel}
                    onPress={onPrimary}
                    disabled={primaryDisabled || primaryLoading}
                    loading={primaryLoading}
                  />
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SceneButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  loading?: boolean;
}) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={label}
      onPress={disabled ? undefined : onPress}
      className={[
        "h-14 flex-1 flex-row items-center justify-center gap-2 rounded-[18px] border px-4",
        isPrimary
          ? "border-brand-500 bg-brand-500"
          : "border-app-outline bg-app-surface",
        disabled ? "opacity-50" : "active:opacity-90",
      ].join(" ")}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? "#ffffff" : "#83a7ff"} />
      ) : (
        <>
          <Text
            variant="label"
            tone={isPrimary ? "neutral" : "inverse"}
            className={isPrimary ? "text-white" : undefined}
          >
            {label}
          </Text>
          {isPrimary ? (
            <Icon icon={ChevronRight} size={16} color="#ffffff" />
          ) : null}
        </>
      )}
    </Pressable>
  );
}
