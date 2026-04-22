import { Icon, Screen, Text, ToggleChip } from "@naro/ui";
import { Search, SlidersHorizontal, X } from "lucide-react-native";
import { useDeferredValue, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import {
  useBrandsQuery,
  useServiceDomainsQuery,
  useTechniciansInfiniteFeed,
} from "../api";
import { TechnicianFeedCard } from "../components/TechnicianFeedCard";
import type { TechnicianFeedItem } from "../schemas";

const HEADER_GAP = 12;

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

  const deferredQuery = useDeferredValue(query);

  const feedQuery = useTechniciansInfiniteFeed({
    domain: domainKey ?? undefined,
    brand: brandKey ?? undefined,
  });
  const domainsQuery = useServiceDomainsQuery();
  const brandsQuery = useBrandsQuery();

  const items = useMemo(() => {
    const raw =
      feedQuery.data?.pages.flatMap((page) => page.items) ?? [];
    const needle = deferredQuery.trim().toLowerCase();
    if (needle.length === 0) return raw;
    return raw.filter((item) => {
      const haystack = [item.display_name, item.tagline ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [feedQuery.data, deferredQuery]);

  const activeFilterCount =
    (domainKey ? 1 : 0) + (brandKey ? 1 : 0);

  const clearFilters = () => {
    setDomainKey(null);
    setBrandKey(null);
  };

  return (
    <Screen padded={false} backgroundClassName="bg-app-bg" className="flex-1">
      <View className="gap-3 px-5 pt-3" style={{ paddingBottom: HEADER_GAP }}>
        <View className="flex-row items-center gap-2 rounded-[20px] border border-app-outline-strong bg-app-surface px-3.5 py-2.5">
          <Icon icon={Search} size={18} color="#0ea5e9" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Usta, servis, lastikçi ara..."
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

        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              filtersOpen ? "Filtreleri gizle" : "Filtreleri göster"
            }
            onPress={() => setFiltersOpen((prev) => !prev)}
            className={[
              "flex-row items-center gap-2 rounded-full border px-3 py-1.5 active:opacity-80",
              activeFilterCount > 0
                ? "border-brand-500/40 bg-brand-500/10"
                : "border-app-outline bg-app-surface",
            ].join(" ")}
          >
            <Icon
              icon={SlidersHorizontal}
              size={13}
              color={activeFilterCount > 0 ? "#0ea5e9" : "#83a7ff"}
            />
            <Text
              variant="label"
              tone={activeFilterCount > 0 ? "accent" : "inverse"}
              className="text-[12px]"
            >
              Filtreler{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
            </Text>
          </Pressable>
          {activeFilterCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Filtreleri temizle"
              onPress={clearFilters}
              className="rounded-full border border-app-outline bg-app-surface px-3 py-1.5 active:bg-app-surface-2"
            >
              <Text variant="caption" tone="muted" className="text-[11px]">
                Temizle
              </Text>
            </Pressable>
          ) : null}
        </View>

        {filtersOpen ? (
          <FilterPanel
            domainKey={domainKey}
            brandKey={brandKey}
            onDomainChange={setDomainKey}
            onBrandChange={setBrandKey}
            domains={domainsQuery.data ?? []}
            brands={brandsQuery.data ?? []}
            domainsLoading={domainsQuery.isLoading}
            brandsLoading={brandsQuery.isLoading}
          />
        ) : null}
      </View>

      <FeedBody
        items={items}
        isLoading={feedQuery.isLoading}
        isError={feedQuery.isError}
        hasFilters={activeFilterCount > 0 || deferredQuery.trim().length > 0}
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
        filtersOpen={filtersOpen}
      />
    </Screen>
  );
}

type FilterPanelProps = {
  domainKey: string | null;
  brandKey: string | null;
  onDomainChange: (next: string | null) => void;
  onBrandChange: (next: string | null) => void;
  domains: { domain_key: string; label: string }[];
  brands: { brand_key: string; label: string }[];
  domainsLoading: boolean;
  brandsLoading: boolean;
};

function FilterPanel({
  domainKey,
  brandKey,
  onDomainChange,
  onBrandChange,
  domains,
  brands,
  domainsLoading,
  brandsLoading,
}: FilterPanelProps) {
  return (
    <View className="gap-3 rounded-[18px] border border-app-outline bg-app-surface-2 px-3 py-3">
      <View className="gap-1.5">
        <Text variant="eyebrow" tone="subtle">
          Uzmanlık alanı
        </Text>
        {domainsLoading ? (
          <ActivityIndicator size="small" />
        ) : domains.length === 0 ? (
          <Text variant="caption" tone="muted" className="text-[11px]">
            Alan verisi yüklenemedi.
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {domains.map((domain) => (
              <ToggleChip
                key={domain.domain_key}
                label={domain.label}
                selected={domainKey === domain.domain_key}
                onPress={() =>
                  onDomainChange(
                    domainKey === domain.domain_key ? null : domain.domain_key,
                  )
                }
              />
            ))}
          </ScrollView>
        )}
      </View>

      <View className="gap-1.5">
        <Text variant="eyebrow" tone="subtle">
          Marka
        </Text>
        {brandsLoading ? (
          <ActivityIndicator size="small" />
        ) : brands.length === 0 ? (
          <Text variant="caption" tone="muted" className="text-[11px]">
            Marka verisi yüklenemedi.
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {brands.slice(0, 30).map((brand) => (
              <ToggleChip
                key={brand.brand_key}
                label={brand.label}
                selected={brandKey === brand.brand_key}
                onPress={() =>
                  onBrandChange(
                    brandKey === brand.brand_key ? null : brand.brand_key,
                  )
                }
              />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

type FeedBodyProps = {
  items: TechnicianFeedItem[];
  isLoading: boolean;
  isError: boolean;
  hasFilters: boolean;
  onClear: () => void;
  onRetry: () => void;
  onEndReached: () => void;
  isFetchingNextPage: boolean;
  filtersOpen: boolean;
};

/**
 * Reels-tarzı feed — bir kart = bir ekran. `pagingEnabled` + snap ile
 * kullanıcı dikey swipe ile ustalar arasında geçer. Card container
 * `viewport - header - tab bar` yüksekliğinde; kart içerik merkezli.
 */
function FeedBody({
  items,
  isLoading,
  isError,
  hasFilters,
  onClear,
  onRetry,
  onEndReached,
  isFetchingNextPage,
  filtersOpen,
}: FeedBodyProps) {
  const { height } = useWindowDimensions();
  // header yaklaşık yükseklik (search + filters chip row); filtersOpen ise +panel
  const headerHeight = filtersOpen ? 320 : 130;
  const tabBarHeight = 96;
  const cardHeight = Math.max(420, height - headerHeight - tabBarHeight);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center gap-3">
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text variant="caption" tone="muted" className="text-[12px]">
          Ustalar yükleniyor…
        </Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center gap-3 px-6">
        <Text variant="h3" tone="inverse" className="text-center">
          Çarşı yüklenemedi
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-center text-app-text-muted text-[12px]"
        >
          Bağlantı hatası veya sunucu yanıt vermiyor. Tekrar dene.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          className="rounded-full border border-brand-500/40 bg-brand-500/10 px-4 py-2 active:opacity-80"
        >
          <Text variant="label" tone="accent" className="text-[13px]">
            Tekrar dene
          </Text>
        </Pressable>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center gap-3 px-6">
        <Text variant="h3" tone="inverse" className="text-center">
          {hasFilters
            ? "Bu filtre için usta bulunamadı"
            : "Çarşıda henüz usta yok"}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-center text-app-text-muted text-[12px] leading-[17px]"
        >
          {hasFilters
            ? "Filtreleri genişletmeyi dene — daha fazla sonuç çıkabilir."
            : "Pilot kapsamında Kayseri başlatılıyor. Eklenen ustalar çarşıda görünecek."}
        </Text>
        {hasFilters ? (
          <Pressable
            accessibilityRole="button"
            onPress={onClear}
            className="rounded-full border border-app-outline bg-app-surface px-4 py-2 active:bg-app-surface-2"
          >
            <Text variant="label" tone="inverse" className="text-[13px]">
              Filtreleri temizle
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <FlatList<TechnicianFeedItem>
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View
          style={{
            height: cardHeight,
            paddingHorizontal: 20,
            justifyContent: "center",
          }}
        >
          <TechnicianFeedCard item={item} />
        </View>
      )}
      showsVerticalScrollIndicator={false}
      pagingEnabled
      snapToInterval={cardHeight}
      snapToAlignment="start"
      decelerationRate="fast"
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      getItemLayout={(_, index) => ({
        length: cardHeight,
        offset: cardHeight * index,
        index,
      })}
      ListFooterComponent={
        isFetchingNextPage ? (
          <View className="items-center py-4">
            <ActivityIndicator size="small" color="#83a7ff" />
          </View>
        ) : null
      }
    />
  );
}
