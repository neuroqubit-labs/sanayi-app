import { forwardRef } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { Text } from "./Text";
import { useNaroTheme } from "./theme";

export type InputProps = Omit<TextInputProps, "className"> & {
  label?: string;
  error?: string;
  helper?: string;
  containerClassName?: string;
  inputClassName?: string;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    error,
    helper,
    containerClassName,
    inputClassName,
    editable = true,
    ...rest
  },
  ref,
) {
  const { colors } = useNaroTheme();
  const hasError = Boolean(error);
  const borderClass = hasError ? "border-app-critical" : "border-app-outline";

  const inputClass = [
    "min-h-[48px] rounded-xl border px-4 py-3 text-base",
    borderClass,
    editable
      ? "bg-app-surface text-app-text"
      : "bg-app-surface-2 text-app-text-muted",
    inputClassName ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <View
      className={["gap-2", containerClassName ?? ""].filter(Boolean).join(" ")}
    >
      {label ? (
        <Text variant="caption" tone="calm" className="font-medium">
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        editable={editable}
        placeholderTextColor={colors.textSubtle}
        className={inputClass}
        {...rest}
      />
      {hasError ? (
        <Text variant="caption" tone="panic">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="caption" tone="muted">
          {helper}
        </Text>
      ) : null}
    </View>
  );
});
