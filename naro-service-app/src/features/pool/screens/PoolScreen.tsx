import type { ServiceCase } from "@naro/domain";
import { Icon, Screen, Text } from "@naro/ui";
import { Search, X } from "lucide-react-native";
import { useDeferredValue, useMemo, useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCasePool } from "@/features/jobs/api";

import { PoolReelsCard } from "../components/PoolReelsCard";

const HEADER_HEIGHT = 68;
const TAB_BAR_BASE = 68;

export function PoolScreen() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get("window").height;
  const cardHeight =
    screenHeight - HEADER_HEIGHT - TAB_BAR_BASE - insets.bottom - insets.top;

  const { data: cases = [] } = useCasePool();

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    if (!needle) return cases;
    return cases.filter((caseItem) => {
      const haystacks = [
        caseItem.title,
        caseItem.subtitle,
        caseItem.summary,
        caseItem.kind,
        caseItem.request.breakdown_category ?? "",
        caseItem.request.damage_area ?? "",
      ];
      return haystacks.some((field) =>
        field.toLowerCase().includes(needle),
      );
    });
  }, [cases, deferredQuery]);

  const getItemLayout = useMemo(() => {
    return (_data: ArrayLike<ServiceCase> | null | undefined, index: number) => ({
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

      {hasResults ? (
        <FlatList<ServiceCase>
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PoolReelsCard caseItem={item} cardHeight={cardHeight} />
          )}
          showsVerticalScrollIndicator={false}
          snapToOffsets={snapOffsets}
          decelerationRate="fast"
          getItemLayout={getItemLayout}
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          windowSize={3}
        />
      ) : (
        <EmptyPool
          query={deferredQuery}
          hasQuery={hasQuery}
          totalCases={cases.length}
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
