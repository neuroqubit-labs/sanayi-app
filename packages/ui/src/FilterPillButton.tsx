import { Pressable, type Insets } from "react-native";
import { SlidersHorizontal, type LucideIcon } from "lucide-react-native";

import { Icon } from "./Icon";
import { Text } from "./Text";
import { useNaroTheme } from "./theme";

const HIT_SLOP: Insets = { bottom: 8, left: 8, right: 8, top: 8 };

export type FilterPillButtonProps = {
  label?: string;
  count?: number;
  active?: boolean;
  expanded?: boolean;
  onPress: () => void;
  icon?: LucideIcon;
  accessibilityLabel?: string;
  className?: string;
};

export function FilterPillButton({
  label = "Filtre",
  count = 0,
  active = false,
  expanded = false,
  onPress,
  icon = SlidersHorizontal,
  accessibilityLabel,
  className,
}: FilterPillButtonProps) {
  const { colors } = useNaroTheme();
  const highlighted = active || expanded;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        (expanded ? "Filtreleri gizle" : "Filtreleri göster")
      }
      accessibilityState={{ expanded }}
      hitSlop={HIT_SLOP}
      onPress={onPress}
      className={[
        "h-[46px] flex-row items-center gap-2 rounded-full border px-3.5 active:opacity-80",
        highlighted
          ? "border-brand-500/40 bg-brand-500/10"
          : "border-app-outline bg-app-surface",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Icon
        icon={icon}
        size={18}
        color={highlighted ? colors.info : colors.textSubtle}
      />
      <Text
        variant="label"
        tone={highlighted ? "accent" : "muted"}
        className="text-[12px]"
      >
        {label}
        {count > 0 ? ` ${count}` : ""}
      </Text>
    </Pressable>
  );
}
