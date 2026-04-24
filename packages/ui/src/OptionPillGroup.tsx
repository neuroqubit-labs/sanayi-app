import { View } from "react-native";

import { ToggleChip } from "./ToggleChip";

export type OptionPillGroupOption<TKey extends string = string> = {
  key: TKey;
  label: string;
  disabled?: boolean;
};

export type OptionPillGroupProps<TKey extends string = string> = {
  options: OptionPillGroupOption<TKey>[];
  selectedKey: TKey | null;
  onSelect: (key: TKey) => void;
  size?: "sm" | "md";
  className?: string;
};

export function OptionPillGroup<TKey extends string = string>({
  options,
  selectedKey,
  onSelect,
  size = "sm",
  className,
}: OptionPillGroupProps<TKey>) {
  return (
    <View className={["flex-row flex-wrap gap-2", className ?? ""].join(" ")}>
      {options.map((option) => (
        <ToggleChip
          key={option.key}
          label={option.label}
          selected={selectedKey === option.key}
          disabled={option.disabled}
          size={size}
          onPress={() => onSelect(option.key)}
        />
      ))}
    </View>
  );
}
