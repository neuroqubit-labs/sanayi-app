import type { LatLng } from "@naro/domain";
import { Clock3 } from "lucide-react-native";
import { View } from "react-native";

import { Icon } from "../Icon";
import { Text } from "../Text";

import { useMap } from "./MapContext";
import { MAP_THEME } from "./tokens";

export type ETABadgeProps = {
  /** Dakika cinsinden tahmini ETA; null → gizle. */
  minutes: number | null;
  /** Haritada bir koordinata bağlı göstermek için; verilmezse floating badge caller konumlandırır. */
  coord?: LatLng;
  label?: string;
  tone?: "accent" | "success" | "warning" | "neutral";
};

const TONE_BG: Record<NonNullable<ETABadgeProps["tone"]>, string> = {
  accent: "#0ea5e9",
  success: "#2dd28d",
  warning: "#f5b33f",
  neutral: "#83a7ff",
};

export function ETABadge({
  minutes,
  coord,
  label = "ETA",
  tone = "accent",
}: ETABadgeProps) {
  const { project, theme } = useMap();
  const themeTokens = MAP_THEME[theme];
  const color = TONE_BG[tone];

  if (minutes === null || minutes < 0) return null;

  const positionStyle = coord
    ? {
        left: `${project(coord).x * 100}%` as const,
        top: `${project(coord).y * 100}%` as const,
        transform: [{ translateX: -34 }, { translateY: -38 }] as const,
      }
    : null;

  return (
    <View
      pointerEvents="none"
      className={
        coord
          ? "absolute flex-row items-center gap-1.5 rounded-full border px-2.5 py-1"
          : "flex-row items-center gap-1.5 rounded-full border px-2.5 py-1"
      }
      style={[
        {
          backgroundColor: themeTokens.scrim,
          borderColor: color,
        },
        positionStyle,
      ]}
    >
      <Icon icon={Clock3} size={11} color={color} />
      <Text
        variant="caption"
        className="text-[11px] font-semibold"
        style={{ color: themeTokens.textOnMap }}
      >
        {label} {minutes} dk
      </Text>
    </View>
  );
}
