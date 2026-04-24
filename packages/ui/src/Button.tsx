import { forwardRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text as RNText,
  View,
  type GestureResponderEvent,
  type Insets,
  type PressableProps,
  type StyleProp,
  type View as ViewType,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { shellSpring } from "./tokens";
import { useNaroTheme } from "./theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "surface"
  | "outline";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
  labelClassName?: string;
  style?: StyleProp<ViewStyle>;
};

const CONTAINER_BASE =
  "relative overflow-hidden flex-row items-center justify-center rounded-xl";

const VARIANT_CONTAINER: Record<ButtonVariant, string> = {
  primary: "border border-brand-200/25 bg-brand-500",
  secondary: "bg-neutral-200 active:bg-neutral-300",
  ghost: "bg-transparent border border-neutral-300 active:bg-neutral-100",
  danger: "bg-red-600 active:bg-red-800",
  surface: "bg-app-surface-2 border border-app-outline active:bg-app-surface-3",
  outline: "bg-transparent border border-app-outline active:bg-app-surface",
};

const VARIANT_LABEL: Record<ButtonVariant, string> = {
  primary: "text-white font-semibold",
  secondary: "text-neutral-900 font-semibold",
  ghost: "text-neutral-900 font-semibold",
  danger: "text-white font-semibold",
  surface: "text-app-text font-semibold",
  outline: "text-app-text font-semibold",
};

const SIZE_CONTAINER: Record<ButtonSize, string> = {
  sm: "h-9 px-3 gap-2",
  md: "h-11 px-4 gap-2",
  lg: "h-12 px-5 gap-2",
  xl: "h-14 px-6 gap-3",
};

const SIZE_LABEL: Record<ButtonSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-base",
  xl: "text-lg",
};

const DEFAULT_HIT_SLOP: Insets = { bottom: 4, left: 4, right: 4, top: 4 };

const PRIMARY_BUTTON_STYLE: ViewStyle = {
  shadowColor: "#021c34",
  shadowOffset: { width: 0, height: 14 },
  shadowOpacity: 0.3,
  shadowRadius: 18,
  elevation: 12,
};

const PRIMARY_SURFACE_STYLE: ViewStyle = {
  position: "absolute",
  inset: 1,
  borderRadius: 11,
  backgroundColor: "transparent",
};

const PRIMARY_TOP_HIGHLIGHT_STYLE: ViewStyle = {
  position: "absolute",
  left: 7,
  right: 7,
  top: 4,
  height: "50%",
  borderRadius: 999,
  backgroundColor: "rgba(255,255,255,0.16)",
};

const PRIMARY_BOTTOM_DEPTH_STYLE: ViewStyle = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: "44%",
  borderBottomLeftRadius: 12,
  borderBottomRightRadius: 12,
  backgroundColor: "rgba(3,72,123,0.34)",
};

const PRIMARY_DIAGONAL_SHEEN_STYLE: ViewStyle = {
  position: "absolute",
  left: 18,
  top: -10,
  width: 170,
  height: 46,
  borderRadius: 28,
  backgroundColor: "rgba(255,255,255,0.12)",
  transform: [{ rotate: "-7deg" }],
};

const PRIMARY_AURA_STYLE: ViewStyle = {
  position: "absolute",
  right: -18,
  bottom: -18,
  width: 110,
  height: 74,
  borderRadius: 999,
  backgroundColor: "rgba(111,221,255,0.16)",
};

const PRIMARY_INNER_EDGE_STYLE: ViewStyle = {
  position: "absolute",
  inset: 1,
  borderRadius: 11,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
};

export const Button = forwardRef<ViewType, ButtonProps>(function Button(
  {
    label,
    variant = "primary",
    size = "md",
    loading = false,
    leftIcon,
    fullWidth = false,
    disabled,
    hitSlop,
    accessibilityRole,
    onPressIn,
    onPressOut,
    className,
    labelClassName,
    style,
    ...rest
  },
  ref,
) {
  const { colors } = useNaroTheme();
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const containerClass = [
    CONTAINER_BASE,
    VARIANT_CONTAINER[variant],
    SIZE_CONTAINER[size],
    fullWidth ? "self-stretch" : "self-start",
    isDisabled ? "opacity-50" : "",
    typeof className === "string" ? className : "",
  ]
    .filter(Boolean)
    .join(" ");

  const labelClass = [
    VARIANT_LABEL[variant],
    SIZE_LABEL[size],
    labelClassName ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const spinnerColor =
    variant === "primary" || variant === "danger" ? "#ffffff" : colors.text;

  return (
    <AnimatedPressable
      ref={ref as never}
      accessibilityRole={accessibilityRole ?? "button"}
      disabled={isDisabled}
      hitSlop={hitSlop ?? DEFAULT_HIT_SLOP}
      onPressIn={(event: GestureResponderEvent) => {
        scale.value = withSpring(0.97, shellSpring.snappy);
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        scale.value = withSpring(1, shellSpring.snappy);
        onPressOut?.(event);
      }}
      className={containerClass}
      style={[
        variant === "primary"
          ? [PRIMARY_BUTTON_STYLE, { shadowColor: colors.shadow }]
          : null,
        animatedStyle,
        style,
      ]}
      {...rest}
    >
      {variant === "primary" ? (
        <View pointerEvents="none" style={PRIMARY_SURFACE_STYLE}>
          <View style={PRIMARY_TOP_HIGHLIGHT_STYLE} />
          <View style={PRIMARY_BOTTOM_DEPTH_STYLE} />
          <View style={PRIMARY_DIAGONAL_SHEEN_STYLE} />
          <View style={PRIMARY_AURA_STYLE} />
          <View style={PRIMARY_INNER_EDGE_STYLE} />
        </View>
      ) : null}
      {loading ? (
        <View className="relative z-10">
          <ActivityIndicator size="small" color={spinnerColor} />
        </View>
      ) : (
        <>
          {leftIcon ? <View className="relative z-10">{leftIcon}</View> : null}
          <RNText className={`${labelClass} relative z-10`}>{label}</RNText>
        </>
      )}
    </AnimatedPressable>
  );
});
