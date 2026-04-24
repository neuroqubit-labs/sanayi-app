import {
  Icon,
  OverlayPortal,
  Screen,
  Text,
  ToggleChip,
  useNaroTheme,
} from "@naro/ui";
import { Search, SlidersHorizontal, X } from "lucide-react-native";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useBrandsQuery,
  useServiceDomainsQuery,
  useTechniciansInfiniteFeed,
} from "../api";
import { TechnicianFeedCard } from "../components/TechnicianFeedCard";
import type { TechnicianFeedItem } from "../schemas";

const HEADER_BOTTOM_GAP = 8;
const FILTER_PANEL_GAP = 8;

/**
 * Çarşı ekranı — düz paginated feed (PO kararı: section-curated V2
 * pilot sonrası). Backend `/technicians/public/feed` live data; filter
 * chip'leri (domain + brand) query param'a map edilir.
 *
 * Text arama client-side filter (display_name + tagline); BE feed
 * endpoint'i fulltext search opsiyonu V2.
 */
export function UstalarScreen() {
  const { colors } = useNaroTheme();
  const insets = useSafeAreaInsets();
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

  const clearFilters = () => {
    setDomainKey(null);
    setBrandKey(null);
  };

  return (
    <Screen padded={false} backgroundClassName="bg-app-bg" className="flex-1">
      <View className="relative flex-1">
        <View
          className="px-5 pt-3"
          onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
          style={[
            styles.header,
            {
              paddingBottom: HEADER_BOTTOM_GAP,
            },
          ]}
        >
          <View className="flex-row items-center gap-2">
            <View className="h-[46px] min-w-0 flex-1 flex-row items-center gap-2 rounded-full border border-app-outline-strong bg-app-surface px-3">
              <Icon icon={Search} size={18} color={colors.info} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Usta ara"
                placeholderTextColor={colors.textSubtle}
                returnKeyType="search"
                className="min-h-[44px] flex-1 text-[15px] text-app-text"
              />
              {query.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Aramayı temizle"
                  hitSlop={8}
                  onPress={() => setQuery("")}
                  className="h-8 w-8 items-center justify-center rounded-full active:bg-app-surface-2"
                >
                  <Icon icon={X} size={15} color={colors.textSubtle} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                filtersOpen ? "Filtreleri gizle" : "Filtreleri göster"
              }
              accessibilityState={{ expanded: filtersOpen }}
              hitSlop={8}
              onPress={() => setFiltersOpen((prev) => !prev)}
              className={[
                "h-[46px] flex-row items-center gap-2 rounded-full border px-3.5 active:opacity-80",
                filtersOpen || activeFilterCount > 0
                  ? "border-brand-500/40 bg-brand-500/10"
                  : "border-app-outline bg-app-surface",
              ].join(" ")}
            >
              <Icon
                icon={SlidersHorizontal}
                size={18}
                color={
                  filtersOpen || activeFilterCount > 0
                    ? colors.info
                    : colors.textSubtle
                }
              />
              <Text
                variant="label"
                tone={filtersOpen || activeFilterCount > 0 ? "accent" : "muted"}
                className="text-[12px]"
              >
                Filtre{activeFilterCount > 0 ? ` ${activeFilterCount}` : ""}
              </Text>
            </Pressable>
          </View>
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
          headerHeight={headerHeight}
        />

        {filtersOpen ? (
          <OverlayPortal>
            <View pointerEvents="box-none" style={styles.portalRoot}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Filtreleri kapat"
                onPress={() => setFiltersOpen(false)}
                style={styles.filterDismissLayer}
              />
              <View
                pointerEvents="box-none"
                className="absolute inset-x-0 px-5"
                style={[
                  styles.filterOverlay,
                  { top: insets.top + headerHeight + FILTER_PANEL_GAP },
                ]}
              >
                <FilterPanel
                  domainKey={domainKey}
                  brandKey={brandKey}
                  onDomainChange={setDomainKey}
                  onBrandChange={setBrandKey}
                  onClear={clearFilters}
                  activeFilterCount={activeFilterCount}
                  domains={domainsQuery.data ?? []}
                  brands={brandsQuery.data ?? []}
                  domainsLoading={domainsQuery.isLoading}
                  brandsLoading={brandsQuery.isLoading}
                />
              </View>
            </View>
          </OverlayPortal>
        ) : null}
      </View>
    </Screen>
  );
}

