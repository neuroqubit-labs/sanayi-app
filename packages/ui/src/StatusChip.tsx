import { View } from "react-native";
import type { LucideIcon } from "lucide-react-native";

import { Icon } from "./Icon";
import { Text } from "./Text";

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

const CONTAINER_CLASS: Record<StatusChipTone, string> = {
  accent: "border border-brand-500/30 bg-brand-500/15",
  neutral: "border border-app-outline bg-app-surface",
  success: "border border-app-success/30 bg-app-success-soft",
  warning: "border border-app-warning/30 bg-app-warning-soft",
  critical: "border border-app-critical/30 bg-app-critical-soft",
  info: "border border-app-info/30 bg-app-info-soft",
};

const TEXT_TONE: Record<StatusChipTone, "accent" | "inverse" | "success" | "warning" | "critical"> = {
  accent: "accent",
  neutral: "inverse",
  success: "success",
  warning: "warning",
  critical: "critical",
  info: "inverse",
};

const ICON_COLOR: Record<StatusChipTone, string> = {
  accent: "#0ea5e9",
  neutral: "#f5f7ff",
  success: "#2dd28d",
  warning: "#f5b33f",
  critical: "#ff6b6b",
  info: "#83a7ff",
};

export function StatusChip({
  label,
  tone = "neutral",
  icon,
  className,
}: StatusChipProps) {
  return (
    <View
      className={[
        "flex-row items-center gap-1.5 self-start rounded-full px-3 py-1.5",
        CONTAINER_CLASS[tone],
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon ? <Icon icon={icon} size={12} color={ICON_COLOR[tone]} /> : null}
      <Text variant="label" tone={TEXT_TONE[tone]} className="text-[12px]">
        {label}
      </Text>
    </View>
  );
}
