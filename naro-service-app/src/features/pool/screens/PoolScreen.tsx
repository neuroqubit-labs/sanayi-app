import {
  Icon,
  ReelsFeed,
  Screen,
  SearchFilterHeader,
  Text,
  useNaroTheme,
} from "@naro/ui";
import { Search } from "lucide-react-native";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { useCasePoolLive } from "@/features/jobs/api.live";
import type { PoolCaseItem } from "@/features/jobs/schemas";

import { PoolReelsCardLive } from "../components/PoolReelsCardLive";

/**
 * Canonical live pool screen — P1-4 iter 2 consumer migration 2026-04-23.
 * useCasePool (mock) → useCasePoolLive (GET /pool/feed cursor paginated).
 * PoolReelsCard (mock ServiceCase) → PoolReelsCardLive (canonical thin).
 * Search artık title + subtitle + location + kind'a göre client-side.
 */
export function PoolScreen() {
  const [query, setQuery] = useState("");
  const [headerHeight, setHeaderHeight] = useState(0);
  const deferredQuery = useDeferredValue(query);

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

  const hasQuery = deferredQuery.trim().length > 0;

  const renderPoolCard = useCallback(
    (caseItem: PoolCaseItem, cardHeight: number) => (
      <PoolReelsCardLive caseItem={caseItem} cardHeight={cardHeight} />
    ),
    [],
  );

  return (
    <Screen padded={false} backgroundClassName="bg-app-bg" className="flex-1">
      <View className="relative flex-1">
        <SearchFilterHeader
          query={query}
          onQueryChange={setQuery}
          onClearQuery={() => setQuery("")}
          placeholder="Plaka, vaka, müşteri ara..."
          onHeightChange={setHeaderHeight}
        />

        <ReelsFeed<PoolCaseItem>
          items={filtered}
          keyExtractor={(item) => item.id}
          renderCard={renderPoolCard}
          isLoading={feedQuery.isLoading}
          isError={feedQuery.isError}
          hasFilters={hasQuery}
          onClear={() => setQuery("")}
          onRetry={() => feedQuery.refetch()}
          onEndReached={() => {
            if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
              feedQuery.fetchNextPage();
            }
          }}
          isFetchingNextPage={feedQuery.isFetchingNextPage}
          headerHeight={headerHeight}
          loadingLabel="Havuz yükleniyor…"
          errorTitle="Havuz yüklenemedi"
          errorDescription="Bağlantını kontrol edip tekrar dene."
          renderEmpty={() => (
            <EmptyPool
              query={deferredQuery}
              hasQuery={hasQuery}
              totalCases={rawCases.length}
              onClearQuery={() => setQuery("")}
            />
          )}
          onEndReachedThreshold={0.4}
          windowSize={3}
        />
      </View>
    </Screen>
  );
}

type EmptyPoolProps = {
  query: string;
  hasQuery: boolean;
  totalCases: number;
  onClearQuery: () => void;
};

function EmptyPool({
  query,
  hasQuery,
  totalCases,
  onClearQuery,
}: EmptyPoolProps) {
  const { colors } = useNaroTheme();

  return (
    <View className="flex-1 items-center justify-center gap-4 px-6">
      <View className="h-14 w-14 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
        <Icon icon={Search} size={22} color={colors.info} />
      </View>
      <View className="items-center gap-2">
        <Text variant="h3" tone="inverse" className="text-center">
          {hasQuery
            ? `"${query.trim()}" için eşleşme yok`
            : totalCases === 0
              ? "Havuz şu an boş"
              : "Başlamak için yukarı kaydır"}
        </Text>
        <Text
          tone="muted"
          className="text-center text-app-text-muted leading-5"
        >
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
