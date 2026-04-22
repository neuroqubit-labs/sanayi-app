import { type StyleProp, type TextStyle } from "react-native";

import { Text, type TextTone, type TextVariant } from "../Text";

export type MoneyAmountProps = {
  /** Decimal amount (TL tutarı, 0.00-99999999.99). null → "—". */
  amount: number | null;
  /** Currency code. Default "TRY" → "₺". */
  currency?: string;
  variant?: TextVariant;
  tone?: TextTone;
  className?: string;
  style?: StyleProp<TextStyle>;
  /** `true` → kuruş hariç göster (örn "1.450 ₺"). Default `false` (tam: "1.450,00 ₺"). */
  compact?: boolean;
};

const CURRENCY_SYMBOL: Record<string, string> = {
  TRY: "₺",
  USD: "$",
  EUR: "€",
};

/**
 * Tutar formatlayıcı — tr-TR locale + thousand separator ("1.450,00 ₺").
 * Accessibility: screen reader "bin dört yüz elli lira" okur.
 */
export function MoneyAmount({
  amount,
  currency = "TRY",
  variant,
  tone,
  className,
  style,
  compact = false,
}: MoneyAmountProps) {
  if (amount === null || Number.isNaN(amount)) {
    return (
      <Text variant={variant} tone={tone} className={className} style={style}>
        —
      </Text>
    );
  }

  const symbol = CURRENCY_SYMBOL[currency] ?? currency;
  const formatted = compact
    ? Math.round(amount).toLocaleString("tr-TR")
    : amount.toLocaleString("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

  return (
    <Text
      variant={variant}
      tone={tone}
      className={className}
      style={style}
      accessibilityLabel={buildAccessibilityLabel(amount, currency)}
    >
      {formatted} {symbol}
    </Text>
  );
}

function buildAccessibilityLabel(amount: number, currency: string): string {
  const rounded = Math.round(amount);
  const unit = currency === "TRY" ? "lira" : currency;
  return `${rounded} ${unit}`;
}
