import { View } from "react-native";
import type { LucideIcon } from "lucide-react-native";

import { Icon } from "./Icon";
import { Text } from "./Text";
import { toneSurfaceClass, useToneColor } from "./tone";

export type StatusChipTone =
  | "accent"
  | "neutral"
  | "success"
  | "warning"
  | "critical"
  | "info";

export type StatusChipProps = {
  label: string;
  tone?: StatusChipTone;
  icon?: LucideIcon;
  className?: string;
};

const TEXT_TONE: Record<
  StatusChipTone,
  "accent" | "inverse" | "success" | "warning" | "critical"
> = {
  accent: "accent",
  neutral: "inverse",
  success: "success",
  warning: "warning",
  critical: "critical",
  info: "inverse",
};

export function StatusChip({
  label,
  tone = "neutral",
  icon,
  className,
}: StatusChipProps) {
  const iconColor = useToneColor(tone);

  return (
    <View
      className={[
        "flex-row items-center gap-1.5 self-start rounded-full px-3 py-1.5",
        toneSurfaceClass[tone],
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon ? <Icon icon={icon} size={12} color={iconColor} /> : null}
      <Text variant="label" tone={TEXT_TONE[tone]} className="text-[12px]">
        {label}
      </Text>
    </View>
  );
}
