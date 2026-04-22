import type { LatLng } from "@naro/domain";
import { Truck } from "lucide-react-native";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Icon } from "../Icon";

import { useMap } from "./MapContext";
import { MAP_PIN_COLORS, MAP_THEME } from "./tokens";

const SIZE = 44;

export type TruckMarkerProps = {
  coord: LatLng;
  /** 0-360°, bearing. Rotasyon icon üstünde uygulanır. */
  heading?: number;
  /** Canlı konum olduğunu göstermek için halka pulse. */
  pulse?: boolean;
  colorOverride?: string;
};

export function TruckMarker({
  coord,
  heading,
  pulse = true,
  colorOverride,
}: TruckMarkerProps) {
  const { project, theme } = useMap();
  const pos = project(coord);
  const color = colorOverride ?? MAP_PIN_COLORS.driver;
  const themeTokens = MAP_THEME[theme];

  const pulseValue = useSharedValue(0);

  useEffect(() => {
    if (!pulse) {
      cancelAnimation(pulseValue);
      pulseValue.value = 0;
      return;
    }
    pulseValue.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(pulseValue);
    };
  }, [pulse, pulseValue]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulseValue.value * 1.4 }],
    opacity: 1 - pulseValue.value,
  }));

  return (
    <View
      pointerEvents="none"
      className="absolute items-center justify-center"
      style={{
        left: `${pos.x * 100}%`,
        top: `${pos.y * 100}%`,
        transform: [{ translateX: -SIZE / 2 }, { translateY: -SIZE / 2 }],
        width: SIZE,
        height: SIZE,
      }}
    >
      {pulse ? (
        <Animated.View
          style={[
            {
              position: "absolute",
              inset: 0,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: color,
            },
            ringStyle,
          ]}
        />
      ) : null}
      <View
        className="items-center justify-center rounded-full border-2"
        style={{
          width: SIZE * 0.72,
          height: SIZE * 0.72,
          backgroundColor: color,
          borderColor: themeTokens.background,
          transform:
            typeof heading === "number" ? [{ rotate: `${heading}deg` }] : [],
        }}
      >
        <Icon icon={Truck} size={16} color="#11182a" />
      </View>
    </View>
  );
}
