import { GesturePressable as Pressable } from "./GesturePressable";

import { Text } from "./Text";

export type ToggleChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
};

const SIZE_CLASS = {
  sm: "px-3 py-1.5",
  md: "px-4 py-2.5",
} as const;

const TEXT_SIZE_CLASS = {
  sm: "text-[12px] leading-[15px]",
  md: "",
} as const;

export function ToggleChip({
  label,
  selected,
  onPress,
  disabled = false,
  size = "md",
  className,
}: ToggleChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      hitSlop={8}
      onPress={disabled ? undefined : onPress}
      className={[
        "min-h-[36px] rounded-full border",
        SIZE_CLASS[size],
        selected
          ? "border-brand-500 bg-brand-500"
          : "border-app-outline bg-app-surface",
        disabled ? "opacity-50" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Text
        tone={selected ? "inverse" : "muted"}
        className={[
          TEXT_SIZE_CLASS[size],
          selected ? "" : "text-app-text-muted",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {label}
      </Text>
    </Pressable>
  );
}
