import type { ReactElement, ReactNode } from "react";
import {
  ActivityIndicator,
  FlatList,
  type FlatListProps,
  RefreshControl,
  View,
} from "react-native";

import { Text } from "./Text";
import { useNaroTheme } from "./theme";

export type InfiniteListProps<TItem> = Omit<
  FlatListProps<TItem>,
  "data" | "renderItem" | "ListEmptyComponent"
> & {
  data: TItem[] | undefined;
  renderItem: (item: TItem, index: number) => ReactElement | null;
  keyExtractor: (item: TItem, index: number) => string;
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  onEndReached?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  header?: ReactNode;
  gap?: number;
};

export function InfiniteList<TItem>({
  data,
  renderItem,
  keyExtractor,
  isLoading = false,
  isFetchingNextPage = false,
  hasNextPage = false,
  onEndReached,
  onRefresh,
  isRefreshing = false,
  emptyTitle = "Henüz kayıt yok",
  emptyDescription,
  emptyAction,
  header,
  gap = 12,
  contentContainerStyle,
  initialNumToRender = 8,
  maxToRenderPerBatch = 8,
  windowSize = 7,
  onEndReachedThreshold = 0.4,
  ...rest
}: InfiniteListProps<TItem>) {
  const { colors } = useNaroTheme();

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={keyExtractor}
      renderItem={({ item, index }) => renderItem(item, index)}
      initialNumToRender={initialNumToRender}
      maxToRenderPerBatch={maxToRenderPerBatch}
      windowSize={windowSize}
      ItemSeparatorComponent={() => <View style={{ height: gap }} />}
      contentContainerStyle={[
        { paddingBottom: 48, flexGrow: 1 },
        contentContainerStyle,
      ]}
      ListHeaderComponent={header ? <View>{header}</View> : null}
      ListEmptyComponent={
        isLoading ? (
          <View className="items-center justify-center py-10">
            <ActivityIndicator color={colors.info} />
          </View>
        ) : (
          <View className="items-center gap-3 rounded-[26px] border border-app-outline bg-app-surface px-5 py-8">
            <Text variant="h3" tone="inverse">
              {emptyTitle}
            </Text>
            {emptyDescription ? (
              <Text tone="muted" className="text-app-text-muted text-center">
                {emptyDescription}
              </Text>
            ) : null}
            {emptyAction}
          </View>
        )
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <View className="items-center py-6">
            <ActivityIndicator color={colors.info} />
          </View>
        ) : null
      }
      onEndReached={hasNextPage ? onEndReached : undefined}
      onEndReachedThreshold={onEndReachedThreshold}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.info}
            colors={[colors.info]}
            progressBackgroundColor={colors.surface}
          />
        ) : undefined
      }
      {...rest}
    />
  );
}
