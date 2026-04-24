import {
  Icon,
  PressableCard,
  Screen,
  Surface,
  Text,
  ToggleChip,
  TrustBadge,
} from "@naro/ui";
import { Href, useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Heart,
  SlidersHorizontal,
  Sparkles,
  Truck,
  Wrench,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";

import { useActiveVehicle, useVehicleSwitcherStore } from "@/features/vehicles";

import { useRecordsFeed } from "../api";
import { RecordCard } from "../components/RecordCard";
import type { RecordItem, RecordsFeed } from "../types";

const ARCHIVE_FILTERS = [
  { key: "all", label: "Tümü" },
  { key: "maintenance", label: "Bakım" },
  { key: "damage", label: "Hasar" },
  { key: "towing", label: "Çekici" },
] as const;

type FilterKey = (typeof ARCHIVE_FILTERS)[number]["key"];

const EMPTY_ACTIONS = [
  {
    key: "accident",
    title: "Kaza bildir",
    description: "Acil panel, foto rehberi, tutanak ve sigorta",
    route: "/(modal)/talep/accident",
    icon: AlertTriangle,
    tone: "critical" as const,
  },
  {
    key: "maintenance",
    title: "Bakım planla",
    description: "Periyodik bakımdan kampanyaya her tip",
    route: "/(modal)/talep/maintenance",
    icon: Heart,
    tone: "success" as const,
  },
  {
    key: "towing",
    title: "Çekici çağır",
    description: "Konum, zaman ve fiyat tahmini tek yüzeyde",
    route: "/(modal)/talep/towing",
    icon: Truck,
    tone: "warning" as const,
  },
  {
    key: "breakdown",
    title: "Arıza bildir",
    description: "Kategori, belirti ve kanıt tek akışta",
    route: "/(modal)/talep/breakdown",
    icon: Wrench,
    tone: "info" as const,
  },
];

export function RecordsScreen() {
  const router = useRouter();
  const { data: activeVehicle } = useActiveVehicle();
  const openVehicleSwitcher = useVehicleSwitcherStore((s) => s.open);
  const { data: feed = { activeRecords: [], items: [] } as RecordsFeed } =
    useRecordsFeed();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const archiveItems = useMemo<RecordItem[]>(() => {
    if (filter === "all") return feed.items;
    if (filter === "damage") {
      return feed.items.filter(
        (item) => item.kind === "breakdown" || item.kind === "accident",
      );
    }
    return feed.items.filter((item) => item.kind === filter);
  }, [feed.items, filter]);

  const totalActive = feed.activeRecords.length;
  const totalCompleted = feed.items.length;
  const isEmpty = totalActive === 0 && totalCompleted === 0;

  return (
    <Screen
      padded={false}
      backgroundClassName="bg-app-bg"
      className="flex-1"
    >
      <FlatList<RecordItem>
        data={archiveItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="px-5">
            <RecordCard item={item} />
          </View>
        )}
        ItemSeparatorComponent={() => <View className="h-3" />}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View className="gap-5 px-5 pb-4">
            <RecordsPillHeader
              activeVehicleLabel={
                activeVehicle
                  ? `${activeVehicle.plate} · ${activeVehicle.make} ${activeVehicle.model}`
                  : null
              }
              onOpenVehicleSwitcher={openVehicleSwitcher}
              filterActive={filter !== "all"}
              filtersOpen={filtersOpen}
              onToggleFilters={() => setFiltersOpen((prev) => !prev)}
            />

            {filtersOpen ? (
              <View className="flex-row flex-wrap gap-2">
                {ARCHIVE_FILTERS.map((item) => (
                  <ToggleChip
                    key={item.key}
                    label={item.label}
                    selected={filter === item.key}
                    onPress={() => setFilter(item.key)}
                    size="sm"
                  />
                ))}
              </View>
            ) : null}

            {isEmpty ? (
              <EmptyState onAction={(route) => router.push(route as Href)} />
            ) : null}

            {totalActive > 0 ? (
              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="h-2 w-2 rounded-full bg-app-success" />
                    <Text variant="h3" tone="inverse">
                      Devam eden işlemler
                    </Text>
                  </View>
                  <TrustBadge
                    label={`${totalActive} aktif`}
                    tone="success"
                  />
                </View>
                <View className="gap-3">
                  {feed.activeRecords.map((record) => (
                    <RecordCard key={record.id} item={record} prominent />
                  ))}
                </View>
              </View>
            ) : null}

            {totalCompleted > 0 ? (
              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text variant="h3" tone="inverse">
                    Geçmiş kayıtlar
                  </Text>
                  <Text tone="muted" className="text-app-text-muted">
                    {totalCompleted} kayıt
                  </Text>
                </View>
              </View>
            ) : null}

            {!isEmpty && totalCompleted <= 1 ? (
              <GuidanceCard
                onAction={(route) => router.push(route as Href)}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          totalCompleted === 0 && !isEmpty ? null : totalCompleted > 0 &&
            archiveItems.length === 0 ? (
            <Surface
              variant="flat"
              radius="lg"
              className="mx-5 gap-2 px-4 py-4"
            >
              <Text variant="label" tone="inverse">
                Bu filtreyle eşleşen kayıt yok
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted"
              >
                Farklı bir kategori dene ya da yeni bir talep başlat.
              </Text>
            </Surface>
          ) : null
        }
      />
    </Screen>
  );
}

type EmptyStateProps = {
  onAction: (route: string) => void;
};

const GUIDANCE_ACTIONS = [
  {
    key: "maintenance",
    title: "Bakım planla",
    hint: "Periyodik bakım veya paket",
    route: "/(modal)/talep/maintenance",
    icon: Heart,
  },
  {
    key: "accident",
    title: "Hasar bildir",
    hint: "Kaza, darbe, cam kırığı",
    route: "/(modal)/talep/accident",
    icon: AlertTriangle,
  },
  {
    key: "towing",
    title: "Çekici çağır",
    hint: "Anında veya randevulu",
    route: "/(modal)/talep/towing",
    icon: Truck,
  },
];

function GuidanceCard({ onAction }: EmptyStateProps) {
  return (
    <Surface
      variant="raised"
      radius="xl"
      className="gap-3 overflow-hidden border-brand-500/20 bg-app-surface-2 px-4 py-4"
    >
      <View className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand-500/10" />
      <View className="flex-row items-center gap-2">
        <Icon icon={Sparkles} size={13} color="#83a7ff" />
        <Text variant="eyebrow" tone="subtle" className="text-[10px]">
          Öneri ve talep
        </Text>
      </View>
      <Text variant="h3" tone="inverse" className="text-[15px] leading-[19px]">
        Daha fazla geçmiş için
      </Text>
      <View className="gap-2">
        {GUIDANCE_ACTIONS.map((action) => (
          <PressableCard
            key={action.key}
            accessibilityRole="button"
            accessibilityLabel={action.title}
            onPress={() => onAction(action.route)}
            variant="flat"
            radius="md"
            className="flex-row items-center gap-3 px-3 py-2.5"
          >
            <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-500/10">
              <Icon icon={action.icon} size={14} color="#83a7ff" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="label" tone="inverse" className="text-[13px]">
                {action.title}
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[11px]"
              >
                {action.hint}
              </Text>
            </View>
            <Icon icon={ArrowRight} size={12} color="#83a7ff" />
          </PressableCard>
        ))}
      </View>
    </Surface>
  );
}

type RecordsPillHeaderProps = {
  activeVehicleLabel: string | null;
  onOpenVehicleSwitcher: () => void;
  filterActive: boolean;
  filtersOpen: boolean;
  onToggleFilters: () => void;
};

function RecordsPillHeader({
  activeVehicleLabel,
  onOpenVehicleSwitcher,
  filterActive,
  filtersOpen,
  onToggleFilters,
}: RecordsPillHeaderProps) {
  return (
    <View className="flex-row items-center gap-2">
      <PressableCard
        accessibilityRole="button"
        accessibilityLabel="Araç seç"
        onPress={onOpenVehicleSwitcher}
        variant="flat"
        radius="lg"
        className="h-14 flex-1 flex-row items-center gap-3 border-app-outline-strong px-3"
      >
        <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-500/15">
          <Icon icon={Truck} size={18} color="#0ea5e9" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="label" tone="inverse" numberOfLines={1}>
            {activeVehicleLabel ?? "Araç seç"}
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted"
            numberOfLines={1}
          >
            Bu araca ait kayıtlar
          </Text>
        </View>
        <Icon icon={ChevronDown} size={16} color="#83a7ff" />
      </PressableCard>
      <PressableCard
        accessibilityRole="button"
        accessibilityLabel={filtersOpen ? "Filtreleri kapat" : "Filtre"}
        onPress={onToggleFilters}
        variant="flat"
        radius="lg"
        className={[
          "h-14 w-14 items-center justify-center",
          filtersOpen || filterActive
            ? "border-brand-500/50"
            : "border-app-outline-strong",
        ].join(" ")}
      >
        <View>
          <Icon icon={SlidersHorizontal} size={22} color="#f5f7ff" />
          {filterActive ? (
            <View className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-app-surface bg-brand-500" />
          ) : null}
        </View>
      </PressableCard>
    </View>
  );
}

function EmptyState({ onAction }: EmptyStateProps) {
  return (
    <Surface variant="raised" radius="xl" className="gap-4 px-4 py-5">
      <View className="gap-2">
        <Text variant="h3" tone="inverse">
          Şu an açık vaka yok
        </Text>
        <Text tone="muted" className="text-app-text-muted">
          Geçmiş işler, garanti izi ve faturalar güvende. Bir talep
          başlattığında burada en üstte sabitlenecek.
        </Text>
      </View>
      <View className="gap-3">
        {EMPTY_ACTIONS.map((action) => (
          <PressableCard
            key={action.key}
            accessibilityRole="button"
            accessibilityLabel={action.title}
            onPress={() => onAction(action.route)}
            variant="elevated"
            radius="lg"
            className="flex-row items-center gap-3 px-4 py-3.5"
          >
            <View className="h-11 w-11 items-center justify-center rounded-full border border-app-outline bg-app-surface">
              <Icon icon={action.icon} size={18} color="#f5f7ff" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="label" tone="inverse">
                {action.title}
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted"
              >
                {action.description}
              </Text>
            </View>
            <TrustBadge label="Başlat" tone={action.tone} />
          </PressableCard>
        ))}
      </View>
    </Surface>
  );
}
