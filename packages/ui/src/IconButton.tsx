import type { ReactNode } from "react";
import {
  Pressable,
  View,
  type Insets,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export type IconButtonVariant = "ghost" | "surface" | "brand";
export type IconButtonSize = "sm" | "md" | "lg";

export type IconButtonProps = Omit<PressableProps, "children" | "style"> & {
  icon: ReactNode;
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

const DEFAULT_HIT_SLOP: Insets = { bottom: 8, left: 8, right: 8, top: 8 };

const VARIANT_CLASS: Record<IconButtonVariant, string> = {
  ghost: "bg-transparent active:bg-app-surface-2",
  surface: "border border-app-outline bg-app-surface active:bg-app-surface-2",
  brand: "border border-brand-500/35 bg-brand-500 active:opacity-90",
};

const SIZE_STYLE: Record<IconButtonSize, ViewStyle> = {
  sm: { borderRadius: 14, height: 44, width: 44 },
  md: { borderRadius: 16, height: 48, width: 48 },
  lg: { borderRadius: 18, height: 56, width: 56 },
};

export function IconButton({
  icon,
  label,
  variant = "surface",
  size = "sm",
  className,
  hitSlop,
  accessibilityLabel,
  accessibilityRole,
  style,
  ...rest
}: IconButtonProps) {
  const composed = [
    "items-center justify-center",
    VARIANT_CLASS[variant],
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole={accessibilityRole ?? "button"}
      hitSlop={hitSlop ?? DEFAULT_HIT_SLOP}
      className={composed}
      style={[SIZE_STYLE[size], style]}
      {...rest}
    >
      <View pointerEvents="none">{icon}</View>
    </Pressable>
  );
}
