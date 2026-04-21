import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  UIManager,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { Icon } from "../Icon";
import { Text } from "../Text";
import { shellSpring } from "../tokens";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  title: string;
  meta?: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  accent?: string;
  titleIcon?: LucideIcon;
  preview?: ReactNode;
};

export function CollapsibleSection({
  title,
  meta,
  description,
  defaultOpen = false,
  children,
  accent,
  titleIcon,
  preview,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((prev) => !prev);
  };

  return (
    <View className="gap-3">
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={`${title} bölümünü ${open ? "kapat" : "aç"}`}
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        onPressIn={() => {
          scale.value = withSpring(0.98, shellSpring.snappy);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, shellSpring.snappy);
        }}
        className="gap-2 rounded-[18px] border border-app-outline bg-app-surface px-4 py-3"
        style={animatedStyle}
      >
        <View className="flex-row items-center gap-3">
          {titleIcon ? (
            <View
              className="h-7 w-7 items-center justify-center rounded-full"
              style={{ backgroundColor: `${accent ?? "#83a7ff"}1f` }}
            >
              <Icon icon={titleIcon} size={14} color={accent ?? "#83a7ff"} />
            </View>
          ) : null}
          <View className="flex-1 gap-0.5">
            <View className="flex-row items-center gap-2">
              <Text
                variant="h3"
                tone="inverse"
                className="text-[15px]"
                style={accent ? { color: accent } : undefined}
              >
                {title}
              </Text>
              {meta ? (
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted text-[11px]"
                >
                  {meta}
                </Text>
              ) : null}
            </View>
            {description && open ? (
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[12px]"
              >
                {description}
              </Text>
            ) : null}
          </View>
          <Icon
            icon={open ? ChevronDown : ChevronRight}
            size={16}
            color={accent ?? "#83a7ff"}
          />
        </View>
        {!open && preview ? (
          <View className="pl-10">{preview}</View>
        ) : null}
      </AnimatedPressable>
      {open ? <View className="gap-2">{children}</View> : null}
    </View>
  );
}
