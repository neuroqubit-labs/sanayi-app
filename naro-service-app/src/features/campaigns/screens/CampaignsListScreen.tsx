import {
  BackButton,
  Icon,
  Screen,
  SectionHeader,
  Text,
  ToggleChip,
  TrustBadge,
} from "@naro/ui";
import { useRouter } from "expo-router";
import { Eye, Plus, Tag, Users } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { CAMPAIGN_FIXTURES, type CampaignStatus } from "../data/fixtures";

const FILTERS: { key: "all" | CampaignStatus; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "active", label: "Aktif" },
  { key: "draft", label: "Taslak" },
  { key: "archived", label: "Arşiv" },
];

const STATUS_TONE: Record<CampaignStatus, "success" | "warning" | "neutral"> = {
  active: "success",
  draft: "warning",
  archived: "neutral",
};

const STATUS_LABEL: Record<CampaignStatus, string> = {
  active: "Aktif",
  draft: "Taslak",
  archived: "Arşiv",
};

export function CampaignsListScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | CampaignStatus>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return CAMPAIGN_FIXTURES;
    return CAMPAIGN_FIXTURES.filter((item) => item.status === filter);
  }, [filter]);

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-16">
      <View className="flex-row items-center gap-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="subtle">
            Kampanyalar
          </Text>
          <Text variant="h2" tone="inverse">
            Kampanyalarım
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Yeni kampanya oluştur"
          onPress={() => router.replace("/(modal)/kampanya-olustur")}
          className="h-11 w-11 items-center justify-center rounded-full border border-brand-500 bg-brand-500"
        >
          <Icon icon={Plus} size={18} color="#ffffff" />
        </Pressable>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {FILTERS.map((option) => (
          <ToggleChip
            key={option.key}
            label={option.label}
            selected={filter === option.key}
            size="sm"
            onPress={() => setFilter(option.key)}
          />
        ))}
      </View>

      <SectionHeader
        title={`${filtered.length} kampanya`}
        description="Aktifler havuzda gözükür, taslaklar yalnızca sende."
      />

      <View className="gap-3">
        {filtered.map((item) => (
          <View
            key={item.id}
            className="gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-4"
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1 gap-1">
                <Text variant="label" tone="inverse" className="text-[15px]">
                  {item.title}
                </Text>
                <Text variant="caption" tone="muted" className="text-app-text-muted text-[12px]">
                  {item.subtitle}
                </Text>
              </View>
              <TrustBadge label={STATUS_LABEL[item.status]} tone={STATUS_TONE[item.status]} />
            </View>
            <View className="flex-row items-center gap-3">
              <View className="flex-row items-center gap-1.5">
                <Icon icon={Tag} size={12} color="#2dd28d" />
                <Text variant="label" tone="success" className="text-[14px]">
                  {item.price_label}
                </Text>
              </View>
              <View className="h-3 w-px bg-app-outline" />
              <View className="flex-row items-center gap-1.5">
                <Icon icon={Eye} size={11} color="#83a7ff" />
                <Text variant="caption" tone="muted" className="text-app-text-muted text-[11px]">
                  {item.views} görüntülenme
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Icon icon={Users} size={11} color="#f5b33f" />
                <Text variant="caption" tone="muted" className="text-app-text-muted text-[11px]">
                  {item.requests} talep
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}
