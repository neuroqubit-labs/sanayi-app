import { forwardRef } from "react";
import { TextInput, type StyleProp, type TextStyle } from "react-native";

import { Input, type InputProps } from "./Input";

export type FieldInputProps = InputProps & {
  /** Convenience textarea mode: multiline + top aligned + stable height. */
  textarea?: boolean;
  /** Approximate visible text rows for multiline fields. */
  rows?: number;
  /** Numeric keyboard + punctuation-safe decimal entry where platform allows. */
  numeric?: boolean;
};

export const FieldInput = forwardRef<TextInput, FieldInputProps>(
  function FieldInput(
    {
      textarea = false,
      rows,
      numeric = false,
      multiline,
      textAlignVertical,
      keyboardType,
      style,
      inputClassName,
      ...rest
    },
    ref,
  ) {
    const isMultiline = multiline ?? textarea;
    const minHeight = rows ? Math.max(48, rows * 24 + 28) : textarea ? 96 : 48;

    return (
      <Input
        ref={ref}
        multiline={isMultiline}
        textAlignVertical={
          isMultiline ? (textAlignVertical ?? "top") : textAlignVertical
        }
        keyboardType={numeric ? (keyboardType ?? "numeric") : keyboardType}
        inputClassName={inputClassName}
        style={[{ minHeight }, style] as StyleProp<TextStyle>}
        {...rest}
      />
    );
  },
);
