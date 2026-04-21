import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "./Text";
import { shellRadius } from "./tokens";

export type ActionSheetSurfaceProps = {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function ActionSheetSurface({
  title,
  description,
  children,
  footer,
}: ActionSheetSurfaceProps) {
  return (
    <View
      className="border border-app-outline-strong bg-app-surface-2 px-5 pb-4 pt-3"
      style={{ borderRadius: shellRadius.sheet }}
    >
      <View className="items-center gap-3">
        <View className="h-1.5 w-14 rounded-full bg-app-outline-strong" />
        <View className="items-center gap-1">
          <Text variant="h3" tone="inverse">
            {title}
          </Text>
          {description ? (
            <Text tone="muted" className="text-center text-app-text-muted">
              {description}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="pt-4">{children}</View>
      {footer ? <View className="pt-4">{footer}</View> : null}
    </View>
  );
}
