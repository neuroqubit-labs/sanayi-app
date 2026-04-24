import { Pressable, View } from "react-native";
import { ArrowLeft, X, type LucideIcon } from "lucide-react-native";

import { Icon } from "./Icon";
import { useNaroTheme } from "./theme";

export type BackButtonVariant = "back" | "close";

export type BackButtonProps = {
  onPress: () => void;
  variant?: BackButtonVariant;
  accessibilityLabel?: string;
  className?: string;
};

const VARIANT_ICON: Record<BackButtonVariant, LucideIcon> = {
  back: ArrowLeft,
  close: X,
};

const VARIANT_LABEL: Record<BackButtonVariant, string> = {
  back: "Geri",
  close: "Kapat",
};

export function BackButton({
  onPress,
  variant = "back",
  accessibilityLabel,
  className,
}: BackButtonProps) {
  const { colors } = useNaroTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? VARIANT_LABEL[variant]}
      onPress={onPress}
      hitSlop={6}
      className={[
        "h-11 w-11 items-center justify-center rounded-full border border-app-outline bg-app-surface active:bg-app-surface-2",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <View>
        <Icon icon={VARIANT_ICON[variant]} size={18} color={colors.text} />
      </View>
    </Pressable>
  );
}
