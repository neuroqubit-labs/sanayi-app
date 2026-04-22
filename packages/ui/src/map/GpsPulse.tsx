import type { LatLng } from "@naro/domain";
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

import { useMap } from "./MapContext";

const CORE_SIZE = 14;
const RING_SIZE = 44;

export type GpsPulseProps = {
  coord: LatLng;
  color?: string;
};

export function GpsPulse({ coord, color = "#0ea5e9" }: GpsPulseProps) {
  const { project } = useMap();
  const pos = project(coord);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [progress]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.4 + progress.value * 1.2 }],
    opacity: 1 - progress.value,
  }));

  return (
    <View
      pointerEvents="none"
      className="absolute items-center justify-center"
      style={{
        left: `${pos.x * 100}%`,
        top: `${pos.y * 100}%`,
        width: RING_SIZE,
        height: RING_SIZE,
        transform: [
          { translateX: -RING_SIZE / 2 },
          { translateY: -RING_SIZE / 2 },
        ],
      }}
    >
      <Animated.View
        style={[
          {
            position: "absolute",
            inset: 0,
            borderRadius: 999,
            backgroundColor: `${color}33`,
            borderWidth: 1,
            borderColor: color,
          },
          ringStyle,
        ]}
      />
      <View
        style={{
          width: CORE_SIZE,
          height: CORE_SIZE,
          borderRadius: 999,
          backgroundColor: color,
          borderWidth: 2,
          borderColor: "#f5f7ff",
        }}
      />
    </View>
  );
}
