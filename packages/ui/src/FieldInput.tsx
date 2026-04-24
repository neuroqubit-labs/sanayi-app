import { forwardRef } from "react";
import { TextInput } from "react-native";

import { Input, type InputProps } from "./Input";

export type FieldInputProps = InputProps;

export const FieldInput = forwardRef<TextInput, FieldInputProps>(
  function FieldInput(props, ref) {
    return <Input ref={ref} {...props} />;
  },
);
