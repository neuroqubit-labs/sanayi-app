import type { ServiceCase } from "@naro/domain";
import { PRIMARY_TECHNICIAN_ID } from "@naro/mobile-core";
import { Avatar, Button, Icon, Text, TrustBadge } from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import {
  Clock,
  FileText,
  Image as ImageIcon,
  MapPin,
  Music,
  Sparkles,
  Tag,
  Timer,
  Users,
  Video,
} from "lucide-react-native";
import { Pressable, View, type ViewStyle } from "react-native";

import { useOfferSheetStore } from "../offer-sheet-store";

const CARD_SHADOW_STYLE: ViewStyle = {
  shadowColor: "#020617",
  shadowOffset: { width: 0, height: 20 },
  shadowOpacity: 0.34,
  shadowRadius: 30,
  elevation: 14,
};

const KIND_META: Record<
  ServiceCase["kind"],
  { label: string; tone: "critical" | "warning" | "info" | "accent"; accent: string }
> = {
  accident: { label: "Kaza", tone: "critical", accent: "#ff6b6b" },
  towing: { label: "Çekici", tone: "warning", accent: "#f5b33f" },
  breakdown: { label: "Arıza", tone: "warning", accent: "#f5b33f" },
  maintenance: { label: "Bakım", tone: "info", accent: "#83a7ff" },
};

const URGENCY_META: Record<
  "planned" | "today" | "urgent",
  { label: string; tone: "neutral" | "warning" | "critical" }
> = {
  planned: { label: "Planlı", tone: "neutral" },
  today: { label: "Bugün", tone: "warning" },
  urgent: { label: "Acil", tone: "critical" },
};

const PRICE_PREF_LABEL: Record<string, string> = {
  any: "Esnek fiyat",
  nearby: "Yakın tercih",
  cheap: "Uygun fiyat",
  fast: "Hız tercih",
};

const ATTACHMENT_ICON = {
  photo: ImageIcon,
  video: Video,
  audio: Music,
  location: MapPin,
  document: FileText,
  invoice: FileText,
  report: FileText,
} as const;

export type PoolReelsCardProps = {
  caseItem: ServiceCase;
  cardHeight: number;
};

