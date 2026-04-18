import { View } from "react-native";

import { Text } from "./Text";

export type AvatarSize = "sm" | "md" | "lg";

export type AvatarProps = {
  /** Kullanıcının adı — ilk harfleri initial olarak kullanılır. */
  name?: string;
  size?: AvatarSize;
  className?: string;
};

const SIZE_CONTAINER: Record<AvatarSize, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
};

const SIZE_TEXT: Record<AvatarSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

function initials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

export function Avatar({ name, size = "md", className }: AvatarProps) {
  const composed = [
    "items-center justify-center rounded-full bg-brand-50",
    SIZE_CONTAINER[size],
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <View className={composed}>
      <Text className={`${SIZE_TEXT[size]} font-semibold text-brand-600`}>{initials(name)}</Text>
    </View>
  );
}
