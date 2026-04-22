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
import { ActivityIndicator, View } from "react-native";

import {
  useCaseOffers,
  useRejectOffer,
  useShortlistOffer,
} from "@/features/offers";

import { useCaseSummaryLive } from "../api";
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
  const caseId = id ?? "";

  const caseQuery = useCaseSummaryLive(caseId);
  const offersQuery = useCaseOffers(caseId);
  const offers = useMemo(() => offersQuery.data ?? [], [offersQuery.data]);

  const offerAmounts = useMemo(
    () =>
      offers
        .map((o) => Number.parseFloat(o.amount))
        .filter((n) => !Number.isNaN(n)),
    [offers],
  );
  const aiEstimate = useMemo(
    () => computeAiEstimate(offerAmounts),
    [offerAmounts],
  );

  if (caseQuery.isLoading || offersQuery.isLoading) {
    return (
      <Screen
        backgroundClassName="bg-app-bg"
        className="flex-1 items-center justify-center gap-3"
      >
        <ActivityIndicator color="#83a7ff" />
        <Text tone="muted" variant="caption">
          Teklifler yükleniyor…
        </Text>
      </Screen>
    );
  }

  if (caseQuery.isError || !caseQuery.data) {
    return (
      <Screen
        backgroundClassName="bg-app-bg"
        className="flex-1 justify-center gap-4"
      >
        <Text variant="h2" tone="inverse" className="text-center">
          Vaka yüklenemedi
        </Text>
        <Button
          label="Geri dön"
          variant="outline"
          onPress={() => router.back()}
        />
      </Screen>
    );
  }

  const caseItem = caseQuery.data;
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
            {new Date(caseItem.updated_at).toLocaleDateString("tr-TR")}
          </Text>
        </View>
        <Text tone="muted" className="text-app-text-muted">
          Fiyat, süre ve güvence aynı ritimde. AI tahmini ile teklif
          karşılaştırması her kartta görünür — bandın dışına çıkan teklifler
          neden öyle olduğunu servise sorar.
        </Text>
        <View className="flex-row gap-3">
          <MetricPill value={`${offers.length}`} label="Toplam teklif" />
          <MetricPill value={aiEstimate.label} label="AI tahmini" />
        </View>
      </View>

      {actionsLocked ? (
        <View className="gap-3 rounded-[24px] border border-app-outline bg-app-surface px-4 py-4">
          <Text variant="label" tone="inverse">
            Bu ekran şu an read-only
          </Text>
          <Text tone="muted" className="text-app-text-muted">
            Teklif seçimi bu aşamada kapalı; vaka aktif bir süreçte.
          </Text>
        </View>
      ) : null}

      {offers.length === 0 ? (
        <View className="items-center gap-2 rounded-[20px] border border-app-outline bg-app-surface px-4 py-8">
          <Text variant="label" tone="inverse" className="text-center">
            Henüz teklif yok
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-center text-app-text-muted"
          >
            Eşleşen ustalar teklif gönderince burada görünür.
          </Text>
        </View>
      ) : null}

      <View className="gap-4">
        {offers.map((offer) => (
          <OfferCardRow
            key={offer.id}
            caseId={caseId}
            offer={offer}
            offerAmountNum={Number.parseFloat(offer.amount) || 0}
            aiEstimate={aiEstimate}
            hasAcceptedOffer={hasAcceptedOffer}
            actionsLocked={actionsLocked}
            onSelect={() =>
              router.push(
                `/randevu/${offer.technician_id}?caseId=${caseId}&offerId=${offer.id}` as Href,
              )
            }
          />
        ))}
      </View>
    </Screen>
  );
}

function OfferCardRow({
  caseId,
  offer,
  offerAmountNum,
  aiEstimate,
  hasAcceptedOffer,
  actionsLocked,
  onSelect,
}: {
  caseId: string;
  offer: import("@/features/offers").OfferResponse;
  offerAmountNum: number;
  aiEstimate: { amount: number; label: string };
  hasAcceptedOffer: boolean;
  actionsLocked: boolean;
  onSelect: () => void;
}) {
  const shortlist = useShortlistOffer(offer.id, caseId);
  const reject = useRejectOffer(offer.id, caseId);

  return (
    <View className="gap-3">
      {aiEstimate.amount > 0 ? (
        <QuoteComparator
          offerAmount={offerAmountNum}
          offerLabel={`₺${offerAmountNum.toLocaleString("tr-TR")}`}
          aiEstimateAmount={aiEstimate.amount}
          aiEstimateLabel={aiEstimate.label}
          currencyLabel={offer.currency}
        />
      ) : null}
      <CaseOfferCard
        offer={offer}
        hasAcceptedOffer={hasAcceptedOffer}
        actionsLocked={actionsLocked}
        onSelect={onSelect}
        onShortlist={() => void shortlist.mutateAsync()}
        onReject={() => void reject.mutateAsync()}
      />
    </View>
  );
}
