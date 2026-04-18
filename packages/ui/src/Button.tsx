import { forwardRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text as RNText,
  View,
  type PressableProps,
  type View as ViewType,
} from "react-native";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

export type ButtonProps = Omit<PressableProps, "children"> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  fullWidth?: boolean;
};

const CONTAINER_BASE = "flex-row items-center justify-center rounded-xl";

const VARIANT_CONTAINER: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 active:bg-brand-900",
  secondary: "bg-neutral-200 active:bg-neutral-300",
  ghost: "bg-transparent border border-neutral-300 active:bg-neutral-100",
  danger: "bg-red-600 active:bg-red-800",
};

const VARIANT_LABEL: Record<ButtonVariant, string> = {
  primary: "text-white font-semibold",
  secondary: "text-neutral-900 font-semibold",
  ghost: "text-neutral-900 font-semibold",
  danger: "text-white font-semibold",
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

const SPINNER_COLOR: Record<ButtonVariant, string> = {
  primary: "#ffffff",
  secondary: "#111827",
  ghost: "#111827",
  danger: "#ffffff",
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
    className,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
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

  const labelClass = [VARIANT_LABEL[variant], SIZE_LABEL[size]].join(" ");

  return (
    <Pressable
      ref={ref as never}
      accessibilityRole="button"
      disabled={isDisabled}
      className={containerClass}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={SPINNER_COLOR[variant]} />
      ) : (
        <>
          {leftIcon ? <View>{leftIcon}</View> : null}
          <RNText className={labelClass}>{label}</RNText>
        </>
      )}
    </Pressable>
  );
});
