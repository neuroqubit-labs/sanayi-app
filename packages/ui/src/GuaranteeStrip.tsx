import { View } from "react-native";
import { BadgeCheck } from "lucide-react-native";

import { Icon } from "./Icon";
import { Text } from "./Text";

export type GuaranteeStripItem = {
  id: string;
  title: string;
  untilLabel: string;
};

export type GuaranteeStripProps = {
  items: GuaranteeStripItem[];
  title?: string;
  emptyText?: string;
  className?: string;
};

export function GuaranteeStrip({
  items,
  title = "Aktif garantiler",
  emptyText = "Şu an kayıtlı aktif garanti yok.",
  className,
}: GuaranteeStripProps) {
  return (
    <View
      className={[
        "gap-3 rounded-[22px] border border-app-success/30 bg-app-success-soft px-4 py-4",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <View className="flex-row items-center gap-2">
        <Icon icon={BadgeCheck} size={18} color="#2dd28d" />
        <Text variant="eyebrow" tone="success">
          {title}
        </Text>
      </View>

      {items.length === 0 ? (
        <Text variant="caption" tone="muted" className="text-app-text-muted">
          {emptyText}
        </Text>
      ) : (
        <View className="gap-2">
          {items.map((item) => (
            <View
              key={item.id}
              className="flex-row items-center justify-between gap-3 rounded-[14px] border border-app-outline bg-app-surface px-3 py-2"
            >
              <Text variant="label" tone="inverse" className="flex-1">
                {item.title}
              </Text>
              <Text variant="caption" tone="success">
                {item.untilLabel}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
