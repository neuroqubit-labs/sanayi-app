import { View } from "react-native";
import { Sparkles, TrendingDown, TrendingUp } from "lucide-react-native";

import { Icon } from "./Icon";
import { Text } from "./Text";

export type QuoteComparatorProps = {
  offerAmount: number;
  offerLabel: string;
  aiEstimateAmount: number;
  aiEstimateLabel: string;
  currencyLabel?: string;
  className?: string;
};

const WITHIN_BAND = 0.08;

type Assessment = {
  tone: "success" | "accent" | "warning";
  headline: string;
  helper: string;
  accentClass: string;
  borderClass: string;
  iconColor: string;
};

function assess(delta: number): Assessment {
  const absDelta = Math.abs(delta);

  if (absDelta <= WITHIN_BAND) {
    return {
      tone: "success",
      headline: "AI tahminiyle uyumlu",
      helper: "Teklif bandın içinde — ek açıklama gerekmiyor.",
      accentClass: "bg-app-success-soft",
      borderClass: "border-app-success/30",
      iconColor: "#2dd28d",
    };
  }

  if (delta < 0) {
    return {
      tone: "accent",
      headline: "Tahminin altında",
      helper: "AI ortalamasının altında — servis bu fiyatı nedenlendirecek.",
      accentClass: "bg-brand-500/15",
      borderClass: "border-brand-500/30",
      iconColor: "#0ea5e9",
    };
  }

  return {
    tone: "warning",
    headline: "Tahminin üstünde",
    helper: "Fark belirgin — servis teklif gerekçesini anlatacak.",
    accentClass: "bg-app-warning-soft",
    borderClass: "border-app-warning/30",
    iconColor: "#f5b33f",
  };
}

export function QuoteComparator({
  offerAmount,
  offerLabel,
  aiEstimateAmount,
  aiEstimateLabel,
  currencyLabel = "TRY",
  className,
}: QuoteComparatorProps) {
  const safeEstimate = aiEstimateAmount > 0 ? aiEstimateAmount : 1;
  const delta = (offerAmount - aiEstimateAmount) / safeEstimate;
  const assessment = assess(delta);
  const deltaPct = Math.round(delta * 100);
  const DeltaIcon = delta >= 0 ? TrendingUp : TrendingDown;

  return (
    <View
      className={[
        "gap-3 rounded-[22px] border bg-app-surface px-4 py-3.5",
        assessment.borderClass,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <View className="flex-row items-center gap-2">
        <View
          className={[
            "h-9 w-9 items-center justify-center rounded-full",
            assessment.accentClass,
          ].join(" ")}
        >
          <Icon icon={Sparkles} size={16} color={assessment.iconColor} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="eyebrow" tone="subtle">
            AI karşılaştırması
          </Text>
          <Text variant="label" tone="inverse">
            {assessment.headline}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Icon icon={DeltaIcon} size={14} color={assessment.iconColor} />
          <Text variant="caption" tone="inverse">
            {deltaPct > 0 ? "+" : ""}
            {deltaPct}%
          </Text>
        </View>
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1 gap-1 rounded-[16px] border border-app-outline bg-app-surface-2 px-3 py-2">
          <Text variant="eyebrow" tone="subtle">
            Teklif
          </Text>
          <Text variant="label" tone="inverse">
            {offerLabel}
          </Text>
        </View>
        <View className="flex-1 gap-1 rounded-[16px] border border-brand-500/20 bg-brand-500/10 px-3 py-2">
          <Text variant="eyebrow" tone="accent">
            AI tahmini
          </Text>
          <Text variant="label" tone="inverse">
            {aiEstimateLabel}
          </Text>
        </View>
      </View>

      <Text variant="caption" tone="muted" className="text-app-text-muted">
        {assessment.helper} Para birimi: {currencyLabel}.
      </Text>
    </View>
  );
}
