import { forwardRef } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { Text } from "./Text";

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
  const hasError = Boolean(error);
  const borderClass = hasError ? "border-red-500" : "border-neutral-300";

  const inputClass = [
    "border rounded-xl px-4 py-3 text-base",
    borderClass,
    editable ? "text-neutral-900" : "text-neutral-500 bg-neutral-100",
    inputClassName ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <View className={["gap-2", containerClassName ?? ""].filter(Boolean).join(" ")}>
      {label ? (
        <Text variant="caption" tone="calm" className="font-medium">
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        editable={editable}
        placeholderTextColor="#9ca3af"
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
