import { Icon, Text } from "@naro/ui";
import { Check, type LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";

export type CategoryTileProps = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  selected?: boolean;
  onPress: () => void;
};

export function CategoryTile({
  icon,
  title,
  subtitle,
  selected = false,
  onPress,
}: CategoryTileProps) {
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
          <Icon icon={icon} size={22} color={selected ? "#0ea5e9" : "#83a7ff"} />
        </View>
        {selected ? (
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
