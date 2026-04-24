import { Image, Pressable, View } from "react-native";
import { Camera, Plus, Trash2 } from "lucide-react-native";

import { Icon } from "./Icon";
import { Text } from "./Text";
import { useNaroTheme } from "./theme";

export type PhotoGridItem = {
  id: string;
  uri?: string;
  label?: string;
};

export type PhotoGridProps = {
  items: PhotoGridItem[];
  onAdd?: () => void;
  onRemove?: (id: string) => void;
  min?: number;
  max?: number;
  title?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

export function PhotoGrid({
  items,
  onAdd,
  onRemove,
  min,
  max,
  title,
  hint,
  required = false,
  disabled = false,
  className,
}: PhotoGridProps) {
  const { colors, scheme } = useNaroTheme();
  const reachedMax = max !== undefined && items.length >= max;
  const belowMin = min !== undefined && items.length < min;
  const onImageOverlay = scheme === "dark" ? colors.text : colors.surface;

  return (
    <View className={["gap-3", className ?? ""].filter(Boolean).join(" ")}>
      {title ? (
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text variant="label" tone="inverse">
              {title}
            </Text>
            {hint ? (
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted"
              >
                {hint}
              </Text>
            ) : null}
          </View>
          {max !== undefined ? (
            <Text variant="caption" tone={belowMin ? "warning" : "subtle"}>
              {items.length}/{max}
              {required ? " · zorunlu" : ""}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View className="flex-row flex-wrap gap-3">
        {items.map((item) => (
          <View
            key={item.id}
            className="h-24 w-24 overflow-hidden rounded-[18px] border border-app-outline bg-app-surface-2"
          >
            {item.uri ? (
              <Image source={{ uri: item.uri }} className="h-full w-full" />
            ) : (
              <View className="flex-1 items-center justify-center">
                <Icon icon={Camera} size={20} color={colors.textSubtle} />
              </View>
            )}
            {onRemove && !disabled ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fotoğrafı kaldır"
                onPress={() => onRemove(item.id)}
                hitSlop={8}
                className="absolute right-1 top-1 h-7 w-7 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.overlayStrong }}
              >
                <Icon icon={Trash2} size={12} color={onImageOverlay} />
              </Pressable>
            ) : null}
            {item.label ? (
              <View
                className="absolute inset-x-0 bottom-0 px-2 py-1"
                style={{ backgroundColor: colors.overlayStrong }}
              >
                <Text
                  variant="caption"
                  tone="inverse"
                  className="text-[10px]"
                  numberOfLines={1}
                  style={{ color: onImageOverlay }}
                >
                  {item.label}
                </Text>
              </View>
            ) : null}
          </View>
        ))}

        {onAdd && !reachedMax && !disabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fotoğraf ekle"
            onPress={onAdd}
            hitSlop={4}
            className="h-24 w-24 items-center justify-center rounded-[18px] border border-dashed border-app-outline bg-app-surface active:bg-app-surface-2"
          >
            <Icon icon={Plus} size={22} color={colors.info} />
            <Text variant="caption" tone="subtle" className="mt-1">
              Ekle
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
