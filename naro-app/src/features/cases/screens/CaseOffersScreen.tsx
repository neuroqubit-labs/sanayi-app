import {
  BackButton,
  Button,
  MetricPill,
  QuoteComparator,
  Screen,
  Text,
  TrustBadge,
} from "@naro/ui";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";

import {
  useCaseDetail,
  useCaseOffers,
  useCustomerTrackingView,
  useRejectCaseOffer,
  useShortlistCaseOffer,
} from "../api";
import { CaseOfferCard } from "../components/CaseOfferCard";
import { getCaseStatusLabel, getCaseStatusTone } from "../presentation";

function computeAiEstimate(offerAmounts: number[]): {
  amount: number;
  label: string;
} {
  if (offerAmounts.length === 0) {
    return { amount: 0, label: "—" };
  }

  const sorted = [...offerAmounts].sort((a, b) => a - b);
  const trimmed =
    sorted.length >= 3 ? sorted.slice(1, sorted.length - 1) : sorted;
  const median =
    trimmed.length > 0
      ? trimmed.reduce((acc, value) => acc + value, 0) / trimmed.length
      : sorted[0] ?? 0;
  const amount = Math.round(median);

  return {
    amount,
    label: `₺${amount.toLocaleString("tr-TR")}`,
  };
}

export function CaseOffersScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: caseItem } = useCaseDetail(id ?? "");
  const { data: trackingView } = useCustomerTrackingView(id ?? "");
  const { data: offers = [] } = useCaseOffers(id ?? "");
  const shortlistOffer = useShortlistCaseOffer(id ?? "");
  const rejectOffer = useRejectCaseOffer(id ?? "");

  const aiEstimate = useMemo(
    () => computeAiEstimate(offers.map((offer) => offer.amount)),
    [offers],
  );

  if (!caseItem) {
    return (
      <Screen backgroundClassName="bg-app-bg" className="flex-1 justify-center gap-4">
        <Text variant="h2" tone="inverse">
          Vaka bulunamadı
        </Text>
        <Button
          label="Geri dön"
          variant="outline"
          onPress={() => router.back()}
        />
      </Screen>
    );
  }

  const hasAcceptedOffer = offers.some((offer) => offer.status === "accepted");
  const actionsLocked = caseItem.status !== "offers_ready";

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-28">
      <View className="flex-row items-center gap-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="subtle">
            Teklif karşılaştırma
          </Text>
          <Text variant="h2" tone="inverse">
            {caseItem.title}
          </Text>
        </View>
      </View>

      <View className="gap-4 rounded-[28px] border border-app-outline bg-app-surface px-4 py-4">
        <View className="flex-row items-center justify-between gap-3">
          <TrustBadge
            label={getCaseStatusLabel(caseItem.status)}
            tone={getCaseStatusTone(caseItem.status)}
          />
          <Text variant="caption" tone="subtle">
            {caseItem.updated_at_label}
          </Text>
        </View>
        <Text tone="muted" className="text-app-text-muted">
          Fiyat, süre ve güvence aynı ritimde. AI tahmini ile teklif
          karşılaştırması her kartta görünür — bandın dışına çıkan teklifler
          neden öyle olduğunu servise sorar.
        </Text>
        <View className="flex-row gap-3">
          <MetricPill value={`${offers.length}`} label="Toplam teklif" />
          <MetricPill
            value={caseItem.total_label ?? "-"}
            label="Güncel tutar"
          />
          <MetricPill value={aiEstimate.label} label="AI tahmini" />
        </View>
      </View>

      {actionsLocked && trackingView?.primaryTask ? (
        <View className="gap-3 rounded-[24px] border border-app-outline bg-app-surface px-4 py-4">
          <Text variant="label" tone="inverse">
            Bu ekran şu an read-only
          </Text>
          <Text tone="muted" className="text-app-text-muted">
            Teklif seçimi bu aşamada kapalı. Aktif görev seni doğru karar
            noktasına götürür.
          </Text>
          <Button
            label={trackingView.primaryTask.ctaLabel}
            variant="outline"
            fullWidth
            onPress={() => router.push(trackingView.primaryTask?.route as never)}
          />
        </View>
      ) : null}

      <View className="gap-4">
        {offers.map((offer) => (
          <View key={offer.id} className="gap-3">
            {aiEstimate.amount > 0 ? (
              <QuoteComparator
                offerAmount={offer.amount}
                offerLabel={offer.price_label}
                aiEstimateAmount={aiEstimate.amount}
                aiEstimateLabel={aiEstimate.label}
                currencyLabel={offer.currency}
              />
            ) : null}
            <CaseOfferCard
              offer={offer}
              hasAcceptedOffer={hasAcceptedOffer}
              actionsLocked={actionsLocked}
              onSelect={() =>
                router.push(
                  `/randevu/${offer.technician_id}?caseId=${id}&offerId=${offer.id}` as Href,
                )
              }
              onShortlist={() => void shortlistOffer.mutateAsync(offer.id)}
              onReject={() => void rejectOffer.mutateAsync(offer.id)}
            />
          </View>
        ))}
      </View>
    </Screen>
  );
}
