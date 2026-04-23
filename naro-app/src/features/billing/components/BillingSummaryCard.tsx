import {
  BillingStateBadge,
  Icon,
  KaskoStatusBadge,
  MoneyAmount,
  Surface,
  Text,
} from "@naro/ui";
import { ChevronRight, ShieldCheck } from "lucide-react-native";
import { ActivityIndicator, Pressable, View } from "react-native";

import { useBillingSummary } from "../api";
import { billingStateGroup } from "../schemas";

export type BillingSummaryCardProps = {
  caseId: string;
  /** Müşteri kasko tracking view'i açar (opsiyonel; varsa CTA görünür). */
  onOpenKaskoTracking?: () => void;
  /**
   * QA Tur 2 P1-1 (2026-04-23): BillingSummary henüz oluşmamışsa
   * (ödeme adımı başlamadan) BE 404 döner. Canonical `CaseDetailResponse.
   * estimate_amount` alanı shipped ise onu minimal "Tahmini" satırı
   * olarak render ederiz.
   */
  estimateFallback?: string | null;
};

/**
 * BillingSummary kartı — BE canonical flat shape (parity audit P0-2).
 * Alanlar: billing_state (14 enum), estimate/preauth/final (Decimal string),
 * approved_parts_total, refunds[], kasko?.
 *
 * Kaldırılanlar (V1 scope dışı, BE canonical'da yok): card_last4 (PAN mask
 * ayrı endpoint), invoice_url PDF, dispute banner (ayrı dispute endpoint'i
 * geldiğinde restore edilir).
 */
export function BillingSummaryCard({
  caseId,
  onOpenKaskoTracking,
  estimateFallback,
}: BillingSummaryCardProps) {
  const summaryQuery = useBillingSummary(caseId);

  if (summaryQuery.isLoading) {
    return (
      <Surface variant="flat" radius="lg" className="gap-2 px-4 py-4">
        <Text variant="eyebrow" tone="subtle">
          Fatura
        </Text>
        <View className="items-center py-3">
          <ActivityIndicator size="small" color="#83a7ff" />
        </View>
      </Surface>
    );
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    // Billing henüz başlamadıysa (ödeme adımı gelmeden) BE 404 döner.
    // Canonical detail `estimate_amount` varsa minimal "Tahmini" kartı.
    const estimate = parseDecimal(estimateFallback ?? null);
    if (estimate === null) return null;
    return (
      <Surface variant="flat" radius="lg" className="gap-2 px-4 py-4">
        <Text variant="eyebrow" tone="subtle">
          Fatura
        </Text>
        <View className="gap-2 rounded-[14px] border border-app-outline bg-app-surface-2 px-3 py-3">
          <AmountRow label="Tahmini" amount={estimate} />
        </View>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-subtle text-[11px] leading-[16px]"
        >
          Ödeme adımı başlayınca kart detaylanır.
        </Text>
      </Surface>
    );
  }

  const data = summaryQuery.data;
  const group = billingStateGroup(data.billing_state);
  const totalRefunded = data.refunds.reduce(
    (acc, r) => acc + (Number.parseFloat(r.amount) || 0),
    0,
  );

  return (
    <Surface variant="raised" radius="lg" className="gap-3 px-4 py-4">
      <View className="flex-row items-center justify-between">
        <Text variant="eyebrow" tone="subtle">
          Fatura
        </Text>
        <BillingStateBadge state={data.billing_state} />
      </View>

      <View className="gap-2 rounded-[14px] border border-app-outline bg-app-surface-2 px-3 py-3">
        <AmountRow label="Tahmini" amount={parseDecimal(data.estimate_amount)} />
        {data.preauth_amount &&
        data.preauth_amount !== data.estimate_amount ? (
          <AmountRow
            label="Tutulan (pre-auth)"
            amount={parseDecimal(data.preauth_amount)}
          />
        ) : null}
        {data.approved_parts_total !== "0.00" ? (
          <AmountRow
            label="Onaylı parça eklendi"
            amount={parseDecimal(data.approved_parts_total)}
            tone="accent"
          />
        ) : null}
        {totalRefunded > 0 ? (
          <AmountRow
            label={`İade edildi${data.refunds.length > 1 ? ` (${data.refunds.length})` : ""}`}
            amount={-totalRefunded}
            tone="accent"
          />
        ) : null}
        {data.final_amount !== null &&
        (group === "captured" || group === "done") ? (
          <>
            <View className="h-px bg-app-outline my-1" />
            <AmountRow
              label="Nihai"
              amount={parseDecimal(data.final_amount)}
              tone="success"
              emphasis
            />
          </>
        ) : null}
      </View>

      {group === "held" ? (
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[11px] leading-[16px]"
        >
          İşlem bittiğinde nihai tutar kartından tahsil edilir. Fazla tutulan
          otomatik iade olur.
        </Text>
      ) : null}

      {group === "failed" ? (
        <Text
          variant="caption"
          tone="warning"
          className="text-[11px] leading-[16px]"
        >
          Ön yetki başarısız oldu. Farklı bir kart ile ödemeyi yeniden başlat.
        </Text>
      ) : null}

      {data.kasko ? (
        <View className="gap-2 rounded-[12px] border border-app-outline bg-app-surface-2 px-3 py-2.5">
          <View className="flex-row items-center gap-2">
            <Icon icon={ShieldCheck} size={12} color="#2dd28d" />
            <Text variant="eyebrow" tone="subtle" className="text-[10px]">
              Kasko süreci
            </Text>
            <View className="flex-1" />
            <KaskoStatusBadge status={data.kasko.state} />
          </View>
          {data.kasko.reimbursement_amount !== null ? (
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[11px]"
            >
              Sigorta iadesi:{" "}
              <MoneyAmount
                amount={parseDecimal(data.kasko.reimbursement_amount)}
                variant="label"
                tone="success"
                compact
              />
            </Text>
          ) : null}
          {onOpenKaskoTracking ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kasko tracking'i aç"
              onPress={onOpenKaskoTracking}
              className="flex-row items-center justify-between gap-2 rounded-[10px] border border-app-outline bg-app-surface px-3 py-2 active:bg-app-surface-2"
            >
              <Text variant="label" tone="inverse" className="text-[12px]">
                Kasko takibini aç
              </Text>
              <Icon icon={ChevronRight} size={13} color="#83a7ff" />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Surface>
  );
}

function parseDecimal(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function AmountRow({
  label,
  amount,
  tone = "inverse",
  emphasis = false,
}: {
  label: string;
  amount: number | null;
  tone?: "inverse" | "accent" | "success" | "warning";
  emphasis?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text
        variant="caption"
        tone="muted"
        className="text-app-text-muted text-[12px]"
      >
        {label}
      </Text>
      <MoneyAmount
        amount={amount}
        variant={emphasis ? "h3" : "label"}
        tone={tone}
        compact={!emphasis}
      />
    </View>
  );
}
