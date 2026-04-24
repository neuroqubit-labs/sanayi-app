import {
  FilterRail,
  ReelsFeed,
  Screen,
  SearchFilterHeader,
  type FilterRailRow,
} from "@naro/ui";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { View } from "react-native";

import {
  useBrandsQuery,
  useServiceDomainsQuery,
  useTechniciansInfiniteFeed,
} from "../api";
import { TechnicianFeedCard } from "../components/TechnicianFeedCard";
import type { TechnicianFeedItem } from "../schemas";

/**
 * Çarşı ekranı — düz paginated feed (PO kararı: section-curated V2
 * pilot sonrası). Backend `/technicians/public/feed` live data; filter
 * chip'leri (domain + brand) query param'a map edilir.
 *
 * Text arama client-side filter (display_name + tagline); BE feed
 * endpoint'i fulltext search opsiyonu V2.
 */
export function UstalarScreen() {
  const [query, setQuery] = useState("");
  const [domainKey, setDomainKey] = useState<string | null>(null);
  const [brandKey, setBrandKey] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);

  const deferredQuery = useDeferredValue(query);

  const feedQuery = useTechniciansInfiniteFeed({
    domain: domainKey ?? undefined,
    brand: brandKey ?? undefined,
  });
  const domainsQuery = useServiceDomainsQuery();
  const brandsQuery = useBrandsQuery();

  const items = useMemo(() => {
    const raw = feedQuery.data?.pages.flatMap((page) => page.items) ?? [];
    const needle = deferredQuery.trim().toLowerCase();
    if (needle.length === 0) return raw;
    return raw.filter((item) => {
      const haystack = [item.display_name, item.tagline ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [feedQuery.data, deferredQuery]);

  const activeFilterCount = (domainKey ? 1 : 0) + (brandKey ? 1 : 0);
  const hasFilters = activeFilterCount > 0 || deferredQuery.trim().length > 0;

  const clearFilters = useCallback(() => {
    setDomainKey(null);
    setBrandKey(null);
  }, []);

  const filterRows = useMemo<FilterRailRow[]>(
    () => [
      {
        key: "domain",
        label: "Alan",
        loading: domainsQuery.isLoading,
        emptyLabel: "Alan yüklenemedi",
        options: (domainsQuery.data ?? []).map((domain) => ({
          key: domain.domain_key,
          label: domain.label,
          selected: domainKey === domain.domain_key,
          onPress: () =>
            setDomainKey(
              domainKey === domain.domain_key ? null : domain.domain_key,
            ),
        })),
      },
      {
        key: "brand",
        label: "Marka",
        loading: brandsQuery.isLoading,
        emptyLabel: "Marka yüklenemedi",
        options: (brandsQuery.data ?? []).slice(0, 30).map((brand) => ({
          key: brand.brand_key,
          label: brand.label,
          selected: brandKey === brand.brand_key,
          onPress: () =>
            setBrandKey(brandKey === brand.brand_key ? null : brand.brand_key),
        })),
      },
    ],
    [
      brandKey,
      brandsQuery.data,
      brandsQuery.isLoading,
      domainKey,
      domainsQuery.data,
      domainsQuery.isLoading,
    ],
  );

  const renderTechnicianCard = useCallback(
    (item: TechnicianFeedItem, itemHeight: number) => (
      <TechnicianFeedCard item={item} itemHeight={itemHeight} />
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
          placeholder="Usta ara"
          filterCount={activeFilterCount}
          filtersOpen={filtersOpen}
          onToggleFilters={() => setFiltersOpen((prev) => !prev)}
          onCloseFilters={() => setFiltersOpen(false)}
          onHeightChange={setHeaderHeight}
          filterContent={
            <FilterRail
              rows={filterRows}
              clearAction={
                activeFilterCount > 0
                  ? {
                      label: "Temizle",
                      accessibilityLabel: "Filtreleri temizle",
                      onPress: clearFilters,
                    }
                  : undefined
              }
            />
          }
        />

        <ReelsFeed<TechnicianFeedItem>
          items={items}
          keyExtractor={(item) => item.id}
          renderCard={renderTechnicianCard}
          itemContainerClassName="px-5 py-2"
          isLoading={feedQuery.isLoading}
          isError={feedQuery.isError}
          hasFilters={hasFilters}
          onClear={() => {
            clearFilters();
            setQuery("");
          }}
          onRetry={() => feedQuery.refetch()}
          onEndReached={() => {
            if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
              feedQuery.fetchNextPage();
            }
          }}
          isFetchingNextPage={feedQuery.isFetchingNextPage}
          headerHeight={headerHeight}
          loadingLabel="Ustalar yükleniyor…"
          errorTitle="Çarşı yüklenemedi"
          errorDescription="Bağlantı hatası veya sunucu yanıt vermiyor. Tekrar dene."
          filteredEmptyTitle="Bu filtre için usta bulunamadı"
          emptyTitle="Çarşıda henüz usta yok"
          filteredEmptyDescription="Filtreleri genişletmeyi dene; daha fazla sonuç çıkabilir."
          emptyDescription="Pilot kapsamında Kayseri başlatılıyor. Eklenen ustalar çarşıda görünecek."
        />
      </View>
    </Screen>
  );
}
