import {
  Avatar,
  Button,
  Icon,
  SectionHeader,
  Text,
  TrustBadge,
} from "@naro/ui";
import { Href, useRouter } from "expo-router";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Quote,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsUp,
  TrendingUp,
  Triangle,
  type LucideIcon,
} from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";

import type { TechnicianMatch } from "@/features/ustalar/types";

import type {
  FeedCommunityPost,
  FeedInsight,
  FeedInsightTone,
  FeedItem,
  FeedTip,
  FeedTipTone,
} from "../feed";
import type { CampaignOffer, NearbyService } from "../types";

import { NearbyServiceCard } from "./NearbyServiceCard";
import { TechnicianSuggestionCard } from "./TechnicianSuggestionCard";


type FeedItemViewProps = {
  item: FeedItem;
};

export function FeedItemView({ item }: FeedItemViewProps) {
  switch (item.kind) {
    case "technician_rail":
      return (
        <FeedTechnicianRail
          title={item.title}
          description={item.description}
          technicians={item.technicians}
        />
      );
    case "service_rail":
      return (
        <FeedServiceRail
          title={item.title}
          description={item.description}
          services={item.services}
        />
      );
    case "campaign_hero":
      return (
        <FeedCampaignHero
          eyebrow={item.eyebrow}
          campaign={item.campaign}
          highlightLabel={item.highlightLabel}
        />
      );
    case "campaign_rail":
      return (
        <FeedCampaignRail
          title={item.title}
          description={item.description}
          campaigns={item.campaigns}
        />
      );
    case "tip":
      return <FeedTipCard tip={item.tip} />;
    case "community":
      return <FeedCommunityCard post={item.post} />;
    case "insight":
      return <FeedInsightCard insight={item.insight} />;
    case "feed_end":
      return <FeedEnd />;
    default:
      return null;
  }
}

type FeedSectionProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  children: ReactNode;
};

function FeedSection({
  title,
  description,
  actionLabel,
  onActionPress,
  children,
}: FeedSectionProps) {
  return (
    <View className="gap-3">
      <SectionHeader
        title={title}
        description={description}
        actionLabel={actionLabel}
        onActionPress={onActionPress}
      />
      {children}
    </View>
  );
}

type FeedTechnicianRailProps = {
  title: string;
  description: string;
  technicians: TechnicianMatch[];
};

function FeedTechnicianRail({
  title,
  description,
  technicians,
}: FeedTechnicianRailProps) {
  const router = useRouter();
  return (
    <FeedSection
      title={title}
      description={description}
      actionLabel="Listeye git"
      onActionPress={() => router.push("/(tabs)/carsi")}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 14 }}
      >
        {technicians.map((technician) => (
          <TechnicianSuggestionCard
            key={technician.id}
            technician={technician}
          />
        ))}
      </ScrollView>
    </FeedSection>
  );
}

type FeedServiceRailProps = {
  title: string;
  description: string;
  services: NearbyService[];
};

function FeedServiceRail({
  title,
  description,
  services,
}: FeedServiceRailProps) {
  const router = useRouter();
  return (
    <FeedSection
      title={title}
      description={description}
      actionLabel="Harita"
      onActionPress={() => router.push("/(tabs)/carsi")}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 14 }}
      >
        {services.map((service) => (
          <View key={service.id} style={{ width: 260 }}>
            <NearbyServiceCard service={service} />
          </View>
        ))}
      </ScrollView>
    </FeedSection>
  );
}

type FeedCampaignHeroProps = {
  eyebrow: string;
  campaign: CampaignOffer;
  highlightLabel: string;
};

const PLATFORM_TRUST_MARKERS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "verified", label: "Doğrulanmış servis", icon: ShieldCheck },
  { id: "guarantee", label: "Fatura + Naro garantisi", icon: CheckCircle2 },
];

