import type { ReactNode } from "react";
import {
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  Pressable,
  type PressableProps,
} from "react-native-gesture-handler";

export type GesturePressableProps = Omit<PressableProps, "children"> & {
  children?: ReactNode;
  className?: string;
  contentStyle?: StyleProp<ViewStyle>;
};

export function GesturePressable({
  children,
  className,
  contentStyle,
  ...pressableProps
}: GesturePressableProps) {
  return (
    <Pressable {...pressableProps}>
      <View className={className} style={contentStyle}>
        {children}
      </View>
    </Pressable>
  );
}
