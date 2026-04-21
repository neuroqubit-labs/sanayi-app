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
  progress?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  contentClassName?: string;
};

export function FlowScreen({
  title,
  eyebrow,
  description,
  onBack,
  backVariant = "back",
  progress,
  footer,
  children,
  scroll = true,
  contentClassName,
}: FlowScreenProps) {
  const bodyClass = ["gap-5 px-6 pb-8 pt-5", contentClassName ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-app-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="gap-3 px-6 pt-4">
          <View className="flex-row items-center gap-3">
            {onBack ? <BackButton onPress={onBack} variant={backVariant} /> : null}
            <View className="flex-1 gap-1">
              {eyebrow ? (
                <Text variant="eyebrow" tone="subtle">
                  {eyebrow}
                </Text>
              ) : null}
              <Text variant="h2" tone="inverse">
                {title}
              </Text>
            </View>
          </View>
          {description ? (
            <Text tone="muted" className="text-app-text-muted">
              {description}
            </Text>
          ) : null}
          {progress ? <View>{progress}</View> : null}
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
