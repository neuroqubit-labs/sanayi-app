import { ScrollView, View } from "react-native";

import { Text } from "./Text";

export type FlowProgressStep = {
  key: string;
  title: string;
  description?: string;
};

export type FlowProgressProps = {
  steps: ReadonlyArray<FlowProgressStep>;
  activeIndex: number;
  variant?: "rail" | "bar" | "bar-thin";
  onStepPress?: (index: number) => void;
  className?: string;
};

export function FlowProgress({
  steps,
  activeIndex,
  variant = "rail",
  onStepPress,
  className,
}: FlowProgressProps) {
  if (variant === "bar-thin") {
    const safeTotal = Math.max(1, steps.length);
    const percent = Math.min(1, Math.max(0, (activeIndex + 1) / safeTotal));
    const activeTitle = steps[activeIndex]?.title ?? "";
    return (
      <View className={["gap-1.5", className ?? ""].filter(Boolean).join(" ")}>
        <View className="h-0.5 w-full overflow-hidden rounded-full bg-app-surface-2">
          <View
            className="h-full rounded-full bg-brand-500"
            style={{ width: `${percent * 100}%` }}
          />
        </View>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[11px]"
        >
          Adım {activeIndex + 1} / {steps.length}
          {activeTitle ? ` · ${activeTitle}` : ""}
        </Text>
      </View>
    );
  }

  if (variant === "bar") {
    const safeTotal = Math.max(1, steps.length);
    const percent = Math.min(1, Math.max(0, (activeIndex + 1) / safeTotal));

    return (
      <View className={["gap-2", className ?? ""].filter(Boolean).join(" ")}>
        <View className="flex-row items-center justify-between">
          <Text variant="eyebrow" tone="subtle">
            Adım {activeIndex + 1} / {steps.length}
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            {steps[activeIndex]?.title ?? ""}
          </Text>
        </View>
        <View className="h-1.5 w-full overflow-hidden rounded-full bg-app-surface-2">
          <View
            className="h-full rounded-full bg-brand-500"
            style={{ width: `${percent * 100}%` }}
          />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12 }}
      className={className}
    >
      {steps.map((step, index) => {
        const isActive = index === activeIndex;
        const isCompleted = index < activeIndex;

        return (
          <View
            key={step.key}
            accessibilityRole={onStepPress ? "button" : undefined}
            onTouchEnd={
              onStepPress && isCompleted ? () => onStepPress(index) : undefined
            }
            className={[
              "min-w-[88px] gap-1 rounded-[20px] border px-3 py-3",
              isActive
                ? "border-brand-500 bg-brand-500/10"
                : isCompleted
                  ? "border-app-success/30 bg-app-success-soft"
                  : "border-app-outline bg-app-surface",
            ].join(" ")}
          >
            <Text
              variant="eyebrow"
              tone={isActive ? "accent" : isCompleted ? "success" : "subtle"}
            >
              {String(index + 1).padStart(2, "0")}
            </Text>
            <Text variant="label" tone="inverse">
              {step.title}
            </Text>
            {step.description ? (
              <Text variant="caption" tone="subtle">
                {step.description}
              </Text>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}
