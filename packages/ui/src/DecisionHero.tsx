import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Button } from "./Button";
import { Text } from "./Text";
import { StatusChip, type StatusChipTone } from "./StatusChip";

export type DecisionHeroProps = {
  eyebrow?: string;
  title: string;
  description: string;
  statusLabel?: string;
  statusTone?: StatusChipTone;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  metrics?: ReactNode;
  badges?: ReactNode;
  children?: ReactNode;
  onPress?: () => void;
};

export function DecisionHero({
  eyebrow,
  title,
  description,
  statusLabel,
  statusTone = "accent",
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  metrics,
  badges,
  children,
  onPress,
}: DecisionHeroProps) {
  const content = (
    <View className="gap-5 rounded-[28px] border border-app-outline-strong bg-app-surface-2 px-5 py-5">
      <View className="gap-3">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-2">
            {eyebrow ? (
              <Text variant="eyebrow" tone="subtle">
                {eyebrow}
              </Text>
            ) : null}
            <Text variant="display" tone="inverse" className="text-[34px] leading-[38px]">
              {title}
            </Text>
          </View>
          {statusLabel ? <StatusChip label={statusLabel} tone={statusTone} /> : null}
        </View>
        <Text tone="muted" className="text-app-text-muted">
          {description}
        </Text>
        {badges ? <View className="flex-row flex-wrap gap-2">{badges}</View> : null}
      </View>

      {metrics ? <View className="flex-row gap-3">{metrics}</View> : null}
      {children}

      {primaryActionLabel && onPrimaryAction ? (
        <View className="gap-3">
          <Button
            label={primaryActionLabel}
            onPress={(event) => {
              event.stopPropagation();
              onPrimaryAction();
            }}
            fullWidth
            size="lg"
          />
          {secondaryActionLabel && onSecondaryAction ? (
            <Button
              label={secondaryActionLabel}
              variant="outline"
              onPress={(event) => {
                event.stopPropagation();
                onSecondaryAction();
              }}
              fullWidth
              size="lg"
            />
          ) : null}
        </View>
      ) : secondaryActionLabel && onSecondaryAction ? (
        <View className="gap-3">
          <Button
            label={secondaryActionLabel}
            variant="outline"
            onPress={(event) => {
              event.stopPropagation();
              onSecondaryAction();
            }}
            fullWidth
            size="lg"
          />
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className="active:opacity-95"
      >
        {content}
      </Pressable>
    );
  }

  return content;
}
