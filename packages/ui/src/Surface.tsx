import { forwardRef, type ReactNode } from "react";
import { View, type ViewProps, type ViewStyle, type StyleProp } from "react-native";

import {
  shellElevation,
  shellRadius,
  type ShellRadiusKey,
} from "./tokens";

export type SurfaceVariant = "flat" | "raised" | "hero";

export type SurfaceProps = Omit<ViewProps, "children"> & {
  variant?: SurfaceVariant;
  radius?: ShellRadiusKey;
  accent?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

const VARIANT_CLASS: Record<SurfaceVariant, string> = {
  flat: "border border-app-outline bg-app-surface",
  raised: "border border-app-outline/70 bg-app-surface",
  hero: "border border-app-outline/60 bg-app-surface",
};

export const Surface = forwardRef<View, SurfaceProps>(function Surface(
  {
    variant = "flat",
    radius = "md",
    accent,
    className,
    style,
    children,
    ...rest
  },
  ref,
) {
  const borderRadius = shellRadius[radius];
  const elevation =
    variant === "raised"
      ? shellElevation.medium
      : variant === "hero"
        ? shellElevation.high
        : null;
  const accentBorder: ViewStyle | null = accent
    ? { borderTopColor: accent, borderTopWidth: 2 }
    : null;
  const classes = [VARIANT_CLASS[variant], className].filter(Boolean).join(" ");

  return (
    <View
      ref={ref}
      className={classes}
      style={[{ borderRadius }, elevation, accentBorder, style]}
      {...rest}
    >
      {children}
    </View>
  );
});
