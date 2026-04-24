import { Pressable, View } from "react-native";
import { ChevronDown } from "lucide-react-native";

import { Icon } from "./Icon";
import { Text } from "./Text";
import { useNaroTheme } from "./theme";

export type VehicleContextBarProps = {
  plate: string;
  vehicle: string;
  subtitle?: string;
  onPress?: () => void;
};

export function VehicleContextBar({
  plate,
  vehicle,
  subtitle,
  onPress,
}: VehicleContextBarProps) {
  const { colors } = useNaroTheme();
  const content = (
    <>
      <View className="gap-1">
        <Text variant="h3" tone="inverse">
          {plate}
        </Text>
        <Text tone="muted" className="text-app-text-muted">
          {vehicle}
          {subtitle ? ` · ${subtitle}` : ""}
        </Text>
      </View>
      <View className="h-11 w-11 items-center justify-center rounded-full border border-app-outline bg-app-surface">
        <Icon icon={ChevronDown} size={18} color={colors.text} />
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${plate} araç seçici`}
        onPress={onPress}
        hitSlop={6}
        className="flex-row items-center justify-between gap-4"
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View className="flex-row items-center justify-between gap-4">
      {content}
    </View>
  );
}
