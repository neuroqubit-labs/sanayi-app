import { Pressable, View } from "react-native";
import { ChevronDown } from "lucide-react-native";

import { Icon } from "./Icon";
import { Text } from "./Text";

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
        <Icon icon={ChevronDown} size={18} color="#f5f7ff" />
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className="flex-row items-center justify-between gap-4"
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View className="flex-row items-center justify-between gap-4">{content}</View>
  );
}
