import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Sparkles } from "lucide-react-native";

import { Icon } from "./Icon";
import { Text } from "./Text";

export type AIInsightCardProps = {
  title: string;
  summary: string;
  eyebrow?: string;
  confirmLabel?: string;
  editLabel?: string;
  onConfirm?: () => void;
  onEdit?: () => void;
  footer?: ReactNode;
  className?: string;
};

export function AIInsightCard({
  title,
  summary,
  eyebrow = "Naro AI",
  confirmLabel = "Doğru",
  editLabel = "Düzelt",
  onConfirm,
  onEdit,
  footer,
  className,
}: AIInsightCardProps) {
  return (
    <View
      className={[
        "gap-3 rounded-[24px] border border-brand-500/30 bg-brand-500/10 px-4 py-4",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <View className="flex-row items-center gap-2">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-500/20">
          <Icon icon={Sparkles} size={16} color="#0ea5e9" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="eyebrow" tone="accent">
            {eyebrow}
          </Text>
          <Text variant="label" tone="inverse">
            {title}
          </Text>
        </View>
      </View>

      <Text tone="muted" className="text-app-text-muted">
        {summary}
      </Text>

      {footer}

      {onConfirm || onEdit ? (
        <View className="flex-row gap-2">
          {onConfirm ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              onPress={onConfirm}
              className="flex-1 items-center rounded-full bg-brand-500 py-2 active:bg-brand-900"
            >
              <Text variant="label" tone="inverse" className="text-white">
                {confirmLabel}
              </Text>
            </Pressable>
          ) : null}
          {onEdit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={editLabel}
              onPress={onEdit}
              className="flex-1 items-center rounded-full border border-app-outline bg-app-surface py-2 active:bg-app-surface-2"
            >
              <Text variant="label" tone="inverse">
                {editLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
