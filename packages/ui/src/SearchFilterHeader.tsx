import type { ReactNode } from "react";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FilterPillButton } from "./FilterPillButton";
import { OverlayPortal } from "./OverlayPortal";
import { SearchPillInput } from "./SearchPillInput";

const FILTER_PANEL_GAP = 8;

export type SearchFilterHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder: string;
  onClearQuery?: () => void;
  filterLabel?: string;
  filterCount?: number;
  filtersOpen?: boolean;
  onToggleFilters?: () => void;
  onCloseFilters?: () => void;
  filterContent?: ReactNode;
  onHeightChange?: (height: number) => void;
  className?: string;
};

export function SearchFilterHeader({
  query,
  onQueryChange,
  placeholder,
  onClearQuery,
  filterLabel = "Filtre",
  filterCount = 0,
  filtersOpen = false,
  onToggleFilters,
  onCloseFilters,
  filterContent,
  onHeightChange,
  className,
}: SearchFilterHeaderProps) {
  const insets = useSafeAreaInsets();
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const showFilterButton = Boolean(onToggleFilters);
  const handleToggleFilters = onToggleFilters ?? (() => undefined);

  const handleLayout = (event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    setMeasuredHeight(height);
    onHeightChange?.(height);
  };

  return (
    <>
      <View
        className={["px-5 pt-3", className ?? ""].filter(Boolean).join(" ")}
        onLayout={handleLayout}
        style={styles.header}
      >
        <View className="flex-row items-center gap-2 pb-2">
          <SearchPillInput
            value={query}
            onChangeText={onQueryChange}
            onClear={onClearQuery}
            placeholder={placeholder}
          />
          {showFilterButton ? (
            <FilterPillButton
              label={filterLabel}
              count={filterCount}
              active={filterCount > 0}
              expanded={filtersOpen}
              onPress={handleToggleFilters}
            />
          ) : null}
        </View>
      </View>

      {filtersOpen && filterContent && onCloseFilters ? (
        <OverlayPortal>
          <View pointerEvents="box-none" style={styles.portalRoot}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Filtreleri kapat"
              onPress={onCloseFilters}
              style={styles.dismissLayer}
            />
            <View
              pointerEvents="box-none"
              className="absolute inset-x-0 px-5"
              style={[
                styles.filterOverlay,
                {
                  top: insets.top + measuredHeight + FILTER_PANEL_GAP,
                },
              ]}
            >
              {filterContent}
            </View>
          </View>
        </OverlayPortal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  dismissLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  filterOverlay: {
    elevation: 30,
    zIndex: 30,
  },
  header: {
    zIndex: 2,
  },
  portalRoot: {
    ...StyleSheet.absoluteFillObject,
  },
});
