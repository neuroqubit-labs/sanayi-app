import {
  BackButton,
  Button,
  Icon,
  MetricPill,
  Screen,
  SectionHeader,
  Text,
  TrustBadge,
} from "@naro/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Clock, Lock, PackageCheck, ShieldCheck, Users } from "lucide-react-native";
import { View } from "react-native";

import { useJobDetail } from "../api.case-live";

const STATUS_TONE_MAP: Record<
  string,
  "success" | "warning" | "critical" | "neutral" | "accent"
> = {
  pending: "warning",
  shortlisted: "accent",
  accepted: "success",
  rejected: "critical",
  expired: "neutral",
};

const STATUS_LABEL_MAP: Record<string, string> = {
  pending: "Bekliyor",
  shortlisted: "Shortlist",
  accepted: "Kabul edildi",
  rejected: "Elendi",
  expired: "Süresi doldu",
};

export function JobOfferScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: caseItem } = useJobDetail(id ?? "");

  if (!caseItem) {
    return (
      <Screen backgroundClassName="bg-app-bg" className="flex-1 justify-center gap-4">
        <Text variant="h2" tone="inverse">
          Vaka bulunamadı
        </Text>
        <Button label="Geri" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  const myOffer = caseItem.offers.find(
    (offer) =>
      offer.technician_id === caseItem.assigned_technician_id ||
      offer.status === "accepted",
  );
  const competitorOffers = caseItem.offers.filter(
    (offer) => offer.id !== myOffer?.id,
  );
  const competitorMin = competitorOffers.length
    ? Math.min(...competitorOffers.map((o) => o.amount))
    : 0;
  const competitorMax = competitorOffers.length
    ? Math.max(...competitorOffers.map((o) => o.amount))
    : 0;

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-20">
      <View className="flex-row items-center gap-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="subtle">
            Teklifim
          </Text>
          <Text variant="h2" tone="inverse" numberOfLines={1}>
            {caseItem.title}
          </Text>
        </View>
      </View>

      {myOffer ? (
        <View className="gap-3 rounded-[22px] border border-app-success/30 bg-app-success/10 px-4 py-4">
          <View className="flex-row items-center gap-2">
            <Icon icon={Lock} size={14} color="#2dd28d" />
            <Text variant="eyebrow" tone="subtle">
              Senin teklifin
            </Text>
            <View className="ml-auto">
              <TrustBadge
                label={STATUS_LABEL_MAP[myOffer.status] ?? myOffer.status}
                tone={STATUS_TONE_MAP[myOffer.status] ?? "neutral"}
              />
            </View>
          </View>
          <Text variant="display" tone="inverse" className="text-[26px] leading-[30px]">
            {myOffer.price_label}
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted leading-[18px]"
          >
            {myOffer.description}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <View className="flex-row items-center gap-1.5 rounded-full border border-app-outline bg-app-surface px-2.5 py-1">
              <Icon icon={Clock} size={11} color="#83a7ff" />
              <Text variant="caption" tone="muted" className="text-[11px]">
                {myOffer.eta_label}
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5 rounded-full border border-app-outline bg-app-surface px-2.5 py-1">
              <Icon icon={PackageCheck} size={11} color="#83a7ff" />
              <Text variant="caption" tone="muted" className="text-[11px]">
                {myOffer.delivery_mode}
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5 rounded-full border border-app-outline bg-app-surface px-2.5 py-1">
              <Icon icon={ShieldCheck} size={11} color="#2dd28d" />
              <Text variant="caption" tone="muted" className="text-[11px]">
                {myOffer.warranty_label}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View className="rounded-[20px] border border-app-outline bg-app-surface px-4 py-6 items-center gap-2">
          <Text variant="label" tone="inverse">
            Bu vakaya teklif göndermedin
          </Text>
          <Text tone="muted" className="text-center text-app-text-muted">
            Havuzdan bu vakayı açarak yeni bir teklif gönderebilirsin.
          </Text>
        </View>
      )}

      <SectionHeader
        title="Rakip teklifler"
        description={
          competitorOffers.length === 0
            ? "Henüz rakip teklif yok"
            : `${competitorOffers.length} teklif · ₺${competitorMin.toLocaleString("tr-TR")}–₺${competitorMax.toLocaleString("tr-TR")}`
        }
      />

      {competitorOffers.length > 0 ? (
        <View className="flex-row gap-2">
          <MetricPill
            label="Rakip sayısı"
            value={`${competitorOffers.length}`}
          />
          <MetricPill
            label="En düşük"
            value={`₺${competitorMin.toLocaleString("tr-TR")}`}
          />
          <MetricPill
            label="En yüksek"
            value={`₺${competitorMax.toLocaleString("tr-TR")}`}
          />
        </View>
      ) : null}

      <View className="gap-2">
        {competitorOffers.map((offer) => (
          <View
            key={offer.id}
            className="flex-row items-center gap-3 rounded-[16px] border border-app-outline bg-app-surface px-4 py-3"
          >
            <View className="h-9 w-9 items-center justify-center rounded-full bg-app-surface-2">
              <Icon icon={Users} size={14} color="#f5b33f" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="label" tone="inverse" className="text-[13px]">
                {offer.headline}
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[11px]"
              >
                {offer.eta_label} · {offer.delivery_mode}
              </Text>
            </View>
            <Text variant="label" tone="accent" className="text-[13px]">
              {offer.price_label}
            </Text>
          </View>
        ))}
      </View>

      <Text
        variant="caption"
        tone="muted"
        className="text-center text-app-text-subtle text-[11px]"
      >
        Teklif karşılaştırması platformun fiyat disiplinini artırır. Müşteri kararı teklif kabul edildikten sonra randevu talebiyle iletilir.
      </Text>
    </Screen>
  );
}
