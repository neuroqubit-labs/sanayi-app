import type { ReactNode } from "react";
import { View } from "react-native";
import { Clock, Sparkles, TrendingUp } from "lucide-react-native";

import { Icon } from "./Icon";
import { Text } from "./Text";
import { TrustBadge } from "./TrustBadge";

export type PriceEstimateCardProps = {
  priceLabel: string;
  etaLabel: string;
  eyebrow?: string;
  description?: string;
  confidenceLabel?: string;
  trailing?: ReactNode;
  className?: string;
};

export function PriceEstimateCard({
  priceLabel,
  etaLabel,
  eyebrow = "Tahmini hesap",
  description,
  confidenceLabel,
  trailing,
  className,
}: PriceEstimateCardProps) {
  return (
    <View
      className={[
        "gap-4 rounded-[26px] border border-brand-500/30 bg-brand-500/10 px-4 py-4",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="accent">
            {eyebrow}
          </Text>
          <Text variant="display" tone="inverse" className="text-[30px] leading-[34px]">
            {priceLabel}
          </Text>
        </View>
        {confidenceLabel ? (
          <TrustBadge label={confidenceLabel} tone="accent" />
        ) : null}
      </View>

      <View className="flex-row flex-wrap gap-2">
        <View className="flex-row items-center gap-2 rounded-full border border-app-outline bg-app-surface-2 px-3 py-1.5">
          <Icon icon={Clock} size={14} color="#83a7ff" />
          <Text variant="caption" tone="inverse">
            {etaLabel}
          </Text>
        </View>
        <View className="flex-row items-center gap-2 rounded-full border border-app-outline bg-app-surface-2 px-3 py-1.5">
          <Icon icon={TrendingUp} size={14} color="#2dd28d" />
          <Text variant="caption" tone="inverse">
            Platform ortalaması
          </Text>
        </View>
        <View className="flex-row items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/15 px-3 py-1.5">
          <Icon icon={Sparkles} size={14} color="#0ea5e9" />
          <Text variant="caption" tone="accent">
            AI tahmini
          </Text>
        </View>
      </View>

      {description ? (
        <Text tone="muted" className="text-app-text-muted">
          {description}
        </Text>
      ) : null}

      {trailing}
    </View>
  );
}
