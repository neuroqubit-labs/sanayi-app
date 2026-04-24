import type { LucideIcon, LucideProps } from "lucide-react-native";

import { useNaroTheme } from "./theme";

export type IconProps = LucideProps & {
  icon: LucideIcon;
};

export function Icon({
  icon: IconComponent,
  size = 24,
  strokeWidth = 2,
  color,
  ...rest
}: IconProps) {
  const { colors } = useNaroTheme();
  return (
    <IconComponent
      size={size}
      strokeWidth={strokeWidth}
      color={color ?? colors.text}
      {...rest}
    />
  );
}
