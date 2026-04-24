import type { LucideIcon } from "lucide-react-native";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Icon } from "./Icon";
import { useNaroTheme, type ThemeScheme } from "./theme";
import { withAlphaHex } from "./color";

export type GlassIconBadgeSize = "sm" | "md";

export type GlassIconBadgeProps = {
  icon: LucideIcon;
  color: string;
  surfaceColor: string;
  size?: GlassIconBadgeSize;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

const SIZE_TOKENS: Record<
  GlassIconBadgeSize,
  {
    box: number;
    icon: number;
    radius: number;
    highlightHeight: number;
  }
> = {
  sm: { box: 36, icon: 15, radius: 18, highlightHeight: 14 },
  md: { box: 44, icon: 19, radius: 16, highlightHeight: 18 },
};

export function GlassIconBadge({
  icon,
  color,
  surfaceColor,
  size = "md",
  className,
  style,
}: GlassIconBadgeProps) {
  const { colors, scheme } = useNaroTheme();
  const token = SIZE_TOKENS[size];

  return (
    <View
      className={["items-center justify-center overflow-hidden", className]
        .filter(Boolean)
        .join(" ")}
      style={[
        {
          width: token.box,
          height: token.box,
          borderRadius: token.radius,
          backgroundColor: withAlphaHex(
            surfaceColor,
            scheme === "dark" ? 0.7 : 0.94,
          ),
          borderWidth: 1,
          borderColor: withAlphaHex(color, scheme === "dark" ? 0.38 : 0.24),
          shadowColor: color,
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: scheme === "dark" ? 0.2 : 0.14,
          shadowRadius: 12,
          elevation: 4,
        },
        style,
      ]}
    >
      <BadgeFilm color={color} scheme={scheme} />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 4,
          left: 5,
          width: token.box - 10,
          height: token.highlightHeight,
          borderRadius: token.radius,
          backgroundColor: withAlphaHex(
            colors.surface,
            scheme === "dark" ? 0.1 : 0.42,
          ),
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          right: -Math.round(token.box * 0.24),
          bottom: -Math.round(token.box * 0.28),
          width: Math.round(token.box * 0.74),
          height: Math.round(token.box * 0.74),
          borderRadius: token.box,
          backgroundColor: withAlphaHex(color, scheme === "dark" ? 0.18 : 0.12),
        }}
      />
      <Icon icon={icon} size={token.icon} color={color} strokeWidth={2.35} />
    </View>
  );
}

function BadgeFilm({ color, scheme }: { color: string; scheme: ThemeScheme }) {
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          backgroundColor: withAlphaHex(color, scheme === "dark" ? 0.1 : 0.07),
        },
      ]}
    />
  );
}
