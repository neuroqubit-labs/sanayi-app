import {
  BackButton,
  FilterRail,
  Icon,
  Screen,
  SearchPillInput,
  Text,
  useNaroTheme,
} from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import {
  ArrowRight,
  BookOpen,
  MapPin,
  Sparkles,
  Star,
  Tag,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { useActiveVehicle } from "@/features/vehicles";

import { useSearchResults } from "../api";
import {
  SEARCH_POPULAR_QUERIES,
  SEARCH_PROMPTS,
  SEARCH_VEHICLE_SUGGESTIONS,
} from "../data/fixtures";
import { useSearchRecentStore } from "../store";
import type { SearchCategory, SearchPrompt, SearchResult } from "../types";

const CATEGORIES: { id: SearchCategory; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "usta", label: "Usta" },
  { id: "servis", label: "Servis" },
  { id: "bakim", label: "Bakım" },
  { id: "kampanya", label: "Kampanya" },
  { id: "rehber", label: "Rehber" },
];

const PROMPT_ICONS: Record<SearchCategory, LucideIcon> = {
  all: Sparkles,
  usta: Wrench,
  servis: Wrench,
  bakim: Tag,
  kampanya: Sparkles,
  rehber: BookOpen,
};

export function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SearchCategory>("all");
  const { data: vehicle } = useActiveVehicle();
  const recent = useSearchRecentStore((s) => s.queries);
  const pushRecent = useSearchRecentStore((s) => s.pushQuery);
  const clearRecent = useSearchRecentStore((s) => s.clear);
  const results = useSearchResults(query, category);

  const trimmed = useMemo(() => query.trim(), [query]);
  const isSearching = trimmed.length > 0;

  function runQuery(next: string) {
    setQuery(next);
    pushRecent(next);
  }

  return (
    <Screen padded={false} className="flex-1" backgroundClassName="bg-app-bg">
      <View className="gap-4 px-5 pb-2 pt-2">
        <View className="flex-row items-center gap-3">
          <BackButton variant="close" onPress={() => router.back()} />
          <SearchPillInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder="Usta, bakım, kampanya ara..."
            onSubmitEditing={() => {
              if (trimmed) pushRecent(trimmed);
            }}
          />
        </View>

        <FilterRail
          rows={[
            {
              key: "category",
              options: CATEGORIES.map((c) => ({
                key: c.id,
                label: c.label,
                selected: category === c.id,
                accessibilityLabel: `${c.label} kategorisi`,
                onPress: () => setCategory(c.id),
              })),
            },
          ]}
        />
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 140,
          gap: 28,
        }}
      >
        {isSearching ? (
          results.data && results.data.length > 0 ? (
            <ResultsList
              results={results.data}
              onOpen={(href) => router.push(href)}
            />
          ) : (
            <EmptyResults query={trimmed} onQuery={runQuery} />
          )
        ) : (
          <>
            <PromptsSection
              prompts={SEARCH_PROMPTS}
              onPress={(prompt) => router.push(prompt.route as Href)}
            />
            {vehicle ? (
              <SuggestionRow
                eyebrow={`${vehicle.make} ${vehicle.model} için önerilen`}
                chips={SEARCH_VEHICLE_SUGGESTIONS}
                onPressChip={(chip) => runQuery(chip.query)}
              />
            ) : null}
            {recent.length > 0 ? (
              <RecentRow
                queries={recent}
                onPressQuery={runQuery}
                onClear={clearRecent}
              />
            ) : null}
            <SuggestionRow
              eyebrow="Popüler aramalar"
              chips={SEARCH_POPULAR_QUERIES}
              onPressChip={(chip) => runQuery(chip.query)}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

type SectionEyebrowProps = {
  title: string;
  action?: { label: string; onPress: () => void };
};

function SectionEyebrow({ title, action }: SectionEyebrowProps) {
  return (
    <View className="flex-row items-center justify-between">
      <Text variant="eyebrow" tone="subtle">
        {title}
      </Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          hitSlop={6}
        >
          <Text variant="label" tone="accent">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type PromptsSectionProps = {
  prompts: SearchPrompt[];
  onPress: (prompt: SearchPrompt) => void;
};

function PromptsSection({ prompts, onPress }: PromptsSectionProps) {
  const { colors } = useNaroTheme();

  return (
    <View className="gap-3">
      <SectionEyebrow title="Ne arıyorsun?" />
      <View className="gap-2.5">
        {prompts.map((prompt) => {
          const IconComponent = PROMPT_ICONS[prompt.category];
          return (
            <Pressable
              key={prompt.id}
              accessibilityRole="button"
              accessibilityLabel={prompt.body}
              onPress={() => onPress(prompt)}
              className="flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5 active:bg-app-surface-2"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/15">
                <Icon icon={IconComponent} size={18} color={colors.info} />
              </View>
              <Text tone="muted" className="flex-1 text-app-text leading-5">
                {prompt.body}
              </Text>
              <Icon icon={ArrowRight} size={16} color={colors.info} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type SuggestionRowProps = {
  eyebrow: string;
  chips: { id: string; label: string; query: string }[];
  onPressChip: (chip: { id: string; label: string; query: string }) => void;
};

function SuggestionRow({ eyebrow, chips, onPressChip }: SuggestionRowProps) {
  return (
    <View className="gap-3">
      <SectionEyebrow title={eyebrow} />
      <View className="flex-row flex-wrap gap-2">
        {chips.map((chip) => (
          <Pressable
            key={chip.id}
            accessibilityRole="button"
            accessibilityLabel={`${chip.label} ara`}
            onPress={() => onPressChip(chip)}
            className="rounded-full border border-app-outline bg-app-surface px-3.5 py-2 active:bg-app-surface-2"
          >
            <Text variant="label" tone="inverse">
              {chip.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

type RecentRowProps = {
  queries: string[];
  onPressQuery: (query: string) => void;
  onClear: () => void;
};

function RecentRow({ queries, onPressQuery, onClear }: RecentRowProps) {
  return (
    <View className="gap-3">
      <SectionEyebrow
        title="Son aramalar"
        action={{ label: "Temizle", onPress: onClear }}
      />
      <View className="flex-row flex-wrap gap-2">
        {queries.map((query) => (
          <Pressable
            key={query}
            accessibilityRole="button"
            accessibilityLabel={`${query} ara`}
            onPress={() => onPressQuery(query)}
            className="rounded-full border border-app-outline bg-app-surface px-3.5 py-2 active:bg-app-surface-2"
          >
            <Text variant="label" tone="muted" className="text-app-text-muted">
              {query}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

type ResultsListProps = {
  results: SearchResult[];
  onOpen: (href: Href) => void;
};

function ResultsList({ results, onOpen }: ResultsListProps) {
  return (
    <View className="gap-3">
      <SectionEyebrow title={`${results.length} sonuç bulundu`} />
      <View className="gap-2.5">
        {results.map((result) => (
          <ResultCard
            key={`${result.kind}-${resultId(result)}`}
            result={result}
            onOpen={onOpen}
          />
        ))}
      </View>
    </View>
  );
}

function resultId(result: SearchResult): string {
  switch (result.kind) {
    case "tip":
      return result.item.id;
    case "technician":
      return result.item.id;
    case "service":
      return result.item.id;
    case "campaign":
      return result.item.id;
  }
}

type ResultCardProps = {
  result: SearchResult;
  onOpen: (href: Href) => void;
};

function ResultCard({ result, onOpen }: ResultCardProps) {
  const { colors } = useNaroTheme();

  switch (result.kind) {
    case "tip": {
      const tip = result.item;
      return (
        <Pressable
          accessibilityRole={tip.route ? "button" : undefined}
          onPress={tip.route ? () => onOpen(tip.route as Href) : undefined}
          className="flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5 active:bg-app-surface-2"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-app-info-soft">
            <Icon icon={BookOpen} size={18} color={colors.info} />
          </View>
          <View className="flex-1 gap-1">
            <Text variant="label" tone="inverse">
              {tip.title}
            </Text>
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted"
            >
              Rehber · {tip.tag} · {tip.readMinutes} dk okuma
            </Text>
          </View>
          {tip.route ? (
            <Icon icon={ArrowRight} size={16} color={colors.info} />
          ) : null}
        </Pressable>
      );
    }

    case "technician": {
      const tech = result.item;
      return (
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpen(`/usta/${tech.id}` as Href)}
          className="flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5 active:bg-app-surface-2"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/15">
            <Icon icon={Wrench} size={18} color={colors.info} />
          </View>
          <View className="flex-1 gap-1">
            <View className="flex-row items-center gap-2">
              <Text variant="label" tone="inverse" className="flex-1">
                {tech.name}
              </Text>
              <View className="flex-row items-center gap-0.5">
                <Icon
                  icon={Star}
                  size={12}
                  color={colors.warning}
                  strokeWidth={2.5}
                />
                <Text variant="caption" tone="warning">
                  {tech.rating.toFixed(1)}
                </Text>
              </View>
            </View>
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted"
            >
              Usta · {tech.tagline}
            </Text>
          </View>
          <Icon icon={ArrowRight} size={16} color={colors.info} />
        </Pressable>
      );
    }

    case "service": {
      const service = result.item;
      return (
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpen(service.route as Href)}
          className="flex-row items-center gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5 active:bg-app-surface-2"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-app-success-soft">
            <Icon icon={MapPin} size={18} color={colors.success} />
          </View>
          <View className="flex-1 gap-1">
            <Text variant="label" tone="inverse">
              {service.name}
            </Text>
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted"
            >
              Servis · {service.distanceLabel} · {service.ratingLabel}
            </Text>
          </View>
          <Icon icon={ArrowRight} size={16} color={colors.info} />
        </Pressable>
      );
    }

    case "campaign": {
      const campaign = result.item;
      return (
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpen(campaign.route as Href)}
          className="flex-row items-center gap-3 rounded-[20px] border border-brand-500/30 bg-app-surface-2 px-4 py-3.5 active:opacity-95"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500/20">
            <Icon icon={Sparkles} size={18} color={colors.info} />
          </View>
          <View className="flex-1 gap-1">
            <View className="flex-row items-center gap-2">
              <Text variant="label" tone="inverse" className="flex-1">
                {campaign.title}
              </Text>
              <Text variant="label" tone="success">
                {campaign.priceLabel}
              </Text>
            </View>
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted"
            >
              {campaign.categoryLabel ?? "Kampanya"} · {campaign.subtitle}
            </Text>
          </View>
        </Pressable>
      );
    }
  }
}

type EmptyResultsProps = {
  query: string;
  onQuery: (next: string) => void;
};

function EmptyResults({ query, onQuery }: EmptyResultsProps) {
  return (
    <View className="gap-6">
      <View className="gap-2 rounded-[24px] border border-dashed border-app-outline bg-app-surface px-5 py-6">
        <Text variant="eyebrow" tone="subtle">
          Sonuç bulunamadı
        </Text>
        <Text variant="h3" tone="inverse">
          "{query}" için eşleşme yok
        </Text>
        <Text tone="muted" className="text-app-text-muted leading-5">
          Farklı bir kelime veya aşağıdaki popüler aramalardan birini dene.
        </Text>
      </View>
      <SuggestionRow
        eyebrow="Popüler aramalar"
        chips={SEARCH_POPULAR_QUERIES}
        onPressChip={(chip) => onQuery(chip.query)}
      />
    </View>
  );
}
