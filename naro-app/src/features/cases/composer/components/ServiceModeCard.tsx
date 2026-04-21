import { Icon, Text } from "@naro/ui";
import { Check, type LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";

export type ServiceModeCardProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
};

export function ServiceModeCard({
  icon,
  title,
  subtitle,
  selected,
  onPress,
  disabled,
}: ServiceModeCardProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      accessibilityLabel={`${title} tercihi`}
      onPress={disabled ? undefined : onPress}
      className={[
        "flex-row items-center gap-3 rounded-[20px] border px-4 py-3.5 active:opacity-90",
        disabled
          ? "border-app-outline/40 bg-app-surface/50 opacity-60"
          : selected
            ? "border-brand-500 bg-brand-500/15"
            : "border-app-outline bg-app-surface",
      ].join(" ")}
    >
      <View
        className={[
          "h-11 w-11 items-center justify-center rounded-[14px] border",
          selected
            ? "border-brand-500/40 bg-brand-500/20"
            : "border-app-outline bg-app-surface-2",
        ].join(" ")}
      >
        <Icon icon={icon} size={20} color={selected ? "#0ea5e9" : "#83a7ff"} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="label" tone="inverse">
          {title}
        </Text>
        <Text variant="caption" tone="muted" className="text-app-text-muted">
          {subtitle}
        </Text>
      </View>
      {selected ? (
        <View className="h-6 w-6 items-center justify-center rounded-full bg-brand-500">
          <Icon icon={Check} size={12} color="#ffffff" />
        </View>
      ) : (
        <View className="h-6 w-6 rounded-full border border-app-outline bg-app-surface" />
      )}
    </Pressable>
  );
}
