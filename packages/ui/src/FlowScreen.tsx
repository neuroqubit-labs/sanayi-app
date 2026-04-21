import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackButton, type BackButtonVariant } from "./BackButton";
import { Text } from "./Text";

export type FlowScreenProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  onBack?: () => void;
  backVariant?: BackButtonVariant;
  /** Top-right slot (ör. "Taslak kaydet" chip-button). */
  trailingAction?: ReactNode;
  progress?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  contentClassName?: string;
  /** Compact shell — ince başlık + daraltılmış padding. */
  compact?: boolean;
};

export function FlowScreen({
  title,
  eyebrow,
  description,
  onBack,
  backVariant = "back",
  trailingAction,
  progress,
  footer,
  children,
  scroll = true,
  contentClassName,
  compact = false,
}: FlowScreenProps) {
  const bodyClass = [
    compact ? "gap-4 px-5 pb-8 pt-2" : "gap-5 px-6 pb-8 pt-5",
    contentClassName ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-app-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className={compact ? "gap-2 px-5 pt-3" : "gap-3 px-6 pt-4"}>
          <View className="flex-row items-center gap-3">
            {onBack ? <BackButton onPress={onBack} variant={backVariant} /> : null}
            <View className="flex-1 items-center">
              {eyebrow ? (
                <Text variant="eyebrow" tone="subtle">
                  {eyebrow}
                </Text>
              ) : null}
              <Text
                variant={compact ? "h3" : "h2"}
                tone="inverse"
                numberOfLines={1}
                className={compact ? "text-[17px] leading-[22px]" : undefined}
              >
                {title}
              </Text>
            </View>
            {trailingAction ? <View>{trailingAction}</View> : null}
          </View>
          {!compact && description ? (
            <Text tone="muted" className="text-app-text-muted">
              {description}
            </Text>
          ) : null}
          {progress ? <View>{progress}</View> : null}
          {compact && description ? (
            <Text
              tone="muted"
              className="text-app-text-muted text-[12px] leading-[16px]"
            >
              {description}
            </Text>
          ) : null}
        </View>

        {scroll ? (
          <ScrollView
            contentContainerClassName={bodyClass}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View className={`flex-1 ${bodyClass}`}>{children}</View>
        )}

        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
