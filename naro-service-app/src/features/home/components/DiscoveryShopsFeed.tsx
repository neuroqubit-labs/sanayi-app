import { Avatar, Icon, StatusChip, Text } from "@naro/ui";
import { Clock, MapPin, Star, TrendingUp } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { DISCOVERY_SHOPS, type DiscoveryShop } from "../data/discoveryShops";

const INITIAL_LIMIT = 4;
const BATCH = 4;

const PULSE_META: Record<
  NonNullable<DiscoveryShop["pulse_signal"]>,
  { label: string; tone: "accent" | "success" | "warning" | "info" }
> = {
  busy_today: { label: "Bugün yoğun", tone: "warning" },
  accepting_new: { label: "Yeni iş alıyor", tone: "success" },
  high_rated: { label: "Yüksek puan", tone: "accent" },
  new_on_naro: { label: "Naro'da yeni", tone: "info" },
};

const PROVIDER_LABEL: Record<string, string> = {
  usta: "Genel Usta",
  cekici: "Çekici",
  kaporta_boya: "Kaporta/Boya",
  lastik: "Lastik",
  oto_elektrik: "Oto Elektrik",
  oto_aksesuar: "Aksesuar",
};

export function DiscoveryShopsFeed() {
  const [limit, setLimit] = useState(INITIAL_LIMIT);

  const visibleShops = useMemo(
    () => DISCOVERY_SHOPS.slice(0, limit),
    [limit],
  );
  const canLoadMore = limit < DISCOVERY_SHOPS.length;

  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text variant="h3" tone="inverse">
          Çevrendeki atölyeler
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[12px]"
        >
          Bölgendeki aktif servis ve ustalar. Nabız canlı.
        </Text>
      </View>

      <View className="gap-3">
        {visibleShops.map((shop) => (
          <DiscoveryShopCard key={shop.id} shop={shop} />
        ))}
      </View>

      {canLoadMore ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Daha fazla atölye yükle"
          onPress={() => setLimit((prev) => prev + BATCH)}
          className="items-center justify-center rounded-[18px] border border-app-outline bg-app-surface px-4 py-3 active:bg-app-surface-2"
        >
          <Text variant="label" tone="accent" className="text-[13px]">
            Daha fazla göster
          </Text>
        </Pressable>
      ) : (
        <View className="items-center py-2">
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-subtle text-[11px]"
          >
            Listenin sonuna geldin.
          </Text>
        </View>
      )}
    </View>
  );
}

function DiscoveryShopCard({ shop }: { shop: DiscoveryShop }) {
  const pulseMeta = shop.pulse_signal ? PULSE_META[shop.pulse_signal] : null;
  const providerLabel =
    PROVIDER_LABEL[shop.provider_type] ?? shop.provider_type;

  return (
    <View
      className="overflow-hidden rounded-[24px] border border-app-outline bg-app-surface"
      style={{ minHeight: 280 }}
    >
      <View
        className="h-[110px] w-full"
        style={{ backgroundColor: `${shop.hero_image_color}33` }}
      >
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          {shop.is_premium_partner ? (
            <StatusChip label="Premium partner" tone="accent" />
          ) : (
            <View />
          )}
          {pulseMeta ? (
            <StatusChip label={pulseMeta.label} tone={pulseMeta.tone} />
          ) : null}
        </View>
      </View>

      <View className="flex-row items-start gap-3 px-4 -mt-6">
        <Avatar name={shop.business_name} size="lg" />
        <View className="flex-1 gap-1 pt-6">
          <Text
            variant="h3"
            tone="inverse"
            className="text-[16px] leading-[20px]"
          >
            {shop.business_name}
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px] leading-[16px]"
            numberOfLines={2}
          >
            {shop.tagline}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2 px-4 pt-3">
        <Icon icon={MapPin} size={11} color="#83a7ff" />
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-subtle text-[11px]"
        >
          {shop.city_district} · {providerLabel}
        </Text>
      </View>

      <View className="flex-row items-stretch gap-2 px-4 pt-4">
        <Metric
          value={shop.rating.toFixed(2)}
          label={`${shop.rating_count} puan`}
          icon={Star}
          color="#f5b33f"
        />
        <Metric
          value={`${shop.completed_jobs_last_30d}`}
          label="Son 30 gün"
          icon={TrendingUp}
          color="#2dd28d"
        />
        <Metric
          value={`${shop.response_time_minutes}dk`}
          label="Yanıt"
          icon={Clock}
          color="#83a7ff"
        />
      </View>

      <View className="flex-row flex-wrap gap-1.5 px-4 pb-5 pt-4">
        {shop.specialties.slice(0, 3).map((specialty) => (
          <View
            key={specialty}
            className="rounded-full border border-app-outline bg-app-surface-2 px-2.5 py-1"
          >
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text text-[11px]"
            >
              {specialty}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Metric({
  value,
  label,
  icon,
  color,
}: {
  value: string;
  label: string;
  icon: typeof Star;
  color: string;
}) {
  return (
    <View className="flex-1 gap-0.5 rounded-[14px] border border-app-outline bg-app-surface-2 px-3 py-2">
      <View className="flex-row items-center gap-1">
        <Icon icon={icon} size={11} color={color} />
        <Text variant="label" tone="inverse" className="text-[13px]">
          {value}
        </Text>
      </View>
      <Text
        variant="caption"
        tone="muted"
        className="text-app-text-subtle text-[10px]"
      >
        {label}
      </Text>
    </View>
  );
}