function FeedCampaignHero({
  eyebrow,
  campaign,
  highlightLabel,
}: FeedCampaignHeroProps) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${campaign.title} kampanyasını aç`}
      onPress={() => router.push(campaign.route as Href)}
      className="gap-5 overflow-hidden rounded-[28px] border border-brand-500/30 bg-app-surface-2 active:opacity-95"
    >
      <View className="relative h-44 overflow-hidden bg-brand-500/15">
        <View className="absolute -right-6 -top-6 h-44 w-44 rounded-full bg-brand-500/20" />
        <View className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-brand-500/10" />
        <View className="absolute left-5 top-5 flex-row flex-wrap items-center gap-2">
          <TrustBadge label={highlightLabel} tone="accent" icon={Sparkles} />
          <TrustBadge label={campaign.categoryLabel ?? eyebrow} tone="info" />
        </View>
        <View className="absolute inset-x-0 bottom-5 items-center">
          <View className="h-20 w-20 items-center justify-center rounded-[28px] border border-brand-500/40 bg-app-surface-2">
            <Icon icon={Sparkles} size={40} color="#0ea5e9" />
          </View>
        </View>
      </View>

      <View className="gap-4 px-6 pb-6">
        <View className="gap-2">
          <Text variant="display" tone="inverse" className="text-[28px] leading-[32px]">
            {campaign.title}
          </Text>
          <Text tone="muted" className="text-app-text-muted leading-6">
            {campaign.subtitle}
          </Text>
        </View>

        <View className="flex-row items-end justify-between gap-3">
          <View className="gap-1">
            <Text variant="eyebrow" tone="subtle">
              Kampanya fiyatı
            </Text>
            <Text variant="display" tone="success" className="text-[34px] leading-[36px]">
              {campaign.priceLabel}
            </Text>
            {campaign.fineprint ? (
              <Text variant="caption" tone="muted" className="text-app-text-subtle">
                {campaign.fineprint}
              </Text>
            ) : null}
          </View>
          {campaign.deadlineLabel ? (
            <View className="items-end gap-1">
              <Text variant="eyebrow" tone="subtle">
                Süre
              </Text>
              <View className="flex-row items-center gap-1.5 rounded-full border border-app-warning/30 bg-app-warning-soft px-3 py-1.5">
                <Icon icon={Clock} size={12} color="#f5b33f" />
                <Text variant="caption" tone="warning">
                  {campaign.deadlineLabel}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        <View className="gap-2 rounded-[18px] border border-app-outline bg-app-surface px-3 py-3">
          {PLATFORM_TRUST_MARKERS.map((marker) => (
            <View key={marker.id} className="flex-row items-center gap-2">
              <Icon icon={marker.icon} size={16} color="#2dd28d" />
              <Text variant="caption" tone="muted" className="text-app-text-muted">
                {marker.label}
              </Text>
            </View>
          ))}
        </View>

        <Button
          label="Kampanyayı incele"
          fullWidth
          size="lg"
          onPress={() => router.push(campaign.route as Href)}
        />
      </View>
    </Pressable>
  );
}

type FeedCampaignRailProps = {
  title: string;
  description: string;
  campaigns: CampaignOffer[];
};

function FeedCampaignRail({
  title,
  description,
  campaigns,
}: FeedCampaignRailProps) {
  const router = useRouter();
  return (
    <FeedSection title={title} description={description}>
      <View className="gap-4">
        {campaigns.map((campaign) => (
          <Pressable
            key={campaign.id}
            accessibilityRole="button"
            accessibilityLabel={`${campaign.title} kampanyasını aç`}
            onPress={() => router.push(campaign.route as Href)}
            className="gap-4 overflow-hidden rounded-[24px] border border-app-outline bg-app-surface active:bg-app-surface-2"
          >
            <View className="relative h-24 overflow-hidden bg-brand-500/10">
              <View className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-brand-500/15" />
              <View className="absolute left-4 top-4">
                <TrustBadge
                  label={campaign.categoryLabel ?? "Kampanya"}
                  tone="info"
                  icon={Sparkles}
                />
              </View>
              <View className="absolute bottom-3 right-4 h-14 w-14 items-center justify-center rounded-full border border-brand-500/40 bg-app-surface-2">
                <Icon icon={Sparkles} size={24} color="#0ea5e9" />
              </View>
            </View>
            <View className="gap-3 px-5 pb-5">
              <View className="gap-1.5">
                <Text variant="h3" tone="inverse">
                  {campaign.title}
                </Text>
                <Text tone="muted" className="text-app-text-muted">
                  {campaign.subtitle}
                </Text>
              </View>
              <View className="flex-row items-end justify-between gap-3">
                <View className="gap-0.5">
                  <Text variant="eyebrow" tone="subtle">
                    Kampanya fiyatı
                  </Text>
                  <Text variant="h2" tone="success">
                    {campaign.priceLabel}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1 rounded-full border border-brand-500/40 bg-brand-500/10 px-3 py-2">
                  <Text variant="label" tone="accent">
                    İncele
                  </Text>
                  <Icon icon={ArrowRight} size={14} color="#0ea5e9" />
                </View>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </FeedSection>
  );
}

const TIP_ICONS: Record<FeedTipTone, LucideIcon> = {
  info: BookOpen,
  warning: Triangle,
  accent: Sparkles,
  success: CheckCircle2,
};

const TIP_BG: Record<FeedTipTone, string> = {
  info: "bg-app-info-soft",
  warning: "bg-app-warning-soft",
  accent: "bg-brand-500/15",
  success: "bg-app-success-soft",
};

const TIP_ICON_COLOR: Record<FeedTipTone, string> = {
  info: "#83a7ff",
  warning: "#f5b33f",
  accent: "#0ea5e9",
  success: "#2dd28d",
};

type FeedTipCardProps = { tip: FeedTip };

function FeedTipCard({ tip }: FeedTipCardProps) {
  const router = useRouter();
  const IconComponent = TIP_ICONS[tip.tone];
  const hasRoute = Boolean(tip.route);
  return (
    <Pressable
      accessibilityRole={hasRoute ? "button" : undefined}
      accessibilityLabel={hasRoute ? `${tip.title} yazısını aç` : undefined}
      onPress={hasRoute ? () => router.push(tip.route as Href) : undefined}
      className="gap-5 overflow-hidden rounded-[24px] border border-app-outline bg-app-surface active:bg-app-surface-2"
    >
      <View
        className={[
          "relative h-36 overflow-hidden",
          TIP_BG[tip.tone],
        ].join(" ")}
      >
        <View
          className={[
            "absolute -right-8 -top-8 h-40 w-40 rounded-full",
            TIP_BG[tip.tone],
          ].join(" ")}
        />
        <View className="absolute left-5 top-5 flex-row items-center gap-2">
          <TrustBadge label={tip.tag} tone="neutral" />
          <View className="flex-row items-center gap-1 rounded-full border border-app-outline bg-app-surface/60 px-2.5 py-1">
            <Icon icon={Clock} size={11} color="#acb7d2" />
            <Text variant="caption" tone="muted" className="text-app-text-muted">
              {tip.readMinutes} dk okuma
            </Text>
          </View>
        </View>
        <View className="absolute inset-x-0 bottom-4 items-center">
          <View className="h-16 w-16 items-center justify-center rounded-[20px] border border-app-outline bg-app-surface-2">
            <Icon icon={IconComponent} size={30} color={TIP_ICON_COLOR[tip.tone]} />
          </View>
        </View>
      </View>

      <View className="gap-4 px-5 pb-5">
        <Text variant="display" tone="inverse" className="text-[24px] leading-[30px]">
          {tip.title}
        </Text>
        <Text tone="muted" className="text-app-text-muted leading-6">
          {tip.subtitle}
        </Text>

        {tip.pullQuote ? (
          <View className="flex-row items-start gap-3 rounded-[18px] border border-app-outline bg-app-surface-2 px-4 py-3">
            <View className="mt-0.5 h-7 w-7 items-center justify-center rounded-full bg-brand-500/15">
              <Icon icon={Quote} size={14} color="#0ea5e9" />
            </View>
            <Text
              variant="caption"
              tone="muted"
              className="flex-1 text-app-text-muted leading-5"
            >
              {tip.pullQuote}
            </Text>
          </View>
        ) : null}

        <View className="flex-row items-center justify-between">
          <Text variant="caption" tone="muted" className="text-app-text-subtle">
            Naro Rehber · {tip.tag}
          </Text>
          {hasRoute ? (
            <View className="flex-row items-center gap-1.5 rounded-full border border-brand-500/40 bg-brand-500/10 px-3.5 py-2">
              <Text variant="label" tone="accent">
                Okumaya başla
              </Text>
              <Icon icon={ArrowRight} size={14} color="#0ea5e9" />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}


type CommunityServiceRowProps = {
  serviceName: string;
  serviceRoute?: string;
  onPress?: () => void;
};

function CommunityServiceRow({
  serviceName,
  serviceRoute,
  onPress,
}: CommunityServiceRowProps) {
  const body = (
    <>
      <View className="h-10 w-10 items-center justify-center rounded-full border border-app-outline bg-app-surface">
        <Icon icon={CheckCircle2} size={18} color="#2dd28d" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="eyebrow" tone="subtle">
          Deneyim yaşanan servis
        </Text>
        <Text variant="label" tone="inverse">
          {serviceName}
        </Text>
      </View>
      {serviceRoute ? <Icon icon={ArrowRight} size={16} color="#83a7ff" /> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${serviceName} profilini aç`}
        onPress={onPress}
        className="flex-row items-center gap-3 rounded-[18px] border border-app-outline bg-app-surface-2 px-4 py-3 active:opacity-90"
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View className="flex-row items-center gap-3 rounded-[18px] border border-app-outline bg-app-surface-2 px-4 py-3">
      {body}
    </View>
  );
}

