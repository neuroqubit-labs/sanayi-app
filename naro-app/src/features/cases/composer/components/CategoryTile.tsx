import { GesturePressable as Pressable, Icon, Text } from "@naro/ui";
import { Check, type LucideIcon } from "lucide-react-native";
import { View } from "react-native";

export type CategoryTileProps = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  badge?: string;
  selected?: boolean;
  density?: "default" | "compact";
  onPress: () => void;
};

export function CategoryTile({
  icon,
  title,
  subtitle,
  badge,
  selected = false,
  density = "default",
  onPress,
}: CategoryTileProps) {
  if (density === "compact") {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${title} kategorisini seç`}
        onPress={onPress}
        className={[
          "flex-1 flex-row items-center gap-3 rounded-[20px] border px-3.5 py-3 active:opacity-90",
          selected
            ? "border-brand-500 bg-brand-500/15"
            : "border-app-outline bg-app-surface",
        ].join(" ")}
        style={{ minHeight: 86 }}
      >
        <View
          className={[
            "h-11 w-11 items-center justify-center rounded-[15px] border",
            selected
              ? "border-brand-500/40 bg-brand-500/20"
              : "border-app-outline bg-app-surface-2",
          ].join(" ")}
        >
          <Icon
            icon={icon}
            size={20}
            color={selected ? "#0ea5e9" : "#83a7ff"}
          />
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="label" tone="inverse" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              variant="caption"
              tone="muted"
              numberOfLines={2}
              className="text-app-text-muted text-[12px] leading-[16px]"
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {selected ? (
          <View className="h-6 w-6 items-center justify-center rounded-full bg-brand-500">
            <Icon icon={Check} size={12} color="#ffffff" />
          </View>
        ) : null}
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title} kategorisini seç`}
      onPress={onPress}
      className={[
        "flex-1 gap-3 rounded-[22px] border px-4 py-4 active:opacity-90",
        selected
          ? "border-brand-500 bg-brand-500/15"
          : "border-app-outline bg-app-surface",
      ].join(" ")}
      style={{ minHeight: 136 }}
    >
      <View className="flex-row items-start justify-between">
        <View
          className={[
            "h-12 w-12 items-center justify-center rounded-[16px] border",
            selected
              ? "border-brand-500/40 bg-brand-500/20"
              : "border-app-outline bg-app-surface-2",
          ].join(" ")}
        >
          <Icon
            icon={icon}
            size={22}
            color={selected ? "#0ea5e9" : "#83a7ff"}
          />
        </View>
        {badge ? (
          <View className="rounded-full border border-app-outline bg-app-surface-2 px-2 py-0.5">
            <Text variant="caption" tone="subtle" className="text-[10px]">
              {badge}
            </Text>
          </View>
        ) : selected ? (
          <View className="h-6 w-6 items-center justify-center rounded-full bg-brand-500">
            <Icon icon={Check} size={12} color="#ffffff" />
          </View>
        ) : null}
      </View>
      <View className="gap-0.5">
        <Text variant="label" tone="inverse">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