export function PoolReelsCard({ caseItem, cardHeight }: PoolReelsCardProps) {
  const router = useRouter();
  const openOfferSheet = useOfferSheetStore((state) => state.open);
  const kindMeta = KIND_META[caseItem.kind];
  const urgencyKey = (caseItem.request.urgency ?? "planned") as
    | "planned"
    | "today"
    | "urgent";
  const urgencyMeta = URGENCY_META[urgencyKey];
  const pricePref = caseItem.request.price_preference ?? null;

  const myOffer = caseItem.offers.find(
    (offer) => offer.technician_id === PRIMARY_TECHNICIAN_ID,
  );
  const hasMyOffer = Boolean(myOffer);

  const competitorOffers = caseItem.offers.filter(
    (offer) => offer.technician_id !== PRIMARY_TECHNICIAN_ID,
  );
  const competitorCount = competitorOffers.length;
  const competitorMin = Math.min(...competitorOffers.map((o) => o.amount));
  const competitorMax = Math.max(...competitorOffers.map((o) => o.amount));

  const openDetail = () =>
    router.push(`/vaka/${caseItem.id}` as Href);

  const handlePrimary = () => {
    if (hasMyOffer) {
      router.push("/(tabs)/islerim" as Href);
      return;
    }
    openOfferSheet(caseItem.id);
  };

  return (
    <View style={{ height: cardHeight }} className="px-4 pb-3 pt-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${caseItem.title} detayını aç`}
        onPress={openDetail}
        style={CARD_SHADOW_STYLE}
        className="flex-1 overflow-hidden rounded-[32px] border border-white/10 bg-app-surface active:opacity-95"
      >
        {/* Hero band */}
        <View
          className="relative h-40 overflow-hidden border-b border-white/10"
          style={{ backgroundColor: `${kindMeta.accent}15` }}
        >
          <View className="absolute inset-x-0 top-0 h-px bg-white/20" />
          <View
            className="absolute -right-10 -top-12 h-48 w-48 rounded-full"
            style={{ backgroundColor: `${kindMeta.accent}25` }}
          />
          <View className="absolute -left-10 bottom-[-24px] h-36 w-36 rounded-full bg-white/5" />

          <View className="absolute left-5 right-20 top-4 flex-row flex-wrap items-center gap-2">
            <TrustBadge
              label={kindMeta.label}
              tone={kindMeta.tone}
              icon={caseItem.kind === "accident" ? Sparkles : undefined}
            />
            <TrustBadge label={urgencyMeta.label} tone={urgencyMeta.tone} />
          </View>

          <View className="absolute right-4 top-4 flex-row items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1">
            <Icon icon={MapPin} size={11} color="#f5f7ff" />
            <Text
              variant="caption"
              tone="inverse"
              className="text-[11px]"
            >
              ~ km
            </Text>
          </View>

          <View className="absolute inset-x-0 bottom-3 items-center">
            <Avatar name={caseItem.subtitle || caseItem.title} size="xl" />
          </View>
        </View>

        {/* Body */}
        <View className="flex-1 gap-3 px-5 pt-4">
          <View className="items-center gap-1">
            <Text
              variant="display"
              tone="inverse"
              className="text-center text-[22px] leading-[26px]"
              numberOfLines={2}
            >
              {caseItem.title}
            </Text>
            <Text
              variant="caption"
              tone="muted"
              className="text-center text-app-text-muted"
              numberOfLines={1}
            >
              {caseItem.subtitle}
            </Text>
          </View>

          {caseItem.summary ? (
            <Text
              tone="muted"
              className="text-center text-app-text-muted leading-[20px]"
              numberOfLines={3}
            >
              {caseItem.summary}
            </Text>
          ) : null}

          <View className="flex-row flex-wrap justify-center gap-2">
            <View className="flex-row items-center gap-1.5 rounded-full border border-app-outline bg-app-surface-2 px-2.5 py-1">
              <Icon icon={Timer} size={11} color="#83a7ff" />
              <Text variant="caption" tone="muted" className="text-[11px]">
                {caseItem.created_at_label}
              </Text>
            </View>
            {pricePref ? (
              <View className="flex-row items-center gap-1.5 rounded-full border border-app-outline bg-app-surface-2 px-2.5 py-1">
                <Icon icon={Tag} size={11} color="#2dd28d" />
                <Text variant="caption" tone="muted" className="text-[11px]">
                  {PRICE_PREF_LABEL[pricePref] ?? pricePref}
                </Text>
              </View>
            ) : null}
            {caseItem.request.on_site_repair ? (
              <View className="flex-row items-center gap-1.5 rounded-full border border-app-outline bg-app-surface-2 px-2.5 py-1">
                <Icon icon={MapPin} size={11} color="#f5b33f" />
                <Text variant="caption" tone="muted" className="text-[11px]">
                  Yerinde onarım tercih
                </Text>
              </View>
            ) : null}
          </View>

          {caseItem.attachments.length > 0 ? (
            <View className="flex-row justify-center gap-2">
              {caseItem.attachments.slice(0, 4).map((attachment) => {
                const IconCmp = ATTACHMENT_ICON[attachment.kind] ?? FileText;
                return (
                  <View
                    key={attachment.id}
                    className="h-14 w-14 items-center justify-center rounded-[14px] border border-app-outline bg-app-surface-2"
                  >
                    <Icon icon={IconCmp} size={18} color="#83a7ff" />
                  </View>
                );
              })}
              {caseItem.attachments.length > 4 ? (
                <View className="h-14 w-14 items-center justify-center rounded-[14px] border border-app-outline bg-app-surface-2">
                  <Text variant="caption" tone="muted" className="text-[11px]">
                    +{caseItem.attachments.length - 4}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {competitorCount > 0 ? (
            <View className="flex-row items-center justify-center gap-2 rounded-[16px] border border-app-outline bg-app-surface-2 px-3 py-2.5">
              <Icon icon={Users} size={13} color="#f5b33f" />
              <Text variant="caption" tone="warning" className="text-[12px]">
                {competitorCount} rakip teklif
              </Text>
              {Number.isFinite(competitorMin) && Number.isFinite(competitorMax) ? (
                <>
                  <View className="h-3 w-px bg-app-outline" />
                  <Text
                    variant="caption"
                    tone="muted"
                    className="text-app-text-muted text-[12px]"
                  >
                    ₺{competitorMin.toLocaleString("tr-TR")}–₺
                    {competitorMax.toLocaleString("tr-TR")}
                  </Text>
                </>
              ) : null}
            </View>
          ) : null}

          <View className="flex-1" />

          <View className="flex-row items-center justify-center gap-1.5">
            <Icon icon={Clock} size={11} color="#6b7280" />
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-subtle text-[11px]"
            >
              Güncellendi {caseItem.updated_at_label}
            </Text>
          </View>
        </View>

        {/* Footer CTA */}
        <View className="gap-2 border-t border-app-outline bg-app-surface px-5 py-4">
          <Button
            label={hasMyOffer ? "Teklif gönderildi · Kayıtlara git" : "Teklif Gönder"}
            variant={hasMyOffer ? "outline" : "primary"}
            size="lg"
            fullWidth
            onPress={(event) => {
              event.stopPropagation();
              handlePrimary();
            }}
          />
          <Text
            variant="caption"
            tone="muted"
            className="text-center text-app-text-subtle text-[11px]"
          >
            Karta dokun · tam detay ve rakip tekliflerini incele
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