type FilterPanelProps = {
  domainKey: string | null;
  brandKey: string | null;
  onDomainChange: (next: string | null) => void;
  onBrandChange: (next: string | null) => void;
  onClear: () => void;
  activeFilterCount: number;
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
  onClear,
  activeFilterCount,
  domains,
  brands,
  domainsLoading,
  brandsLoading,
}: FilterPanelProps) {
  const { colors } = useNaroTheme();

  return (
    <View className="gap-2" style={styles.filterPanel}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRailContent}
      >
        <FilterRailLabel label="Alan" />
        {activeFilterCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filtreleri temizle"
            hitSlop={8}
            onPress={onClear}
            className="rounded-full border border-app-outline bg-app-surface px-3 py-1.5 active:bg-app-surface-2"
          >
            <Text variant="caption" tone="muted" className="text-[11px]">
              Temizle
            </Text>
          </Pressable>
        ) : null}
        {domainsLoading ? (
          <View className="rounded-full border border-app-outline bg-app-surface px-3 py-2">
            <ActivityIndicator size="small" color={colors.info} />
          </View>
        ) : domains.length === 0 ? (
          <FilterRailLabel label="Alan yüklenemedi" muted />
        ) : (
          domains.map((domain) => (
            <ToggleChip
              key={domain.domain_key}
              label={domain.label}
              selected={domainKey === domain.domain_key}
              size="sm"
              onPress={() =>
                onDomainChange(
                  domainKey === domain.domain_key ? null : domain.domain_key,
                )
              }
            />
          ))
        )}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRailContent}
      >
        <FilterRailLabel label="Marka" />
        {brandsLoading ? (
          <View className="rounded-full border border-app-outline bg-app-surface px-3 py-2">
            <ActivityIndicator size="small" color={colors.info} />
          </View>
        ) : brands.length === 0 ? (
          <FilterRailLabel label="Marka yüklenemedi" muted />
        ) : (
          brands
            .slice(0, 30)
            .map((brand) => (
              <ToggleChip
                key={brand.brand_key}
                label={brand.label}
                selected={brandKey === brand.brand_key}
                size="sm"
                onPress={() =>
                  onBrandChange(
                    brandKey === brand.brand_key ? null : brand.brand_key,
                  )
                }
              />
            ))
        )}
      </ScrollView>
    </View>
  );
}

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

type FeedBodyProps = {
  items: TechnicianFeedItem[];
  isLoading: boolean;
  isError: boolean;
  hasFilters: boolean;
  onClear: () => void;
  onRetry: () => void;
  onEndReached: () => void;
  isFetchingNextPage: boolean;
  headerHeight: number;
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
  headerHeight,
}: FeedBodyProps) {
  const { colors } = useNaroTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabBarReserve = Math.max(insets.bottom, 10) + 82;
  const availableHeight = height - Math.max(headerHeight, 54) - tabBarReserve;
  const cardHeight = Math.max(360, availableHeight);
  const snapHeight = Math.floor(cardHeight);

  const renderItem = useCallback(
    ({ item }: { item: TechnicianFeedItem }) => (
      <View
        style={{
          height: snapHeight,
          paddingHorizontal: 20,
          justifyContent: "center",
        }}
      >
        <TechnicianFeedCard item={item} />
      </View>
    ),
    [snapHeight],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<TechnicianFeedItem> | null | undefined, index: number) => ({
      length: snapHeight,
      offset: snapHeight * index,
      index,
    }),
    [snapHeight],
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center gap-3">
        <ActivityIndicator size="large" color={colors.info} />
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
      style={styles.list}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      snapToInterval={snapHeight}
      snapToAlignment="start"
      decelerationRate="fast"
      disableIntervalMomentum
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      initialNumToRender={2}
      maxToRenderPerBatch={3}
      windowSize={5}
      removeClippedSubviews={false}
      getItemLayout={getItemLayout}
      ListFooterComponent={
        isFetchingNextPage ? (
          <View className="items-center py-4">
            <ActivityIndicator size="small" color={colors.info} />
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  portalRoot: {
    ...StyleSheet.absoluteFillObject,
  },
  filterDismissLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    zIndex: 2,
  },
  filterOverlay: {
    elevation: 30,
    zIndex: 30,
  },
  filterPanel: {
    elevation: 31,
    zIndex: 31,
  },
  filterRailContent: {
    gap: 8,
    paddingRight: 20,
  },
  list: {
    flex: 1,
  },
});
