import { Icon, Text } from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import {
  BarChart3,
  ChevronRight,
  MessageSquare,
  Sparkles,
  Truck,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, View } from "react-native";

import { useShellConfig } from "@/features/shell";

import { MONTHLY_STATS } from "../../technicians/data/fixtures";

type HubTile = {
  id: string;
  label: string;
  subtitle: string;
  metric: string;
  icon: LucideIcon;
  color: string;
  route: Href;
  visible: boolean;
};

export function ProfileManagementHub() {
  const router = useRouter();
  const shellConfig = useShellConfig();

  const hasCampaigns = shellConfig.enabled_capabilities.includes("campaigns");
  const hasMobileService = shellConfig.enabled_capabilities.includes(
    "on_site_repair",
  );

  const tiles: HubTile[] = [
    {
      id: "campaigns",
      label: "Kampanyalarım",
      subtitle: "Yayındaki indirimler",
      metric: "3 aktif",
      icon: Sparkles,
      color: "#f5b33f",
      route: "/(modal)/kampanyalarim" as Href,
      visible: hasCampaigns,
    },
    {
      id: "mobile",
      label: "Mobil servis hattı",
      subtitle: "Yerinde + vale taleplerim",
      metric: "Açık",
      icon: Truck,
      color: "#2dd28d",
      route: "/(tabs)/islerim" as Href,
      visible: hasMobileService,
    },
    {
      id: "revenue",
      label: "Gelir özeti",
      subtitle: "Aylık kazanç + tahsilat",
      metric: "Bu ay",
      icon: BarChart3,
      color: "#83a7ff",
      route: "/(modal)/gelir-ozeti" as Href,
      visible: true,
    },
    {
      id: "reviews",
      label: "Müşteri yorumları",
      subtitle: "Son puanlar + teşekkürler",
      metric: `${MONTHLY_STATS.rating_avg.toFixed(1)} · ${MONTHLY_STATS.review_count}`,
      icon: MessageSquare,
      color: "#0ea5e9",
      route: "/(modal)/yorumlar" as Href,
      visible: true,
    },
  ];

  const visibleTiles = tiles.filter((t) => t.visible);
  if (visibleTiles.length === 0) return null;

  const rows: HubTile[][] = [];
  for (let i = 0; i < visibleTiles.length; i += 2) {
    rows.push(visibleTiles.slice(i, i + 2));
  }

  return (
    <View className="gap-3 px-4">
      <View className="flex-row items-center justify-between">
        <Text variant="eyebrow" tone="subtle">
          Yönetim merkezi
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-subtle text-[11px]"
        >
          {visibleTiles.length} kısayol
        </Text>
      </View>

      <View className="gap-2">
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} className="flex-row gap-2">
            {row.map((tile) => (
              <HubTileCard
                key={tile.id}
                tile={tile}
                onPress={() => router.push(tile.route)}
              />
            ))}
            {row.length === 1 ? <View className="flex-1" /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function HubTileCard({
  tile,
  onPress,
}: {
  tile: HubTile;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tile.label} · ${tile.metric}`}
      onPress={onPress}
      className="flex-1 gap-2 rounded-[20px] border border-app-outline bg-app-surface px-3.5 py-3.5 active:bg-app-surface-2"
    >
      <View className="flex-row items-center justify-between">
        <View
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: `${tile.color}22` }}
        >
          <Icon icon={tile.icon} size={16} color={tile.color} />
        </View>
        <Icon icon={ChevronRight} size={14} color="#83a7ff" />
      </View>
      <View className="gap-0.5">
        <Text variant="label" tone="inverse" className="text-[13px]">
          {tile.label}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[11px]"
          numberOfLines={1}
        >
          {tile.subtitle}
        </Text>
      </View>
      <Text variant="caption" tone="accent" className="text-[11px]">
        {tile.metric}
      </Text>
    </Pressable>
  );
}
