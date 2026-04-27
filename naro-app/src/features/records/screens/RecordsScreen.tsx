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
  CarFront,
  ChevronDown,
  FileClock,
  Heart,
  SlidersHorizontal,
  Sparkles,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";

import { useTowEntryRoute } from "@/features/tow/entry";
import { useActiveVehicle, useVehicleSwitcherStore } from "@/features/vehicles";

import { useRecordsFeed } from "../api";
import { RecordCard } from "../components/RecordCard";
import type { RecordItem, RecordsFeed } from "../types";

const ARCHIVE_FILTERS = [
  { key: "all", label: "Tümü" },
  { key: "maintenance", label: "Bakım" },
  { key: "breakdown", label: "Arıza" },
  { key: "accident", label: "Hasar" },
  { key: "towing", label: "Çekici" },
] as const;

type FilterKey = (typeof ARCHIVE_FILTERS)[number]["key"];

function recordMatchesFilter(item: RecordItem, filter: FilterKey) {
  return filter === "all" || item.kind === filter;
}

const EMPTY_ACTIONS = [
  {
    key: "accident",
    title: "Kaza bildir",
    description: "Acil panel, foto rehberi, tutanak ve sigorta",
    route: "/(modal)/talep/accident" as Href,
    icon: AlertTriangle,
    tone: "critical" as const,
  },
  {
    key: "maintenance",
    title: "Bakım planla",
    description: "Periyodik bakımdan kampanyaya her tip",
    route: "/(modal)/talep/maintenance" as Href,
    icon: Heart,
    tone: "success" as const,
  },
  {
    key: "towing",
    title: "Çekici çağır",
    description: "Konum, zaman ve fiyat tahmini tek yüzeyde",
    route: "/(modal)/talep/towing" as Href,
    icon: Truck,
    tone: "warning" as const,
  },
  {
    key: "breakdown",
    title: "Arıza bildir",
    description: "Kategori, belirti ve kanıt tek akışta",
    route: "/(modal)/talep/breakdown" as Href,
    icon: Wrench,
    tone: "info" as const,
  },
];

const ADD_VEHICLE_ACTION = {
  key: "vehicle",
  title: "Aracını ekle",
  description: "Kayıtlar ve vaka önerileri araç profiline bağlanır",
  route: "/arac/yeni" as Href,
  icon: CarFront,
  tone: "success" as const,
};

type EmptyAction = {
  key: string;
  title: string;
  description: string;
  route: Href;
  icon: LucideIcon;
  tone: "accent" | "neutral" | "success" | "warning" | "critical" | "info";
};

