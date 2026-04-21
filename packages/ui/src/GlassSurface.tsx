import { BlurView } from "expo-blur";
import { forwardRef, type ReactNode } from "react";
import {
  Platform,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import {
  shellMaterial,
  shellRadius,
  type ShellMaterialKey,
  type ShellRadiusKey,
} from "./tokens";

export type GlassSurfaceProps = {
  variant?: ShellMaterialKey;
  radius?: ShellRadiusKey;
  tint?: "light" | "dark" | "default";
  className?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * iOS'ta native blur (`expo-blur`), Android'de solid `fallbackBg`.
 * Alt yüzey olarak kullanılır; kendi elevation'ı yok — üst sarmalayıcı verir.
 */
export const GlassSurface = forwardRef<View, GlassSurfaceProps>(
  function GlassSurface(
    { variant = "chrome", radius = "md", tint, className, style, children },
    ref,
  ) {
    const preset = shellMaterial[variant];
    const borderRadius = shellRadius[radius];
    const resolvedTint = tint ?? preset.tint;
    const classes = ["overflow-hidden", className].filter(Boolean).join(" ");

    if (Platform.OS !== "ios") {
      return (
        <View
          ref={ref}
          className={classes}
          style={[
            { borderRadius, backgroundColor: preset.fallbackBg },
            style,
          ]}
        >
          {children}
        </View>
      );
    }

    return (
      <BlurView
        ref={ref as never}
        intensity={preset.intensity}
        tint={resolvedTint}
        className={classes}
        style={[{ borderRadius }, style]}
      >
        {children}
      </BlurView>
    );
  },
);
