import type { ReactNode } from "react";
import { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "./Text";
import { useNaroTheme } from "./theme";

export type ReelsFeedProps<T> = {
  items: T[];
  keyExtractor: (item: T) => string;
  renderCard: (item: T, itemHeight: number) => ReactNode;
  headerHeight: number;
  isLoading?: boolean;
  isError?: boolean;
  hasFilters?: boolean;
  onRetry?: () => void;
  onClear?: () => void;
  onEndReached?: () => void;
  isFetchingNextPage?: boolean;
  loadingLabel?: string;
  footerLoadingLabel?: string;
  errorTitle?: string;
  errorDescription?: string;
  emptyTitle?: string;
  filteredEmptyTitle?: string;
  emptyDescription?: string;
  filteredEmptyDescription?: string;
  clearLabel?: string;
  renderEmpty?: (itemHeight: number) => ReactNode;
  itemContainerClassName?: string;
  itemContainerStyle?: StyleProp<ViewStyle>;
  minItemHeight?: number;
  tabBarReserve?: number;
  initialNumToRender?: number;
  maxToRenderPerBatch?: number;
  windowSize?: number;
  onEndReachedThreshold?: number;
};

export function ReelsFeed<T>({
  items,
  keyExtractor,
  renderCard,
  headerHeight,
  isLoading = false,
  isError = false,
  hasFilters = false,
  onRetry,
  onClear,
  onEndReached,
  isFetchingNextPage = false,
  loadingLabel = "Yükleniyor…",
  footerLoadingLabel,
  errorTitle = "Liste yüklenemedi",
  errorDescription = "Bağlantı hatası veya sunucu yanıt vermiyor. Tekrar dene.",
  emptyTitle = "Henüz kayıt yok",
  filteredEmptyTitle = "Bu filtre için sonuç bulunamadı",
  emptyDescription = "Yeni kayıtlar geldiğinde burada görünecek.",
  filteredEmptyDescription = "Filtreleri genişletmeyi veya aramayı temizlemeyi dene.",
  clearLabel = "Filtreleri temizle",
  renderEmpty,
  itemContainerClassName,
  itemContainerStyle,
  minItemHeight = 360,
  tabBarReserve,
  initialNumToRender = 2,
  maxToRenderPerBatch = 3,
  windowSize = 5,
  onEndReachedThreshold = 0.5,
}: ReelsFeedProps<T>) {
  const { colors } = useNaroTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomReserve = tabBarReserve ?? Math.max(insets.bottom, 10) + 82;
  const availableHeight = height - Math.max(headerHeight, 54) - bottomReserve;
  const itemHeight = Math.floor(Math.max(minItemHeight, availableHeight));

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<T>) => (
      <View
        className={itemContainerClassName}
        style={[{ height: itemHeight }, itemContainerStyle]}
      >
        {renderCard(item, itemHeight)}
      </View>
    ),
    [itemContainerClassName, itemContainerStyle, itemHeight, renderCard],
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<T> | null | undefined, index: number) => ({
      length: itemHeight,
      offset: itemHeight * index,
      index,
    }),
    [itemHeight],
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center gap-3">
        <ActivityIndicator size="large" color={colors.info} />
        <Text variant="caption" tone="muted" className="text-[12px]">
          {loadingLabel}
        </Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center gap-3 px-6">
        <Text variant="h3" tone="inverse" className="text-center">
          {errorTitle}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-center text-app-text-muted text-[12px]"
        >
          {errorDescription}
        </Text>
        {onRetry ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            className="rounded-full border border-brand-500/40 bg-brand-500/10 px-4 py-2 active:opacity-80"
          >
            <Text variant="label" tone="accent" className="text-[13px]">
              Tekrar dene
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (items.length === 0) {
    if (renderEmpty) {
      return <>{renderEmpty(itemHeight)}</>;
    }

    return (
      <View className="flex-1 items-center justify-center gap-3 px-6">
        <Text variant="h3" tone="inverse" className="text-center">
          {hasFilters ? filteredEmptyTitle : emptyTitle}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-center text-app-text-muted text-[12px] leading-[17px]"
        >
          {hasFilters ? filteredEmptyDescription : emptyDescription}
        </Text>
        {hasFilters && onClear ? (
          <Pressable
            accessibilityRole="button"
            onPress={onClear}
            className="rounded-full border border-app-outline bg-app-surface px-4 py-2 active:bg-app-surface-2"
          >
            <Text variant="label" tone="inverse" className="text-[13px]">
              {clearLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <FlatList<T>
      style={styles.list}
      data={items}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      snapToInterval={itemHeight}
      snapToAlignment="start"
      decelerationRate="fast"
      disableIntervalMomentum
      onEndReached={onEndReached}
      onEndReachedThreshold={onEndReachedThreshold}
      initialNumToRender={initialNumToRender}
      maxToRenderPerBatch={maxToRenderPerBatch}
      windowSize={windowSize}
      removeClippedSubviews={false}
      getItemLayout={getItemLayout}
      ListFooterComponent={
        isFetchingNextPage ? (
          <View className="items-center py-4">
            <ActivityIndicator size="small" color={colors.info} />
            {footerLoadingLabel ? (
              <Text variant="caption" tone="muted" className="mt-2 text-[11px]">
                {footerLoadingLabel}
              </Text>
            ) : null}
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
});
