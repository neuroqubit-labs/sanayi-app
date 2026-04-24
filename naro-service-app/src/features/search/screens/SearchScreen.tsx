import type { ServiceCase } from "@naro/domain";
import {
  BackButton,
  FilterRail,
  SearchPillInput,
  StatusChip,
  Text,
} from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import { useDeferredValue, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HomeCaseRow } from "@/features/home/components/HomeCaseRow";
import { useCasePool, useJobsFeed } from "@/features/jobs";
import { matchesQuery } from "@/features/jobs/search";

import { useSearchRecentStore } from "../store";

type Category = "all" | "vaka" | "musteri" | "plaka" | "sigorta";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "vaka", label: "Vaka" },
  { id: "musteri", label: "Müşteri" },
  { id: "plaka", label: "Plaka" },
  { id: "sigorta", label: "Sigorta" },
];

const SUGGESTIONS = ["Axa", "BMW", "Acil", "Kasko", "Yarın", "Maslak"];

export function SearchScreen() {
  const router = useRouter();
  const { data: jobs = [] } = useJobsFeed();
  const { data: pool = [] } = useCasePool();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState<Category>("all");
  const recent = useSearchRecentStore((s) => s.queries);
  const pushRecent = useSearchRecentStore((s) => s.pushQuery);
  const clearRecent = useSearchRecentStore((s) => s.clear);

  const trimmed = deferredQuery.trim();
  const isSearching = trimmed.length > 0;

  const results = useMemo(() => {
    if (!trimmed) return { jobs: [], pool: [] };
    const filterByCategory = (caseItem: ServiceCase) => {
      if (!matchesQuery(caseItem, trimmed)) return false;
      if (category === "all") return true;
      if (category === "vaka") return true;
      if (category === "sigorta") return caseItem.origin === "technician";
      return true; // musteri + plaka — haystack covers both
    };
    return {
      jobs: jobs.filter(filterByCategory),
      pool: pool.filter(filterByCategory),
    };
  }, [trimmed, category, jobs, pool]);

  const totalResults = results.jobs.length + results.pool.length;

  const handleSelect = (caseItem: ServiceCase, source: "job" | "pool") => {
    pushRecent(trimmed || caseItem.title);
    if (source === "pool") {
      router.push(`/vaka/${caseItem.id}` as Href);
    } else if (caseItem.status === "appointment_pending") {
      router.push(`/randevu/${caseItem.id}` as Href);
    } else {
      router.push(`/is/${caseItem.id}` as Href);
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-app-bg">
      <View className="flex-row items-center gap-2 px-4 pb-3 pt-2">
        <BackButton variant="close" onPress={() => router.back()} />
        <SearchPillInput
          value={query}
          onChangeText={setQuery}
          placeholder="Plaka, vaka, müşteri ara..."
          autoFocus
        />
      </View>

      <FilterRail
        className="px-4 pb-3"
        rows={[
          {
            key: "category",
            options: CATEGORIES.map((cat) => ({
              key: cat.id,
              label: cat.label,
              selected: category === cat.id,
              accessibilityLabel: `${cat.label} kategorisi`,
              onPress: () => setCategory(cat.id),
            })),
          },
        ]}
      />

      <ScrollView
        contentContainerClassName="gap-5 px-4 pb-10 pt-2"
        keyboardShouldPersistTaps="handled"
      >
        {!isSearching ? (
          <View className="gap-5">
            {recent.length > 0 ? (
              <View className="gap-2">
                <View className="flex-row items-center justify-between">
                  <Text variant="eyebrow" tone="subtle">
                    Son aramalar
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Son aramaları temizle"
                    onPress={clearRecent}
                    hitSlop={8}
                  >
                    <Text
                      variant="caption"
                      tone="muted"
                      className="text-app-text-subtle text-[11px]"
                    >
                      Temizle
                    </Text>
                  </Pressable>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {recent.map((q) => (
                    <Pressable
                      key={q}
                      accessibilityRole="button"
                      accessibilityLabel={`${q} ara`}
                      onPress={() => setQuery(q)}
                      className="rounded-full border border-app-outline bg-app-surface px-3 py-1.5 active:opacity-80"
                    >
                      <Text
                        variant="caption"
                        tone="muted"
                        className="text-[12px]"
                      >
                        {q}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View className="gap-2">
              <Text variant="eyebrow" tone="subtle">
                Hızlı öneriler
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    accessibilityRole="button"
                    accessibilityLabel={`${s} ara`}
                    onPress={() => setQuery(s)}
                    className="rounded-full border border-app-outline bg-app-surface-2 px-3 py-1.5 active:opacity-80"
                  >
                    <Text
                      variant="caption"
                      tone="muted"
                      className="text-[12px]"
                    >
                      {s}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="gap-2 rounded-[18px] border border-app-outline bg-app-surface px-4 py-3.5">
              <Text variant="label" tone="inverse" className="text-[13px]">
                Neler arayabilirsin?
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[12px]"
              >
                Plaka (34 ABC 42 · 34abc42), müşteri adı, vaka başlığı,
                kaza/arıza kategorisi, sigorta şirketi veya poliçe numarası.
              </Text>
            </View>
          </View>
        ) : (
          <View className="gap-4">
            <View className="flex-row items-center gap-2">
              <StatusChip
                label={`${totalResults} sonuç`}
                tone={totalResults > 0 ? "success" : "neutral"}
              />
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-subtle text-[11px]"
              >
                "{trimmed}"
              </Text>
            </View>

            {results.jobs.length > 0 ? (
              <View className="gap-2">
                <Text variant="eyebrow" tone="subtle">
                  Kayıtlarım ({results.jobs.length})
                </Text>
                {results.jobs.map((caseItem) => (
                  <HomeCaseRow
                    key={caseItem.id}
                    caseItem={caseItem}
                    onPress={() => handleSelect(caseItem, "job")}
                  />
                ))}
              </View>
            ) : null}

            {results.pool.length > 0 ? (
              <View className="gap-2">
                <Text variant="eyebrow" tone="subtle">
                  Havuz ({results.pool.length})
                </Text>
                {results.pool.map((caseItem) => (
                  <HomeCaseRow
                    key={caseItem.id}
                    caseItem={caseItem}
                    onPress={() => handleSelect(caseItem, "pool")}
                    trailingBadge={{ label: "Havuz", tone: "accent" }}
                  />
                ))}
              </View>
            ) : null}

            {totalResults === 0 ? (
              <View className="items-center gap-2 rounded-[20px] border border-dashed border-app-outline bg-app-surface px-4 py-10">
                <Text variant="label" tone="inverse">
                  "{trimmed}" için eşleşme yok
                </Text>
                <Text
                  tone="muted"
                  className="text-center text-app-text-muted text-[12px]"
                >
                  Farklı bir kelime veya kısım dene — örn. sadece "BMW" veya
                  plaka ortası "ABC".
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
