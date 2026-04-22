import {
  Avatar,
  Icon,
  PressableCard,
  StatusChip,
  Text,
  TrustBadge,
} from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import { CheckCircle2, MapPin, Star } from "lucide-react-native";
import { View } from "react-native";

import type { TechnicianFeedItem } from "../schemas";

const PROVIDER_TYPE_LABEL: Record<string, string> = {
  towing: "Çekici",
  motorcycle: "Motor ustası",
  mechanic: "Oto tamirci",
  body: "Kaporta / boya",
  glass: "Cam",
  tire: "Lastik",
  battery: "Akü",
  parts: "Oto parça",
  detailing: "Detailing",
  electrical: "Elektrik",
  diagnostic: "Teşhis",
  specialty: "Uzman servis",
  other: "Servis",
};

const VERIFIED_META: Record<
  "basic" | "verified" | "premium",
  { label: string; tone: "info" | "accent" | "success" }
> = {
  basic: { label: "Yeni", tone: "info" },
  verified: { label: "Doğrulandı", tone: "accent" },
  premium: { label: "Premium", tone: "success" },
};

export type TechnicianFeedCardProps = {
  item: TechnicianFeedItem;
};

export function TechnicianFeedCard({ item }: TechnicianFeedCardProps) {
  const router = useRouter();
  const providerLabel =
    PROVIDER_TYPE_LABEL[item.active_provider_type ?? item.provider_type] ??
    PROVIDER_TYPE_LABEL.other ??
    "Servis";
  const verified = VERIFIED_META[item.verified_level];
  const ratingValue =
    item.rating_bayesian !== null
      ? item.rating_bayesian.toFixed(1)
      : null;
  const locationLabel = [
    item.location_summary.primary_district_label,
    item.location_summary.city_label,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  const openProfile = () => router.push(`/usta/${item.id}` as Href);

  return (
    <PressableCard
      variant="elevated"
      radius="xl"
      className="gap-3 px-4 py-4"
      onPress={openProfile}
      accessibilityLabel={`${item.display_name} profilini aç`}
    >
      <View className="flex-row items-start gap-3">
        <Avatar name={item.display_name} size="lg" />
        <View className="flex-1 gap-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text
              variant="h3"
              tone="inverse"
              className="text-[15px] leading-[19px]"
              numberOfLines={1}
            >
              {item.display_name}
            </Text>
            <TrustBadge label={verified.label} tone={verified.tone} />
          </View>
          {item.tagline ? (
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[12px] leading-[16px]"
              numberOfLines={2}
            >
              {item.tagline}
            </Text>
          ) : null}
          <View className="flex-row flex-wrap items-center gap-1.5 pt-0.5">
            <StatusChip label={providerLabel} tone="info" />
            {item.accepting_new_jobs ? (
              <StatusChip label="İş alıyor" tone="success" icon={CheckCircle2} />
            ) : (
              <StatusChip label="Yoğun" tone="neutral" />
            )}
          </View>
        </View>
      </View>

      <View className="flex-row items-center gap-4 border-t border-app-outline/50 pt-2.5">
        {ratingValue ? (
          <View className="flex-row items-center gap-1.5">
            <Icon icon={Star} size={13} color="#f5b33f" />
            <Text
              variant="label"
              tone="inverse"
              className="text-[13px]"
            >
              {ratingValue}
            </Text>
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-subtle text-[11px]"
            >
              · {item.rating_count} değerlendirme
            </Text>
          </View>
        ) : (
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-subtle text-[11px]"
          >
            Henüz değerlendirme yok
          </Text>
        )}
        {item.completed_jobs_30d > 0 ? (
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[11px]"
          >
            {item.completed_jobs_30d} iş · 30g
          </Text>
        ) : null}
      </View>

      {locationLabel ? (
        <View className="flex-row items-center gap-1.5">
          <Icon icon={MapPin} size={12} color="#83a7ff" />
          <Text
            variant="caption"
            tone="muted"
            className="flex-1 text-app-text-muted text-[11px]"
            numberOfLines={1}
          >
            {locationLabel}
            {item.location_summary.service_radius_km
              ? ` · ${item.location_summary.service_radius_km} km hizmet`
              : ""}
          </Text>
        </View>
      ) : null}
    </PressableCard>
  );
}
