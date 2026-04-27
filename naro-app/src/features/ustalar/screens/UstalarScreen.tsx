import {
  FilterRail,
  ReelsFeed,
  Screen,
  SearchFilterHeader,
  Text,
  type FilterRailRow,
} from "@naro/ui";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { View } from "react-native";

import { useMyCasesLive } from "@/features/cases/api";
import { useActiveVehicle } from "@/features/vehicles";

import {
  useBrandsQuery,
  useServiceDomainsQuery,
  useTechniciansInfiniteFeed,
} from "../api";
import { TechnicianFeedCard } from "../components/TechnicianFeedCard";
import type { TechnicianFeedItem } from "../schemas";

const ACTIVE_CASE_STATUSES = new Set([
  "matching",
  "offers_ready",
  "appointment_pending",
  "scheduled",
  "service_in_progress",
  "parts_approval",
  "invoice_approval",
]);

const CASE_KIND_LABEL: Record<
  TechnicianFeedItem["case_showcases"][number]["kind"],
  string
> = {
  accident: "Hasar",
  breakdown: "Arıza",
  maintenance: "Bakım",
  towing: "Çekici",
};

type ContextualTechnicianFeedItem = TechnicianFeedItem & {
  feedSectionTitle?: string;
};

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
  const { data: activeVehicle } = useActiveVehicle();
  const { data: myCases } = useMyCasesLive();
  const activeCase = useMemo(
    () =>
      (myCases ?? [])
        .filter((caseItem) => ACTIVE_CASE_STATUSES.has(caseItem.status))
        .filter((caseItem) =>
          activeVehicle?.id ? caseItem.vehicle_id === activeVehicle.id : true,
        )
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at))[0] ??
      null,
    [activeVehicle?.id, myCases],
  );
  const contextLabel = activeCase
    ? `${CASE_KIND_LABEL[activeCase.kind]} vakası için`
    : activeVehicle
      ? `${
          [activeVehicle.make, activeVehicle.model].filter(Boolean).join(" ") ||
          activeVehicle.plate
        } için`
      : "Araç bağlamı bekleniyor";
  const contextDescription = activeCase
    ? "Bildirilebilir servisler backend uyumluluk kararına göre sıralanır."
    : "Aktif vaka yok; çarşı araç tipi ve marka sinyallerine göre önerilir.";

  const feedQuery = useTechniciansInfiniteFeed({
    domain: domainKey ?? undefined,
    brand: brandKey ?? undefined,
    caseId: activeCase?.id,
    vehicleId: activeCase ? undefined : activeVehicle?.id,
  });
  const domainsQuery = useServiceDomainsQuery();
  const brandsQuery = useBrandsQuery();

  const items = useMemo<ContextualTechnicianFeedItem[]>(() => {
    const raw = feedQuery.data?.pages.flatMap((page) => page.items) ?? [];
    const needle = deferredQuery.trim().toLowerCase();
    const filtered =
      needle.length === 0
        ? raw
        : raw.filter((item) => {
            const haystack = [item.display_name, item.tagline ?? ""]
              .join(" ")
              .toLowerCase();
            return haystack.includes(needle);
          });
    let primarySeen = false;
    let otherSeen = false;
    const primaryCount = filtered.filter(
      (item) => item.context_group !== "other",
    ).length;
    const otherCount = filtered.length - primaryCount;
    return filtered.map((item) => {
      if (item.context_group === "other") {
        const feedSectionTitle = otherSeen
          ? undefined
          : `Diğer seçenekler · ${otherCount}`;
        otherSeen = true;
        return { ...item, feedSectionTitle };
      }
      const feedSectionTitle = primarySeen
        ? undefined
        : activeCase
          ? `Vakana uyumlu · ${primaryCount} servis`
          : `Aracına uyumlu · ${primaryCount} servis`;
      primarySeen = true;
      return { ...item, feedSectionTitle };
    });
  }, [activeCase, feedQuery.data, deferredQuery]);

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
    (item: ContextualTechnicianFeedItem, itemHeight: number) => (
      <TechnicianFeedCard
        item={item}
        itemHeight={itemHeight}
        sectionTitle={item.feedSectionTitle}
      />
    ),
    [],
  );

  return (
    <Screen padded={false} backgroundClassName="bg-app-bg" className="flex-1">
      <View className="relative flex-1">
        <View
          onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
          className="relative z-10"
        >
          <SearchFilterHeader
            query={query}
            onQueryChange={setQuery}
            onClearQuery={() => setQuery("")}
            placeholder="Usta ara"
            filterCount={activeFilterCount}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen((prev) => !prev)}
            onCloseFilters={() => setFiltersOpen(false)}
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
          <View className="px-5 pb-2">
            <View className="rounded-[18px] border border-app-outline bg-app-surface px-3.5 py-2.5">
              <Text variant="label" tone="inverse" className="text-[13px]">
                {contextLabel}
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[11px]"
                numberOfLines={1}
              >
                {contextDescription}
              </Text>
            </View>
          </View>
        </View>

        <ReelsFeed<ContextualTechnicianFeedItem>
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
          onRefresh={() => {
            void feedQuery.refetch();
          }}
          refreshing={feedQuery.isRefetching}
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
