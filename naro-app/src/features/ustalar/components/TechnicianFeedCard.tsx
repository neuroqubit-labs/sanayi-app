import {
  Avatar,
  Icon,
  PressableCard,
  Text,
  TrustBadge,
} from "@naro/ui";
import { CheckCircle2, MapPin, Star, Wrench } from "lucide-react-native";
import { View } from "react-native";

import { useUstaPreviewStore } from "../preview-store";
import type { TechnicianFeedItem } from "../schemas";

const PROVIDER_TYPE_LABEL: Record<string, string> = {
  usta: "Usta",
  cekici: "Çekici",
  oto_aksesuar: "Oto aksesuar",
  kaporta_boya: "Kaporta & boya",
  lastik: "Lastik",
  oto_elektrik: "Oto elektrik",
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
  const activeType = item.active_provider_type ?? item.provider_type;
  const primaryLabel =
    PROVIDER_TYPE_LABEL[activeType] ?? PROVIDER_TYPE_LABEL.usta ?? "Servis";
  const secondaryLabels = item.secondary_provider_types
    .filter((t) => t !== activeType)
    .map((t) => PROVIDER_TYPE_LABEL[t])
    .filter((label): label is string => Boolean(label));
  const verified = VERIFIED_META[item.verified_level];

  const ratingValue =
    item.rating_bayesian !== null ? item.rating_bayesian.toFixed(1) : null;

  const districtLabel = item.location_summary.primary_district_label;
  const cityLabel = item.location_summary.city_label;
  const radiusKm = item.location_summary.service_radius_km;

  const quickBarParts: string[] = [];
  if (ratingValue) quickBarParts.push(`${ratingValue}★`);
  if (districtLabel) quickBarParts.push(districtLabel);
  if (radiusKm) quickBarParts.push(`${radiusKm} km hizmet`);
  const quickBarLabel = quickBarParts.join(" · ");

  const openPreview = useUstaPreviewStore((state) => state.open);
  const showPreview = () => openPreview(item.id);

  return (
    <PressableCard
      variant="elevated"
      radius="xl"
      className="flex-1 overflow-hidden"
      onPress={showPreview}
      accessibilityLabel={`${item.display_name} önizlemesini aç`}
    >
      <View className="relative h-32 overflow-hidden bg-brand-500/12">
        <View className="absolute -right-6 -top-6 h-40 w-40 rounded-full bg-brand-500/18" />
        <View className="absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-brand-500/10" />
        <View className="absolute left-4 top-4 flex-row items-center gap-2">
          <TrustBadge label={verified.label} tone={verified.tone} />
          {item.accepting_new_jobs ? (
            <TrustBadge label="İş alıyor" tone="success" icon={CheckCircle2} />
          ) : null}
        </View>
        <View className="absolute inset-x-0 bottom-0 translate-y-6 items-center">
          <View className="rounded-full border-2 border-brand-500/60 p-[3px]">
            <Avatar name={item.display_name} size="xl" />
          </View>
        </View>
      </View>

      <View className="flex-1 justify-between gap-4 px-5 pb-5 pt-12">
        <View className="gap-1.5">
          <Text
            variant="h2"
            tone="inverse"
            className="text-center text-[22px] leading-[26px]"
            numberOfLines={1}
          >
            {item.display_name}
          </Text>
          {item.tagline ? (
            <Text
              variant="caption"
              tone="muted"
              className="text-center text-app-text-muted text-[13px] leading-[18px]"
              numberOfLines={3}
            >
              {item.tagline}
            </Text>
          ) : null}
        </View>

        <View className="gap-4">
        <View className="flex-row gap-2">
          <MetricCell
            icon={<Icon icon={Star} size={14} color="#f5b33f" />}
            value={ratingValue ?? "Yeni"}
            label={
              ratingValue
                ? `${item.rating_count} yorum`
                : "İlk işini sen aç"
            }
          />
          <MetricCell
            icon={<Icon icon={MapPin} size={14} color="#83a7ff" />}
            value={districtLabel ?? cityLabel ?? "—"}
            label={cityLabel && districtLabel ? cityLabel : "Konum"}
          />
          <MetricCell
            icon={<Icon icon={Wrench} size={14} color="#2dd28d" />}
            value={
              item.completed_jobs_30d > 0
                ? item.completed_jobs_30d.toString()
                : radiusKm
                  ? `${radiusKm} km`
                  : "—"
            }
            label={
              item.completed_jobs_30d > 0 ? "30g iş" : "Hizmet alanı"
            }
          />
        </View>

        {quickBarLabel ? (
          <View className="items-center rounded-[14px] border border-brand-500/30 bg-brand-500/10 px-3 py-2.5">
            <Text variant="label" tone="accent" className="text-[13px]">
              {quickBarLabel}
            </Text>
          </View>
        ) : null}

        {secondaryLabels.length > 0 || primaryLabel ? (
          <View className="flex-row flex-wrap justify-center gap-2">
            <SpecialtyChip label={primaryLabel} highlighted />
            {secondaryLabels.map((label) => (
              <SpecialtyChip key={label} label={label} />
            ))}
          </View>
        ) : null}
        </View>
      </View>
    </PressableCard>
  );
}

function MetricCell({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View className="flex-1 items-center gap-1 rounded-[14px] border border-app-outline bg-app-surface px-2 py-2.5">
      {icon}
      <Text
        variant="label"
        tone="inverse"
        className="text-[13px] leading-[16px]"
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text
        variant="caption"
        tone="muted"
        className="text-app-text-subtle text-[10px] leading-[13px]"
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function SpecialtyChip({
  label,
  highlighted,
}: {
  label: string;
  highlighted?: boolean;
}) {
  return (
    <View
      className={[
        "rounded-full border px-3 py-1.5",
        highlighted
          ? "border-brand-500/40 bg-brand-500/10"
          : "border-app-outline bg-app-surface-2",
      ].join(" ")}
    >
      <Text
        variant="caption"
        tone={highlighted ? "accent" : "muted"}
        className="text-[11px]"
      >
        {label}
      </Text>
    </View>
  );
}
