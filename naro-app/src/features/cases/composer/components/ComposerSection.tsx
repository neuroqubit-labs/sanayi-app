import { Text } from "@naro/ui";
import type { ReactNode } from "react";
import { View } from "react-native";

export type ComposerSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function ComposerSection({
  title,
  description,
  children,
  className,
}: ComposerSectionProps) {
  return (
    <View
      className={[
        "gap-3 rounded-[28px] border border-app-outline bg-app-surface px-4 py-4",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <View className="gap-1">
        <Text variant="h3" tone="inverse">
          {title}
        </Text>
        {description ? (
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            {description}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
