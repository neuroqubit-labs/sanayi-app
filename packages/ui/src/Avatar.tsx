import { Image, View } from "react-native";

import { Text } from "./Text";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

export type AvatarProps = {
  /** Kullanıcının adı — ilk harfleri initial olarak kullanılır. */
  name?: string;
  imageUri?: string | null;
  size?: AvatarSize;
  className?: string;
};

const SIZE_CONTAINER: Record<AvatarSize, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
  xl: "h-[72px] w-[72px]",
};

const SIZE_TEXT: Record<AvatarSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-2xl",
};

function initials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (
    parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)
  ).toUpperCase();
}

export function Avatar({ name, imageUri, size = "md", className }: AvatarProps) {
  const composed = [
    "items-center justify-center rounded-full border border-app-outline bg-app-surface-2",
    SIZE_CONTAINER[size],
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <View className={composed}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} className="h-full w-full rounded-full" />
      ) : (
        <Text className={`${SIZE_TEXT[size]} font-semibold text-app-text`}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}
