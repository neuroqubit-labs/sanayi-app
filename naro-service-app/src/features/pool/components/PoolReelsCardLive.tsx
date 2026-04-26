import { Avatar, Button, Icon, Text, TrustBadge, useNaroTheme } from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import { MapPin, Tag, Timer } from "lucide-react-native";
import { Pressable, View, type ViewStyle } from "react-native";

import type {
  PoolCaseItem,
  ServiceRequestKind,
  ServiceRequestUrgency,
} from "@/features/jobs/schemas";

import { useOfferSheetStore } from "../offer-sheet-store";

/**
 * Canonical PoolCaseItem (thin feed) render — P1-4 iter 2 consumer
 * migration 2026-04-23. Eski PoolReelsCard (mock ServiceCase shape)
 * paralel kalıyor; launch path bu kartı tüketir.
 *
 * Zengin alanlar (offers[], attachments[], summary zenginliği,
 * on_site_repair, breakdown_category) tıklandığında case detail
 * (PoolCaseDetail endpoint) ile gelir; feed kartında minimal.
 */

const CARD_SHADOW_STYLE: ViewStyle = {
  shadowOffset: { width: 0, height: 20 },
  shadowOpacity: 0.34,
  shadowRadius: 30,
  elevation: 14,
};

const KIND_META: Record<
  ServiceRequestKind,
  { label: string; tone: "critical" | "warning" | "info" | "accent" }
> = {
  accident: { label: "Kaza", tone: "critical" },
  towing: { label: "Çekici", tone: "warning" },
  breakdown: { label: "Arıza", tone: "warning" },
  maintenance: { label: "Bakım", tone: "info" },
};

const URGENCY_META: Record<
  ServiceRequestUrgency,
  { label: string; tone: "neutral" | "warning" | "critical" }
> = {
  planned: { label: "Planlı", tone: "neutral" },
  today: { label: "Bugün", tone: "warning" },
  urgent: { label: "Acil", tone: "critical" },
};

function formatCreatedAt(iso: string): string {
  try {
    const date = new Date(iso);
    const now = Date.now();
    const diffMin = Math.floor((now - date.getTime()) / 60000);
    if (diffMin < 1) return "Az önce";
    if (diffMin < 60) return `${diffMin} dk önce`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} sa önce`;
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

function formatMoney(amountRaw: string | null): string | null {
  if (!amountRaw) return null;
  const parsed = Number.parseFloat(amountRaw);
  if (Number.isNaN(parsed)) return null;
  return `₺${parsed.toLocaleString("tr-TR", {
    maximumFractionDigits: 0,
  })}`;
}

export type PoolReelsCardLiveProps = {
  caseItem: PoolCaseItem;
  cardHeight: number;
};

export function PoolReelsCardLive({
  caseItem,
  cardHeight,
}: PoolReelsCardLiveProps) {
  const router = useRouter();
  const { colors } = useNaroTheme();
  const openOfferSheet = useOfferSheetStore((state) => state.open);
  const kindMeta = KIND_META[caseItem.kind];
  const urgencyMeta = URGENCY_META[caseItem.urgency];
  const kindBackground =
    caseItem.kind === "accident"
      ? colors.criticalSoft
      : caseItem.kind === "maintenance"
        ? colors.infoSoft
        : colors.warningSoft;

  const createdLabel = formatCreatedAt(caseItem.created_at);
  const estimateLabel = formatMoney(caseItem.estimate_amount);
  const canSendOffer = !caseItem.has_offer_from_me;

  const openDetail = () => router.push(`/vaka/${caseItem.id}` as Href);

  const handlePrimary = () => {
    if (!canSendOffer) return;
    openOfferSheet(caseItem.id);
  };

  return (
    <View style={{ height: cardHeight }} className="px-4 pb-3 pt-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${caseItem.title} detayını aç`}
        onPress={openDetail}
        style={[CARD_SHADOW_STYLE, { shadowColor: colors.shadow }]}
        className="flex-1 overflow-hidden rounded-[32px] border border-white/10 bg-app-surface active:opacity-95"
      >
        <View
          className="relative h-40 overflow-hidden border-b border-white/10"
          style={{ backgroundColor: kindBackground }}
        >
          <View className="absolute inset-x-0 top-0 h-px bg-white/20" />
          <View
            className="absolute -right-10 -top-12 h-48 w-48 rounded-full"
            style={{ backgroundColor: colors.surface }}
          />
          <View className="absolute -left-10 bottom-[-24px] h-36 w-36 rounded-full bg-white/5" />

          <View className="absolute left-5 right-5 top-4 flex-row flex-wrap items-center gap-2">
            <TrustBadge label={kindMeta.label} tone={kindMeta.tone} />
            <TrustBadge label={urgencyMeta.label} tone={urgencyMeta.tone} />
            {caseItem.is_notified_to_me ? (
              <TrustBadge label="Size bildirildi" tone="accent" />
            ) : null}
            {caseItem.is_matched_to_me ? (
              <TrustBadge
                label={caseItem.match_badge ?? "Bu vakaya uygun"}
                tone="success"
              />
            ) : null}
          </View>

          <View className="absolute inset-x-0 bottom-3 items-center">
            <Avatar name={caseItem.subtitle || caseItem.title} size="xl" />
          </View>
        </View>

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
            {caseItem.subtitle ? (
              <Text
                variant="caption"
                tone="muted"
                className="text-center text-app-text-muted"
                numberOfLines={1}
              >
                {caseItem.subtitle}
              </Text>
            ) : null}
            {caseItem.match_reason_label ? (
              <Text
                variant="caption"
                tone="accent"
                className="text-center text-[12px]"
                numberOfLines={1}
              >
                {caseItem.match_reason_label}
              </Text>
            ) : null}
          </View>

          <View className="flex-row flex-wrap justify-center gap-2">
            <View className="flex-row items-center gap-1.5 rounded-full border border-app-outline bg-app-surface-2 px-2.5 py-1">
              <Icon icon={Timer} size={11} color={colors.info} />
              <Text variant="caption" tone="muted" className="text-[11px]">
                {createdLabel}
              </Text>
            </View>
            {caseItem.location_label ? (
              <View className="flex-row items-center gap-1.5 rounded-full border border-app-outline bg-app-surface-2 px-2.5 py-1">
                <Icon icon={MapPin} size={11} color={colors.success} />
                <Text variant="caption" tone="muted" className="text-[11px]">
                  {caseItem.location_label}
                </Text>
              </View>
            ) : null}
            {estimateLabel ? (
              <View className="flex-row items-center gap-1.5 rounded-full border border-app-outline bg-app-surface-2 px-2.5 py-1">
                <Icon icon={Tag} size={11} color={colors.warning} />
                <Text variant="caption" tone="muted" className="text-[11px]">
                  Tahmini {estimateLabel}
                </Text>
              </View>
            ) : null}
          </View>

          <View className="mt-auto gap-2 pb-4 pt-2">
            <Button
              label={canSendOffer ? "Teklif ver" : "Teklif verildi"}
              size="lg"
              fullWidth
              disabled={!canSendOffer}
              onPress={handlePrimary}
            />
          </View>
        </View>
      </Pressable>
    </View>
  );
}