type FeedCommunityCardProps = { post: FeedCommunityPost };

function FeedCommunityCard({ post }: FeedCommunityCardProps) {
  const router = useRouter();
  const filledStars = Math.round(post.rating);
  return (
    <View className="gap-5 rounded-[24px] border border-app-outline bg-app-surface px-5 py-5">
      <View className="flex-row items-center gap-3">
        <Avatar name={post.author} size="lg" />
        <View className="flex-1 gap-1">
          <Text variant="h3" tone="inverse">
            {post.author}
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            {post.authorTag}
          </Text>
        </View>
        <View className="items-end gap-1">
          <View className="flex-row items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Icon
                key={index}
                icon={Star}
                size={14}
                color={index < filledStars ? "#f5b33f" : "#26344f"}
                strokeWidth={2.5}
              />
            ))}
          </View>
          <Text variant="caption" tone="warning">
            {post.rating.toFixed(1)} · deneyim
          </Text>
        </View>
      </View>

      <View className="flex-row items-start gap-3">
        <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-brand-500/15">
          <Icon icon={Quote} size={16} color="#0ea5e9" />
        </View>
        <Text tone="muted" className="flex-1 text-app-text leading-6">
          {post.body}
        </Text>
      </View>

      {post.serviceName ? (
        <CommunityServiceRow
          serviceName={post.serviceName}
          serviceRoute={post.serviceRoute}
          onPress={
            post.serviceRoute
              ? () => router.push(post.serviceRoute as Href)
              : undefined
          }
        />
      ) : null}

      <View className="flex-row items-center justify-between border-t border-app-outline pt-4">
        <Text variant="caption" tone="muted" className="text-app-text-subtle">
          {post.meta}
        </Text>
        <View className="flex-row items-center gap-1">
          <Icon icon={ThumbsUp} size={13} color="#83a7ff" />
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            {post.upvotes} kişi faydalı buldu
          </Text>
        </View>
      </View>
    </View>
  );
}

