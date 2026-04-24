import type { ServiceCase } from "@naro/domain";
import { buildTechnicianTrackingView } from "@naro/mobile-core";
import {
  FilterRail,
  SearchPillInput,
  Text,
  TrustBadge,
  useNaroTheme,
} from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import { ArrowRight, CalendarClock, ShieldCheck } from "lucide-react-native";
import { useDeferredValue, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useInsuranceCapability } from "@/features/technicians";

import { useIncomingAppointments, useJobsFeed } from "../api.case-live";
import { JobRecordCard } from "../components/JobRecordCard";
import { buildSearchHaystack, normalizeForSearch } from "../search";

type FilterKey =
  | "all"
  | "urgent"
  | "waiting_customer"
  | "appointment_pending"
  | "insurance"
  | "completed";

function classifySection(
  progressValue: number,
  waitActor: string,
  hasPrimaryAction: boolean,
) {
  if (waitActor === "technician" && hasPrimaryAction) {
    return "Benden aksiyon bekleyen";
  }

  if (waitActor === "customer") {
    return "Müşteri onayı bekleyen";
  }

  if (progressValue >= 80) {
    return "Teslime yakın";
  }

  return "Sorunsuz ilerleyen";
}

export function JobsScreen() {
  const router = useRouter();
  const { colors } = useNaroTheme();
  const { data: cases = [] } = useJobsFeed();
  const { data: incomingAppointments = [] } = useIncomingAppointments();
  const hasInsuranceCapability = useInsuranceCapability();

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [filter, setFilter] = useState<FilterKey>("all");

  const insuranceCases = cases.filter(
    (caseItem) => caseItem.origin === "technician",
  );

  const haystacks = useMemo(() => {
    const map = new Map<string, string>();
    cases.forEach((caseItem) => {
      map.set(caseItem.id, buildSearchHaystack(caseItem));
    });
    return map;
  }, [cases]);

  const filtered = useMemo(() => {
    const needle = normalizeForSearch(deferredQuery.trim());
    let items = cases;

    // "Tümü" varsayılanı aktif iş listesi; completed/archived yalnızca
    // "Tamamlandı" chip'inde gösterilir.
    if (filter === "completed") {
      items = items.filter(
        (caseItem) =>
          caseItem.status === "completed" || caseItem.status === "archived",
      );
    } else {
      items = items.filter(
        (caseItem) =>
          caseItem.status !== "completed" && caseItem.status !== "archived",
      );

      if (filter === "appointment_pending") {
        items = items.filter(
          (caseItem) => caseItem.status === "appointment_pending",
        );
      } else if (filter === "waiting_customer") {
        items = items.filter(
          (caseItem) =>
            buildTechnicianTrackingView(caseItem).waitState.actor ===
            "customer",
        );
      } else if (filter === "urgent") {
        items = items.filter((caseItem) => {
          const view = buildTechnicianTrackingView(caseItem);
          return (
            view.waitState.actor === "technician" && Boolean(view.primaryAction)
          );
        });
      } else if (filter === "insurance") {
        items = items.filter((caseItem) => caseItem.origin === "technician");
      }
    }

    if (needle) {
      const tokens = needle.split(" ").filter((t) => t.length > 0);
      items = items.filter((caseItem) => {
        const blob = haystacks.get(caseItem.id) ?? "";
        return tokens.every((token) => blob.includes(token));
      });
    }

    return items;
  }, [cases, deferredQuery, filter, haystacks]);

  const activeAndArchive = useMemo(() => {
    const active: ServiceCase[] = [];
    const archive: ServiceCase[] = [];
    for (const caseItem of filtered) {
      if (caseItem.status === "completed" || caseItem.status === "archived") {
        archive.push(caseItem);
      } else {
        active.push(caseItem);
      }
    }
    return { active, archive };
  }, [filtered]);

  const grouped = useMemo(() => {
    return activeAndArchive.active.reduce<
      Record<string, ReturnType<typeof buildTechnicianTrackingView>[]>
    >((accumulator, caseItem) => {
      const view = buildTechnicianTrackingView(caseItem);
      const key = classifySection(
        view.progressValue,
        view.waitState.actor,
        Boolean(view.primaryAction),
      );
      accumulator[key] = [...(accumulator[key] ?? []), view];
      return accumulator;
    }, {});
  }, [activeAndArchive.active]);

  const sectionOrder = [
    "Benden aksiyon bekleyen",
    "Müşteri onayı bekleyen",
    "Sorunsuz ilerleyen",
    "Teslime yakın",
  ];

  const activeJobs = cases.filter(
    (caseItem) =>
      caseItem.status !== "completed" && caseItem.origin !== "technician",
  ).length;
  const waitingCustomer = cases.filter(
    (caseItem) =>
      buildTechnicianTrackingView(caseItem).waitState.actor === "customer",
  ).length;
  const finishingSoon = cases.filter(
    (caseItem) => buildTechnicianTrackingView(caseItem).progressValue >= 80,
  ).length;
  const completedCount = cases.filter(
    (caseItem) =>
      caseItem.status === "completed" || caseItem.status === "archived",
  ).length;

  const filterOptions: { key: FilterKey; label: string; badge?: number }[] = [
    { key: "all", label: "Tümü" },
    { key: "urgent", label: "Acil", badge: undefined },
    {
      key: "appointment_pending",
      label: "Randevu",
      badge: incomingAppointments.length || undefined,
    },
    { key: "waiting_customer", label: "Müşteri" },
    ...(hasInsuranceCapability
      ? [
          {
            key: "insurance" as FilterKey,
            label: "Sigorta",
            badge: insuranceCases.length || undefined,
          },
        ]
      : []),
    {
      key: "completed",
      label: "Tamamlandı",
      badge: completedCount || undefined,
    },
  ];

  const isCompletedFilter = filter === "completed";

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-app-bg">
      {/* Sticky search bar */}
      <View className="border-b border-app-outline/40 bg-app-bg px-6 pb-3 pt-3">
        <SearchPillInput
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery("")}
          placeholder="Plaka, vaka, müşteri ara..."
        />
      </View>

      <ScrollView
        contentContainerClassName="gap-5 px-6 pb-28 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-3">
          <View className="gap-1">
            <Text variant="eyebrow" tone="subtle">
              İşlerim
            </Text>
            <Text
              variant="display"
              tone="inverse"
              className="text-[26px] leading-[30px]"
            >
              Kayıtlar
            </Text>
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted"
            >
              {activeJobs} aktif · {waitingCustomer} müşteri bekliyor ·{" "}
              {finishingSoon} teslime yakın
            </Text>
          </View>

          <FilterRail
            rows={[
              {
                key: "job-filters",
                options: filterOptions.map((option) => ({
                  key: option.key,
                  label: option.label,
                  badge: option.badge,
                  selected: filter === option.key,
                  onPress: () => setFilter(option.key),
                })),
              },
            ]}
          />
        </View>

        {/* Urgent: pending appointments */}
        {incomingAppointments.length > 0 &&
        filter !== "insurance" &&
        !isCompletedFilter ? (
          <View className="gap-3 rounded-[22px] border border-app-warning/40 bg-app-warning/10 px-4 py-4">
            <View className="flex-row items-center gap-2">
              <CalendarClock size={16} color={colors.warning} />
              <Text variant="label" tone="warning" className="text-[14px]">
                Randevu onayı bekleniyor
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="ml-auto text-app-text-subtle text-[11px]"
              >
                {incomingAppointments.length} talep
              </Text>
            </View>
            <View className="gap-2">
              {incomingAppointments.map((caseItem: ServiceCase) => (
                <Pressable
                  key={caseItem.id}
                  accessibilityRole="button"
                  onPress={() => router.push(`/randevu/${caseItem.id}` as Href)}
                  className="flex-row items-center gap-3 rounded-[14px] border border-app-outline bg-app-surface px-3 py-2.5 active:bg-app-surface-2"
                >
                  <View className="flex-1 gap-0.5">
                    <Text
                      variant="label"
                      tone="inverse"
                      className="text-[13px]"
                      numberOfLines={1}
                    >
                      {caseItem.title}
                    </Text>
                    <Text
                      variant="caption"
                      tone="muted"
                      className="text-app-text-muted text-[11px]"
                    >
                      {caseItem.subtitle} ·{" "}
                      {caseItem.appointment?.slot.dateLabel ??
                        caseItem.appointment?.slot.kind ??
                        ""}
                    </Text>
                  </View>
                  <TrustBadge label="Yanıtla" tone="warning" />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Insurance files */}
        {hasInsuranceCapability &&
        insuranceCases.length > 0 &&
        filter !== "insurance" &&
        !isCompletedFilter ? (
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <ShieldCheck size={16} color={colors.info} />
                <Text variant="h3" tone="inverse" className="text-[15px]">
                  Sigorta dosyalarım
                </Text>
              </View>
              <Text variant="caption" tone="subtle">
                {insuranceCases.length} dosya
              </Text>
            </View>
            <View className="gap-2">
              {insuranceCases.slice(0, 3).map((caseItem) => (
                <Pressable
                  key={caseItem.id}
                  accessibilityRole="button"
                  onPress={() => router.push(`/is/${caseItem.id}` as Href)}
                  className="flex-row items-center gap-3 rounded-[14px] border border-app-outline bg-app-surface px-3 py-3 active:bg-app-surface-2"
                >
                  <View className="flex-1 gap-0.5">
                    <Text
                      variant="label"
                      tone="inverse"
                      className="text-[13px]"
                      numberOfLines={1}
                    >
                      {caseItem.title}
                    </Text>
                    <Text
                      variant="caption"
                      tone="muted"
                      className="text-app-text-muted text-[11px]"
                    >
                      {caseItem.insurance_claim?.insurer ?? "Sigorta"} · Poliçe{" "}
                      {caseItem.insurance_claim?.policy_number ?? ""}
                    </Text>
                  </View>
                  <TrustBadge
                    label={caseItem.insurance_claim?.status ?? "drafted"}
                    tone="info"
                  />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Empty state */}
        {filtered.length === 0 ? (
          <View className="items-center gap-3 rounded-[20px] border border-dashed border-app-outline bg-app-surface px-4 py-10">
            <Text variant="label" tone="inverse">
              {deferredQuery
                ? `"${deferredQuery.trim()}" için eşleşme yok`
                : "Bu filtrede iş yok"}
            </Text>
            <Text tone="muted" className="text-center text-app-text-muted">
              Farklı bir filtre veya arama deneyebilirsin.
            </Text>
          </View>
        ) : null}

        {/* Sections */}
        {sectionOrder.map((section) => {
          const items = grouped[section] ?? [];
          if (!items.length) return null;

          return (
            <View key={section} className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text variant="h3" tone="inverse" className="text-[15px]">
                  {section}
                </Text>
                <Text variant="caption" tone="subtle">
                  {items.length} iş
                </Text>
              </View>
              <View className="gap-3">
                {items.map((item) => {
                  const caseRef = cases.find((c) => c.id === item.caseId);
                  if (!caseRef) return null;
                  return (
                    <JobRecordCard
                      key={item.caseId}
                      caseItem={caseRef}
                      view={item}
                      onPress={() => router.push(`/is/${item.caseId}` as Href)}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}

        {activeAndArchive.archive.length > 0 ? (
          <View className="gap-3 pt-2">
            {/* Completed filter aktifse chip zaten işaret ediyor — başlık küçülüyor */}
            {!isCompletedFilter ? (
              <View className="flex-row items-center justify-between">
                <Text variant="h3" tone="inverse" className="text-[15px]">
                  Tamamlananlar
                </Text>
                <Text variant="caption" tone="subtle">
                  {activeAndArchive.archive.length} vaka
                </Text>
              </View>
            ) : null}
            <View className="gap-2">
              {activeAndArchive.archive.map((caseItem) => (
                <Pressable
                  key={caseItem.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${caseItem.title} vaka profilini aç`}
                  onPress={() => router.push(`/vaka/${caseItem.id}` as Href)}
                  className="flex-row items-start gap-3 rounded-[18px] border border-app-outline bg-app-surface px-4 py-3 active:bg-app-surface-2"
                >
                  <View className="flex-1 gap-1">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <TrustBadge
                        label={
                          caseItem.status === "archived"
                            ? "Arşiv"
                            : "Tamamlandı"
                        }
                        tone="success"
                      />
                      <Text
                        variant="caption"
                        tone="muted"
                        className="text-app-text-subtle text-[11px]"
                      >
                        {caseItem.updated_at_label}
                      </Text>
                    </View>
                    <Text
                      variant="label"
                      tone="inverse"
                      className="text-[13px] leading-[17px]"
                      numberOfLines={2}
                    >
                      {caseItem.title}
                    </Text>
                    <Text
                      variant="caption"
                      tone="muted"
                      className="text-app-text-muted text-[11px]"
                      numberOfLines={1}
                    >
                      {caseItem.subtitle}
                      {caseItem.total_label ? ` · ${caseItem.total_label}` : ""}
                    </Text>
                  </View>
                  <ArrowRight size={14} color={colors.textSubtle} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
