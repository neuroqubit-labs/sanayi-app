import { AlertTriangle } from "lucide-react-native";
import { View } from "react-native";

import { Icon } from "../Icon";
import { Text } from "../Text";

import { MoneyAmount } from "./MoneyAmount";

export type FeeWarningCardProps = {
  title: string;
  amount: number;
  currency?: string;
  /** Ek açıklama (örn "Kartından bu tutar çekilecek, kalan hold iptal edilir"). */
  description?: string;
  tone?: "warning" | "critical";
};

export function FeeWarningCard({
  title,
  amount,
  currency = "TRY",
  description,
  tone = "warning",
}: FeeWarningCardProps) {
  const colorToken = tone === "critical" ? "#ff6b6b" : "#f5b33f";
  const borderClass =
    tone === "critical"
      ? "border-app-critical/40 bg-app-critical-soft"
      : "border-app-warning/40 bg-app-warning-soft";

  return (
    <View
      className={[
        "gap-2 rounded-[20px] border px-4 py-3.5",
        borderClass,
      ].join(" ")}
    >
      <View className="flex-row items-center gap-2">
        <Icon icon={AlertTriangle} size={14} color={colorToken} />
        <Text variant="eyebrow" tone={tone === "critical" ? "critical" : "warning"}>
          {title}
        </Text>
      </View>
      <MoneyAmount
        amount={amount}
        currency={currency}
        variant="h2"
        tone={tone === "critical" ? "critical" : "warning"}
      />
      {description ? (
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[12px] leading-[16px]"
        >
          {description}
        </Text>
      ) : null}
    </View>
  );
}