export function RecordsScreen() {
  const router = useRouter();
  const { data: activeVehicle } = useActiveVehicle();
  const towEntry = useTowEntryRoute({
    vehicleId: activeVehicle?.id,
  });
  const openVehicleSwitcher = useVehicleSwitcherStore((s) => s.open);
  const { data: feed = { activeRecords: [], items: [] } as RecordsFeed } =
    useRecordsFeed();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeVehicleLabel = activeVehicle
    ? `${activeVehicle.plate} · ${activeVehicle.make} ${activeVehicle.model}`
    : null;
  const selectedFilterLabel =
    ARCHIVE_FILTERS.find((item) => item.key === filter)?.label ?? "Tümü";

  const archiveItems = useMemo<RecordItem[]>(() => {
    return feed.items.filter((item) => recordMatchesFilter(item, filter));
  }, [feed.items, filter]);
  const activeItems = useMemo<RecordItem[]>(() => {
    return feed.activeRecords.filter((item) => recordMatchesFilter(item, filter));
  }, [feed.activeRecords, filter]);

  const totalActive = activeItems.length;
  const totalCompleted = archiveItems.length;
  const allRecordsCount = feed.activeRecords.length + feed.items.length;
  const isEmpty = allRecordsCount === 0;
  const isFilterEmpty = !isEmpty && totalActive === 0 && totalCompleted === 0;
  const emptyActions: EmptyAction[] = [
    ...(activeVehicle ? [] : [ADD_VEHICLE_ACTION]),
    ...EMPTY_ACTIONS,
  ].map((action) =>
    action.key === "towing" ? { ...action, route: towEntry.route } : action,
  );
  const guidanceActions: GuidanceAction[] = GUIDANCE_ACTIONS.map((action) =>
    action.key === "towing"
      ? { ...action, route: towEntry.route }
      : action,
  );

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
              activeVehicleLabel={activeVehicleLabel}
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

            {!isEmpty ? (
              <RecordsDigest
                activeCount={totalActive}
                archiveCount={totalCompleted}
                filterLabel={selectedFilterLabel}
                activeVehicleLabel={activeVehicleLabel}
              />
            ) : null}

            {isEmpty ? (
              <EmptyState
                actions={emptyActions}
                activeVehicleLabel={activeVehicleLabel}
                onAction={(route) => router.push(route as Href)}
              />
            ) : null}

            {totalActive > 0 ? (
              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="h-2 w-2 rounded-full bg-app-success" />
                    <Text variant="h3" tone="inverse">
                      Aktif vaka akışı
                    </Text>
                  </View>
                  <TrustBadge
                    label={`${totalActive} aktif`}
                    tone="success"
                  />
                </View>
                <View className="gap-3">
                  {activeItems.map((record) => (
                    <RecordCard key={record.id} item={record} mode="active" />
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

            {!isEmpty &&
            filter === "all" &&
            feed.activeRecords.length === 0 &&
            feed.items.length <= 1 ? (
              <GuidanceCard
                actions={guidanceActions}
                onAction={(route) => router.push(route as Href)}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isFilterEmpty ? (
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
  onAction: (route: Href) => void;
};

const GUIDANCE_ACTIONS = [
  {
    key: "maintenance",
    title: "Bakım planla",
    hint: "Periyodik bakım veya paket",
    route: "/(modal)/talep/maintenance" as Href,
    icon: Heart,
  },
  {
    key: "accident",
    title: "Hasar bildir",
    hint: "Kaza, darbe, cam kırığı",
    route: "/(modal)/talep/accident" as Href,
    icon: AlertTriangle,
  },
  {
    key: "towing",
    title: "Çekici çağır",
    hint: "Anında veya randevulu",
    route: "/(modal)/talep/towing" as Href,
    icon: Truck,
  },
];

type GuidanceAction = (typeof GUIDANCE_ACTIONS)[number] & {
  route: Href;
};

function GuidanceCard({
  actions,
  onAction,
}: EmptyStateProps & {
  actions: GuidanceAction[];
}) {
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
        {actions.map((action) => (
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
            {activeVehicleLabel ? "Bu araca ait kayıtlar" : "Tüm araç kayıtları"}
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

function RecordsDigest({
  activeCount,
  archiveCount,
  filterLabel,
  activeVehicleLabel,
}: {
  activeCount: number;
  archiveCount: number;
  filterLabel: string;
  activeVehicleLabel: string | null;
}) {
  return (
    <Surface
      variant="flat"
      radius="lg"
      className="gap-3 border-app-outline-strong bg-app-surface px-4 py-3.5"
    >
      <View className="flex-row items-center gap-2">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-500/15">
          <Icon icon={FileClock} size={17} color="#83a7ff" />
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="label" tone="inverse">
            Vaka günlüğü
          </Text>
          <Text
            variant="caption"
            tone="muted"
            numberOfLines={1}
            className="text-app-text-muted"
          >
            {activeVehicleLabel ?? "Araç seçilmeden tüm kayıtlar"} · {filterLabel}
          </Text>
        </View>
      </View>
      <View className="flex-row gap-2">
        <DigestPill label="Aktif" value={`${activeCount}`} tone="success" />
        <DigestPill label="Geçmiş" value={`${archiveCount}`} tone="info" />
        <DigestPill label="Filtre" value={filterLabel} tone="neutral" />
      </View>
    </Surface>
  );
}

function DigestPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "info" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? "bg-app-success-soft"
      : tone === "info"
        ? "bg-brand-500/10"
        : "bg-app-surface-2";

  return (
    <View className={["flex-1 rounded-[16px] px-3 py-2", toneClass].join(" ")}>
      <Text variant="label" tone="inverse" numberOfLines={1}>
        {value}
      </Text>
      <Text variant="caption" tone="subtle" className="text-[11px]">
        {label}
      </Text>
    </View>
  );
}

function EmptyState({
  actions,
  activeVehicleLabel,
  onAction,
}: EmptyStateProps & {
  actions: EmptyAction[];
  activeVehicleLabel: string | null;
}) {
  return (
    <Surface variant="raised" radius="xl" className="gap-4 px-4 py-5">
      <View className="gap-2">
        <Text variant="h3" tone="inverse">
          {activeVehicleLabel ? "Bu araç için kayıt yok" : "Henüz kayıt yok"}
        </Text>
        <Text tone="muted" className="text-app-text-muted">
          {activeVehicleLabel
            ? "Bu araçla ilk bakım, arıza, hasar veya çekici vakanı başlattığında burada kronoloji oluşacak."
            : "Aracını ekleyip ilk vakayı başlattığında aktif süreçler ve geçmiş kayıtlar burada toplanacak."}
        </Text>
      </View>
      <View className="gap-3">
        {actions.map((action) => (
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
