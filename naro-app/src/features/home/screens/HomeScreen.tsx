import { Screen, Text } from "@naro/ui";
import { useMemo } from "react";
import { ActivityIndicator, FlatList, RefreshControl, View } from "react-native";

import { useVehicles } from "@/features/vehicles";

import { useHomeSummary } from "../api";
import { FeedItemView } from "../components/FeedRenderer";
import { HomeHeader } from "../components/HomeHeader";
import { VehicleNudgeBanner } from "../components/VehicleNudgeBanner";
import { useHomeFeed, type FeedItem } from "../feed";

export function HomeScreen() {
  const summary = useHomeSummary();
  const feed = useHomeFeed();
  const { data: vehicles } = useVehicles();

  const feedItems: FeedItem[] = useMemo(
    () => feed.data?.pages.flatMap((page) => page.items) ?? [],
    [feed.data],
  );

  // PO vizyonu: yeni user için araç ekleme nudge'ı persistent banner —
  // sert blok değil, güçlü yönlendirme. Aracı olan user'lar için banner yok.
  const showVehicleNudge = (vehicles ?? []).length === 0;

  if (summary.isPending) {
    return (
      <Screen backgroundClassName="bg-app-bg" className="flex-1 justify-center">
        <ActivityIndicator color="#83a7ff" />
        <Text tone="muted" className="mt-3 text-center text-app-text-muted">
          Ana sayfa hazırlanıyor…
        </Text>
      </Screen>
    );
  }

  return (
    <Screen backgroundClassName="bg-app-bg" padded={false} className="flex-1">
      <FlatList<FeedItem>
        data={feedItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <FeedItemView item={item} />}
        ItemSeparatorComponent={FeedSeparator}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 140,
        }}
        ListHeaderComponent={
          <View className="gap-4 pb-5">
            <HomeHeader />
            {showVehicleNudge ? <VehicleNudgeBanner /> : null}
          </View>
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <View className="items-center py-6">
              <ActivityIndicator color="#83a7ff" />
            </View>
          ) : null
        }
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) {
            feed.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching}
            onRefresh={() => {
              summary.refetch();
              feed.refetch();
            }}
            tintColor="#83a7ff"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

function FeedSeparator() {
  return <View style={{ height: 24 }} />;
}
