import { View } from "react-native";

import { Text } from "./Text";

export type MetricPillProps = {
  value: string;
  label: string;
  hint?: string;
  className?: string;
};

export function MetricPill({ value, label, hint, className }: MetricPillProps) {
  return (
    <View
      className={[
        "min-w-[92px] flex-1 gap-1 rounded-3xl border border-app-outline bg-app-surface px-4 py-3",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Text variant="h3" tone="inverse">
        {value}
      </Text>
      <Text variant="eyebrow" tone="subtle">
        {label}
      </Text>
      {hint ? (
        <Text variant="caption" tone="muted" className="text-app-text-muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
