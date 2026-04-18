import { Pressable, Text, type PressableProps } from "react-native";

type Props = PressableProps & {
  label: string;
  variant?: "primary" | "secondary";
};

export function Button({ label, variant = "primary", disabled, ...rest }: Props) {
  const base = "rounded-xl px-4 py-3 items-center justify-center";
  const color =
    variant === "primary"
      ? "bg-brand-600 active:bg-brand-900"
      : "bg-neutral-200 active:bg-neutral-300";
  const opacity = disabled ? "opacity-50" : "";

  return (
    <Pressable className={`${base} ${color} ${opacity}`} disabled={disabled} {...rest}>
      <Text
        className={
          variant === "primary"
            ? "text-white font-semibold"
            : "text-neutral-900 font-semibold"
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
