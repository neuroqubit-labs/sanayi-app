import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";

import { Input, type InputProps } from "./Input";

export type FormFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = Omit<InputProps, "value" | "onChangeText" | "onBlur" | "error"> & {
  control: Control<TFieldValues>;
  name: TName;
};

export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ control, name, ...inputProps }: FormFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
        <Input
          value={typeof value === "string" ? value : (value?.toString() ?? "")}
          onChangeText={onChange}
          onBlur={onBlur}
          error={error?.message}
          {...inputProps}
        />
      )}
    />
  );
}
