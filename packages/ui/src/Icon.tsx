import type { LucideIcon, LucideProps } from "lucide-react-native";

export type IconProps = LucideProps & {
  icon: LucideIcon;
};

export function Icon({ icon: IconComponent, size = 24, strokeWidth = 2, color, ...rest }: IconProps) {
  return <IconComponent size={size} strokeWidth={strokeWidth} color={color ?? "#111827"} {...rest} />;
}
