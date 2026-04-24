import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { Text } from "./Text";
import { ToggleChip } from "./ToggleChip";
import { useNaroTheme } from "./theme";

export type FilterRailOption = {
  key: string;
  label: string;
  selected?: boolean;
  disabled?: boolean;
  badge?: number;
  accessibilityLabel?: string;
  onPress: () => void;
};

export type FilterRailAction = {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
};

export type FilterRailRow = {
  key: string;
  label?: string;
  options: FilterRailOption[];
  loading?: boolean;
  loadingLabel?: string;
  emptyLabel?: string;
  leading?: ReactNode;
};

export type FilterRailProps = {
  rows: FilterRailRow[];
  clearAction?: FilterRailAction;
  className?: string;
};

export function FilterRail({ rows, clearAction, className }: FilterRailProps) {
  const { colors } = useNaroTheme();

  return (
    <View className={["gap-2", className ?? ""].filter(Boolean).join(" ")}>
      {rows.map((row, index) => (
        <ScrollView
          key={row.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.railContent}
        >
          {row.label ? <FilterRailLabel label={row.label} /> : null}
          {index === 0 && clearAction ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                clearAction.accessibilityLabel ?? clearAction.label
              }
              hitSlop={8}
              onPress={clearAction.onPress}
              className="rounded-full border border-app-outline bg-app-surface px-3 py-1.5 active:bg-app-surface-2"
            >
              <Text variant="caption" tone="muted" className="text-[11px]">
                {clearAction.label}
              </Text>
            </Pressable>
          ) : null}
          {row.leading}
          {row.loading ? (
            <View className="rounded-full border border-app-outline bg-app-surface px-3 py-2">
              <ActivityIndicator size="small" color={colors.info} />
            </View>
          ) : row.options.length === 0 ? (
            <FilterRailLabel
              label={row.emptyLabel ?? row.loadingLabel ?? "Filtre yok"}
              muted
            />
          ) : (
            row.options.map((option) => (
              <ToggleChip
                key={option.key}
                label={
                  option.badge
                    ? `${option.label} · ${option.badge}`
                    : option.label
                }
                selected={Boolean(option.selected)}
                disabled={option.disabled}
                size="sm"
                onPress={option.onPress}
              />
            ))
          )}
        </ScrollView>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  railContent: {
    gap: 8,
    paddingRight: 20,
  },
});

function FilterRailLabel({
  label,
  muted = false,
}: {
  label: string;
  muted?: boolean;
}) {
  return (
    <View className="rounded-full border border-app-outline bg-app-surface px-3 py-1.5">
      <Text variant="caption" tone={muted ? "muted" : "subtle"}>
        {label}
      </Text>
    </View>
  );
}