const INSIGHT_ACCENTS: Record<FeedInsightTone, {
  bg: string;
  ring: string;
  iconColor: string;
  textTone: "accent" | "success" | "warning";
  icon: LucideIcon;
}> = {
  info: {
    bg: "bg-app-info-soft",
    ring: "border-app-info/30",
    iconColor: "#83a7ff",
    textTone: "accent",
    icon: TrendingUp,
  },
  success: {
    bg: "bg-app-success-soft",
    ring: "border-app-success/30",
    iconColor: "#2dd28d",
    textTone: "success",
    icon: CheckCircle2,
  },
  warning: {
    bg: "bg-app-warning-soft",
    ring: "border-app-warning/30",
    iconColor: "#f5b33f",
    textTone: "warning",
    icon: Triangle,
  },
};

type FeedInsightCardProps = { insight: FeedInsight };

function FeedInsightCard({ insight }: FeedInsightCardProps) {
  const router = useRouter();
  const accent = INSIGHT_ACCENTS[insight.tone];
  const hasRoute = Boolean(insight.route);
  const hasSeries = Array.isArray(insight.series) && insight.series.length > 0;

  return (
    <Pressable
      accessibilityRole={hasRoute ? "button" : undefined}
      onPress={
        hasRoute ? () => router.push(insight.route as Href) : undefined
      }
      className={[
        "gap-5 rounded-[24px] border bg-app-surface-2 px-5 py-5",
        accent.ring,
      ].join(" ")}
    >
      <View className="flex-row items-center gap-3">
        <View
          className={[
            "h-12 w-12 items-center justify-center rounded-[18px]",
            accent.bg,
          ].join(" ")}
        >
          <Icon icon={accent.icon} size={22} color={accent.iconColor} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="eyebrow" tone="subtle">
            Sana özel içgörü
          </Text>
          <Text variant="h3" tone="inverse">
            {insight.title}
          </Text>
        </View>
      </View>

      <Text tone="muted" className="text-app-text-muted leading-6">
        {insight.description}
      </Text>

      <View className="flex-row items-end justify-between gap-4">
        <View className="gap-1">
          <Text
            variant="display"
            tone={accent.textTone}
            className="text-[40px] leading-[42px]"
          >
            {insight.metricValue}
          </Text>
          <Text variant="eyebrow" tone="subtle">
            {insight.metricLabel}
          </Text>
        </View>
        {hasSeries ? (
          <InsightSeriesChart
            series={insight.series as number[]}
            highlightColor={accent.iconColor}
            trackClassName="bg-app-surface-3"
          />
        ) : null}
      </View>

      {hasSeries && insight.seriesLabel ? (
        <View className="flex-row items-center gap-2 rounded-[18px] border border-app-outline bg-app-surface px-4 py-3">
          <Icon icon={TrendingUp} size={16} color={accent.iconColor} />
          <Text variant="caption" tone="muted" className="flex-1 text-app-text-muted">
            {insight.seriesLabel}
          </Text>
        </View>
      ) : null}

      {hasRoute ? (
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="caption" tone="muted" className="flex-1 text-app-text-subtle">
            Detayda aylık dağılım ve karşılaştırma.
          </Text>
          <View className="flex-row items-center gap-1.5 rounded-full border border-brand-500/40 bg-brand-500/10 px-3.5 py-2">
            <Text variant="label" tone="accent">
              Detayı aç
            </Text>
            <Icon icon={ArrowRight} size={14} color="#0ea5e9" />
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

type InsightSeriesChartProps = {
  series: number[];
  highlightColor: string;
  trackClassName: string;
};

function InsightSeriesChart({
  series,
  highlightColor,
  trackClassName,
}: InsightSeriesChartProps) {
  const max = Math.max(...series);
  const lastIndex = series.length - 1;
  return (
    <View className="h-20 flex-1 flex-row items-end justify-end gap-1.5">
      {series.map((value, index) => {
        const isLast = index === lastIndex;
        const heightPct = max > 0 ? Math.max(6, (value / max) * 100) : 0;
        return (
          <View
            key={index}
            style={{
              height: `${heightPct}%`,
              width: 10,
              backgroundColor: isLast ? highlightColor : undefined,
              opacity: isLast ? 0.85 : 1,
            }}
            className={["rounded-full", isLast ? "" : trackClassName]
              .filter(Boolean)
              .join(" ")}
          />
        );
      })}
    </View>
  );
}

function FeedEnd() {
  const router = useRouter();
  return (
    <View className="items-center gap-3 rounded-[24px] border border-dashed border-app-outline bg-app-surface/50 px-5 py-6">
      <Text variant="eyebrow" tone="subtle">
        Akışın sonu
      </Text>
      <Text variant="h3" tone="inverse" className="text-center">
        Şimdilik burası — yeni bir şey açmak ister misin?
      </Text>
      <Text tone="muted" className="text-app-text-muted text-center">
        Aracın için yeni kampanyalar ve ipuçları sürekli güncelleniyor.
      </Text>
      <Button
        label="Yeni talep başlat"
        onPress={() => router.push("/(modal)/quick-actions")}
      />
    </View>
  );
}
