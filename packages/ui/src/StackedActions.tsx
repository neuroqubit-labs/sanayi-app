import type { ReactNode } from "react";
import { View } from "react-native";

import { Button } from "./Button";
import { Text } from "./Text";
import type { TextTone } from "./Text";

export type StackedActionsProps = {
  primaryLabel: string;
  onPrimary: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryLoading?: boolean;
  helperText?: string;
  helperTone?: TextTone;
  children?: ReactNode;
  className?: string;
  floating?: boolean;
};

export function StackedActions({
  primaryLabel,
  onPrimary,
  primaryLoading = false,
  primaryDisabled = false,
  secondaryLabel,
  onSecondary,
  secondaryLoading = false,
  helperText,
  helperTone = "subtle",
  children,
  className,
  floating = true,
}: StackedActionsProps) {
  return (
    <View
      className={[
        "gap-3",
        floating ? "border-t border-app-outline bg-app-bg px-6 pb-5 pt-4" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {helperText ? <Text tone={helperTone}>{helperText}</Text> : null}
      {children}
      <View className="flex-row gap-3">
        {secondaryLabel && onSecondary ? (
          <Button
            label={secondaryLabel}
            variant="outline"
            fullWidth
            className="flex-1"
            loading={secondaryLoading}
            onPress={onSecondary}
          />
        ) : null}
        <Button
          label={primaryLabel}
          fullWidth
          className="flex-1"
          loading={primaryLoading}
          disabled={primaryDisabled}
          onPress={onPrimary}
        />
      </View>
    </View>
  );
}
