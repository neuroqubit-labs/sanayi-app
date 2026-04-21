import { forwardRef, type ReactNode } from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type View,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import {
  shellElevation,
  shellRadius,
  shellSpring,
  type ShellRadiusKey,
} from "./tokens";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableCardVariant = "flat" | "elevated";

export type PressableCardProps = Omit<
  PressableProps,
  "children" | "style" | "onPressIn" | "onPressOut"
> & {
  variant?: PressableCardVariant;
  radius?: ShellRadiusKey;
  className?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

const VARIANT_CLASS: Record<PressableCardVariant, string> = {
  flat: "border border-app-outline bg-app-surface",
  elevated: "border border-app-outline/70 bg-app-surface",
};

export const PressableCard = forwardRef<View, PressableCardProps>(
  function PressableCard(
    {
      variant = "flat",
      radius = "md",
      className,
      style,
      children,
      disabled,
      ...rest
    },
    ref,
  ) {
    const scale = useSharedValue(1);
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));
    const borderRadius = shellRadius[radius];
    const elevation = variant === "elevated" ? shellElevation.low : null;
    const classes = [VARIANT_CLASS[variant], className]
      .filter(Boolean)
      .join(" ");

    return (
      <AnimatedPressable
        ref={ref as never}
        disabled={disabled}
        onPressIn={() => {
          scale.value = withSpring(0.97, shellSpring.snappy);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, shellSpring.snappy);
        }}
        className={classes}
        style={[{ borderRadius }, elevation, animatedStyle, style]}
        {...rest}
      >
        {children}
      </AnimatedPressable>
    );
  },
);
