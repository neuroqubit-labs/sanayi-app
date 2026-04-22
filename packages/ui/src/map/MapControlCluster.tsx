import type { LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Icon } from "../Icon";

import { useMap } from "./MapContext";
import { MAP_THEME } from "./tokens";

export type MapControlButton = {
  key: string;
  icon: LucideIcon;
  accessibilityLabel: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
};

export type MapControlClusterProps = {
  buttons: MapControlButton[];
  size?: number;
};

export function MapControlCluster({
  buttons,
  size = 36,
}: MapControlClusterProps) {
  const { theme } = useMap();
  const themeTokens = MAP_THEME[theme];

  return (
    <View className="gap-2">
      {buttons.map((btn) => (
        <Pressable
          key={btn.key}
          accessibilityRole="button"
          accessibilityLabel={btn.accessibilityLabel}
          disabled={btn.disabled}
          onPress={btn.onPress}
          className="items-center justify-center rounded-full border active:opacity-80"
          style={{
            width: size,
            height: size,
            backgroundColor: btn.active
              ? `${themeTokens.radiusStroke}55`
              : themeTokens.scrim,
            borderColor: btn.active ? themeTokens.radiusStroke : themeTokens.grid,
            opacity: btn.disabled ? 0.5 : 1,
          }}
        >
          <Icon
            icon={btn.icon}
            size={15}
            color={btn.active ? themeTokens.radiusStroke : themeTokens.textOnMap}
          />
        </Pressable>
      ))}
    </View>
  );
}
