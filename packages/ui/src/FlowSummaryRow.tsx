import { Pressable, View } from "react-native";
import { ChevronRight, Pencil } from "lucide-react-native";

import { Icon } from "./Icon";
import { Text } from "./Text";

export type FlowSummaryRowProps = {
  label: string;
  value: string;
  helperText?: string;
  onEdit?: () => void;
  onPress?: () => void;
  className?: string;
};

export function FlowSummaryRow({
  label,
  value,
  helperText,
  onEdit,
  onPress,
  className,
}: FlowSummaryRowProps) {
  const body = (
    <>
      <View className="flex-1 gap-1">
        <Text variant="eyebrow" tone="subtle">
          {label}
        </Text>
        <Text variant="label" tone="inverse">
          {value || "—"}
        </Text>
        {helperText ? (
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            {helperText}
          </Text>
        ) : null}
      </View>
      {onEdit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Düzenle"
          onPress={onEdit}
          className="h-9 w-9 items-center justify-center rounded-full border border-app-outline bg-app-surface-2 active:bg-app-surface-3"
        >
          <Icon icon={Pencil} size={14} color="#f5f7ff" />
        </Pressable>
      ) : onPress ? (
        <Icon icon={ChevronRight} size={18} color="#6f7b97" />
      ) : null}
    </>
  );

  const containerClass = [
    "flex-row items-start gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-3.5",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className={`${containerClass} active:bg-app-surface-2`}
      >
        {body}
      </Pressable>
    );
  }

  return <View className={containerClass}>{body}</View>;
}
