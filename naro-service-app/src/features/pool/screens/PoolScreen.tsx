import { Icon, Screen, Text } from "@naro/ui";
import { Search, X } from "lucide-react-native";
import { useDeferredValue, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCasePoolLive } from "@/features/jobs/api.live";
import type { PoolCaseItem } from "@/features/jobs/schemas";

import { PoolReelsCardLive } from "../components/PoolReelsCardLive";

const HEADER_HEIGHT = 68;
const TAB_BAR_BASE = 68;

/**
 * Canonical live pool screen — P1-4 iter 2 consumer migration 2026-04-23.
 * useCasePool (mock) → useCasePoolLive (GET /pool/feed cursor paginated).
 * PoolReelsCard (mock ServiceCase) → PoolReelsCardLive (canonical thin).
 * Search artık title + subtitle + location + kind'a göre client-side.
 */
export function PoolScreen() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get("window").height;
  const cardHeight =
    screenHeight - HEADER_HEIGHT - TAB_BAR_BASE - insets.bottom - insets.top;

  const feedQuery = useCasePoolLive();
  const rawCases = useMemo(
    () => feedQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [feedQuery.data],
  );

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    if (!needle) return rawCases;
    return rawCases.filter((caseItem) => {
      const haystacks = [
        caseItem.title,
        caseItem.subtitle ?? "",
        caseItem.location_label ?? "",
        caseItem.kind,
      ];
      return haystacks.some((field) => field.toLowerCase().includes(needle));
    });
  }, [rawCases, deferredQuery]);

  const getItemLayout = useMemo(() => {
    return (
      _data: ArrayLike<PoolCaseItem> | null | undefined,
      index: number,
    ) => ({
      length: cardHeight,
      offset: cardHeight * index,
      index,
    });
  }, [cardHeight]);

  const snapOffsets = useMemo(
    () => filtered.map((_, index) => index * cardHeight),
    [filtered, cardHeight],
  );

  const hasResults = filtered.length > 0;
  const hasQuery = deferredQuery.trim().length > 0;

  return (
    <Screen padded={false} backgroundClassName="bg-app-bg" className="flex-1">
      <View className="gap-3 px-5 pt-3" style={{ height: HEADER_HEIGHT }}>
        <View className="flex-row items-center gap-2 rounded-[20px] border border-app-outline-strong bg-app-surface px-3.5 py-2.5">
          <Icon icon={Search} size={18} color="#d94a1f" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Plaka, vaka, müşteri ara..."
            placeholderTextColor="#6f7b97"
            returnKeyType="search"
            className="flex-1 text-base text-app-text"
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Aramayı temizle"
              hitSlop={8}
              onPress={() => setQuery("")}
            >
              <Icon icon={X} size={16} color="#6f7b97" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {feedQuery.isLoading ? (
        <View className="flex-1 items-center justify-center gap-2">
          <ActivityIndicator color="#83a7ff" />
          <Text tone="muted" variant="caption">
            Havuz yükleniyor…
          </Text>
        </View>
      ) : feedQuery.isError ? (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text variant="h3" tone="inverse" className="text-center">
            Havuz yüklenemedi
          </Text>
          <Text tone="muted" className="text-center text-app-text-muted">
            Bağlantını kontrol edip tekrar dene.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => feedQuery.refetch()}
            className="rounded-full border border-brand-500/40 bg-brand-500/10 px-4 py-2 active:opacity-80"
          >
            <Text variant="label" tone="accent" className="text-[13px]">
              Tekrar dene
            </Text>
          </Pressable>
        </View>
      ) : hasResults ? (
        <FlatList<PoolCaseItem>
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PoolReelsCardLive caseItem={item} cardHeight={cardHeight} />
          )}
          showsVerticalScrollIndicator={false}
          snapToOffsets={snapOffsets}
          decelerationRate="fast"
          getItemLayout={getItemLayout}
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          windowSize={3}
          onEndReached={() => {
            if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
              feedQuery.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
        />
      ) : (
        <EmptyPool
          query={deferredQuery}
          hasQuery={hasQuery}
          totalCases={rawCases.length}
          onClearQuery={() => setQuery("")}
        />
      )}
    </Screen>
  );
}

type EmptyPoolProps = {
  query: string;
  hasQuery: boolean;
  totalCases: number;
  onClearQuery: () => void;
};

function EmptyPool({ query, hasQuery, totalCases, onClearQuery }: EmptyPoolProps) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-6">
      <View className="h-14 w-14 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
        <Icon icon={Search} size={22} color="#83a7ff" />
      </View>
      <View className="items-center gap-2">
        <Text variant="h3" tone="inverse" className="text-center">
          {hasQuery
            ? `"${query.trim()}" için eşleşme yok`
            : totalCases === 0
              ? "Havuz şu an boş"
              : "Başlamak için yukarı kaydır"}
        </Text>
        <Text tone="muted" className="text-center text-app-text-muted leading-5">
          {hasQuery
            ? `Farklı bir kelime dene. Havuzda ${totalCases} açık vaka var.`
            : totalCases === 0
              ? "Yeni talepler geldikçe burada gözükür. Müsaitliğin açık olduğundan emin ol."
              : "Bölgende eşleşme bekleyen vakalar burada. Tek tek kaydır ve uygun olana teklif gönder."}
        </Text>
      </View>
      {hasQuery ? (
        <Pressable
          accessibilityRole="button"
          onPress={onClearQuery}
          className="rounded-full border border-app-outline bg-app-surface px-4 py-2 active:bg-app-surface-2"
        >
          <Text variant="label" tone="inverse">
            Aramayı temizle
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
