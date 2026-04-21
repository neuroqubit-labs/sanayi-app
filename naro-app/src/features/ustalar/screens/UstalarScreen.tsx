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

import { TechnicianReelsCard } from "../components/TechnicianReelsCard";
import { mockTechnicianProfiles } from "../data/fixtures";
import { useUstalarFeed, type UstalarFeedItem } from "../feed";

const HEADER_HEIGHT = 68;
const TAB_BAR_BASE = 68;

export function UstalarScreen() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get("window").height;
  const cardHeight =
    screenHeight - HEADER_HEIGHT - TAB_BAR_BASE - insets.bottom - insets.top;
  const sectionLabelHeight = 72;

  const { data: items = [] } = useUstalarFeed({
    query: deferredQuery,
  });

  const hasResults = items.length > 0;
  const hasProfiles = items.some((item) => item.kind === "profile");

  const getItemLayout = useMemo(() => {
    const offsets: number[] = [];
    let accum = 0;
    items.forEach((item) => {
      offsets.push(accum);
      accum += item.kind === "profile" ? cardHeight : sectionLabelHeight;
    });
    return (_data: ArrayLike<UstalarFeedItem> | null | undefined, index: number) => {
      const length =
        items[index]?.kind === "profile" ? cardHeight : sectionLabelHeight;
      return {
        length,
        offset: offsets[index] ?? index * cardHeight,
        index,
      };
    };
  }, [items, cardHeight]);

  return (
    <Screen padded={false} backgroundClassName="bg-app-bg" className="flex-1">
      <View className="gap-3 px-5 pt-3" style={{ height: HEADER_HEIGHT }}>
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
      </View>

      {hasResults && hasProfiles ? (
        <FlatList<UstalarFeedItem>
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) =>
            item.kind === "profile" ? (
              <TechnicianReelsCard
                profile={item.profile}
                section={item.section}
                reason={item.reason}
                cardHeight={cardHeight}
              />
            ) : (
              <SectionLabel
                label={item.label}
                hint={item.hint}
                height={sectionLabelHeight}
              />
            )
          }
          showsVerticalScrollIndicator={false}
          pagingEnabled={false}
          snapToOffsets={buildSnapOffsets(items, cardHeight, sectionLabelHeight)}
          decelerationRate="fast"
          getItemLayout={getItemLayout}
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          windowSize={3}
        />
      ) : (
        <EmptyResults
          query={deferredQuery}
          onClearQuery={() => setQuery("")}
          hasQuery={deferredQuery.trim().length > 0}
          totalProfiles={mockTechnicianProfiles.length}
        />
      )}
    </Screen>
  );
}

function buildSnapOffsets(
  items: UstalarFeedItem[],
  cardHeight: number,
  labelHeight: number,
): number[] {
  const offsets: number[] = [];
  let accum = 0;
  for (const item of items) {
    offsets.push(accum);
    accum += item.kind === "profile" ? cardHeight : labelHeight;
  }
  return offsets;
}

type SectionLabelProps = {
  label: string;
  hint?: string;
  height: number;
};

function SectionLabel({ label, hint, height }: SectionLabelProps) {
  return (
    <View style={{ height }} className="justify-center px-6">
      <Text variant="eyebrow" tone="subtle">
        {label.toUpperCase()}
      </Text>
      <Text variant="h3" tone="inverse">
        {label}
      </Text>
      {hint ? (
        <Text variant="caption" tone="muted" className="text-app-text-muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

type EmptyResultsProps = {
  query: string;
  onClearQuery: () => void;
  hasQuery: boolean;
  totalProfiles: number;
};

function EmptyResults({
  query,
  onClearQuery,
  hasQuery,
  totalProfiles,
}: EmptyResultsProps) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-6">
      <View className="h-14 w-14 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
        <Icon icon={Search} size={22} color="#83a7ff" />
      </View>
      <View className="items-center gap-2">
        <Text variant="h3" tone="inverse" className="text-center">
          {hasQuery
            ? `"${query.trim()}" için eşleşme yok`
            : "Aranacak bir şey yaz"}
        </Text>
        <Text tone="muted" className="text-center text-app-text-muted leading-5">
          Farklı bir kelime dene veya kategoriyi temizle. Sistemde {totalProfiles}{" "}
          usta kayıtlı.
        </Text>
      </View>
      <View className="flex-row gap-2">
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
    </View>
  );
}
