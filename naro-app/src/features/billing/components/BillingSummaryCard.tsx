import {
  Icon,
  KaskoStatusBadge,
  MoneyAmount,
  PaymentStatusBadge,
  Surface,
  Text,
} from "@naro/ui";
import {
  AlertTriangle,
  ChevronRight,
  CreditCard,
  Download,
  Gavel,
  ShieldCheck,
} from "lucide-react-native";
import { ActivityIndicator, Pressable, View } from "react-native";

import { useBillingSummary } from "../api";

export type BillingSummaryCardProps = {
  caseId: string;
  /** Müşteri kasko tracking view'i açar (opsiyonel; varsa CTA görünür). */
  onOpenKaskoTracking?: () => void;
  /** PDF faturayı açar (captured state'te aktif). */
  onOpenInvoicePdf?: (url: string) => void;
  /** Dispute detay / admin inceleme için. */
  onOpenDispute?: () => void;
};

export function BillingSummaryCard({
  caseId,
  onOpenKaskoTracking,
  onOpenInvoicePdf,
  onOpenDispute,
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
    // Sessiz kapat — vaka profilinde placeholder kart gösterme.
    return null;
  }

  const data = summaryQuery.data;
  const hasKasko = data.kasko_state !== "not_applicable";
  const isCaptured =
    data.payment_status === "captured" ||
    data.payment_status === "partial_refunded" ||
    data.payment_status === "settled" ||
    data.payment_status === "kasko_reimbursed";

  return (
    <Surface variant="raised" radius="lg" className="gap-3 px-4 py-4">
      <View className="flex-row items-center justify-between">
        <Text variant="eyebrow" tone="subtle">
          Fatura
        </Text>
        <PaymentStatusBadge status={data.payment_status} />
      </View>

      <View className="gap-2 rounded-[14px] border border-app-outline bg-app-surface-2 px-3 py-3">
        <AmountRow
          label="Tahmini"
          amount={data.estimate_amount}
          currency={data.currency}
        />
        {data.preauth_total !== null &&
        data.preauth_total !== data.estimate_amount ? (
          <AmountRow
            label="Tutulan (pre-auth)"
            amount={data.preauth_total}
            currency={data.currency}
          />
        ) : null}
        {data.captured_amount !== null ? (
          <AmountRow
            label="Tahsil edildi"
            amount={data.captured_amount}
            currency={data.currency}
            tone="success"
          />
        ) : null}
        {data.refunded_amount !== null && data.refunded_amount > 0 ? (
          <AmountRow
            label="İade edildi"
            amount={-data.refunded_amount}
            currency={data.currency}
            tone="accent"
          />
        ) : null}
        {data.final_amount !== null ? (
          <>
            <View className="h-px bg-app-outline my-1" />
            <AmountRow
              label="Nihai"
              amount={data.final_amount}
              currency={data.currency}
              emphasis
            />
          </>
        ) : null}
      </View>

      {data.card_last4 ? (
        <View className="flex-row items-center gap-2">
          <Icon icon={CreditCard} size={13} color="#83a7ff" />
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px]"
          >
            Kart •••• {data.card_last4}
          </Text>
        </View>
      ) : null}

      {!isCaptured && data.payment_status === "preauth_held" ? (
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[11px] leading-[16px]"
        >
          İşlem bittiğinde nihai tutar kartından tahsil edilir. Fazla
          tutulan otomatik iade olur.
        </Text>
      ) : null}

      {hasKasko ? (
        <View className="gap-2 rounded-[12px] border border-app-outline bg-app-surface-2 px-3 py-2.5">
          <View className="flex-row items-center gap-2">
            <Icon icon={ShieldCheck} size={12} color="#2dd28d" />
            <Text variant="eyebrow" tone="subtle" className="text-[10px]">
              Kasko süreci
            </Text>
            <View className="flex-1" />
            <KaskoStatusBadge status={data.kasko_state} />
          </View>
          {data.kasko_reimbursement_amount !== null &&
          data.kasko_reimbursement_amount > 0 ? (
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[11px]"
            >
              Sigorta iadesi:{" "}
              <MoneyAmount
                amount={data.kasko_reimbursement_amount}
                currency={data.currency}
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

      {data.dispute ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dispute detayını aç"
          onPress={onOpenDispute}
          disabled={!onOpenDispute}
          className="flex-row items-center gap-2 rounded-[12px] border border-app-warning/40 bg-app-warning-soft px-3 py-2.5 active:opacity-90"
        >
          <Icon icon={AlertTriangle} size={14} color="#f5b33f" />
          <View className="flex-1 gap-0.5">
            <Text variant="label" tone="warning" className="text-[12px]">
              {data.dispute.state === "admin_review"
                ? "İtirazın admin incelemesinde"
                : "İtiraz açık"}
            </Text>
            {data.dispute.resolution_note ? (
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[11px]"
                numberOfLines={2}
              >
                {data.dispute.resolution_note}
              </Text>
            ) : null}
          </View>
          {onOpenDispute ? (
            <Icon icon={Gavel} size={13} color="#f5b33f" />
          ) : null}
        </Pressable>
      ) : null}

      {isCaptured && data.invoice_url && onOpenInvoicePdf ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Faturayı indir"
          onPress={() => onOpenInvoicePdf(data.invoice_url!)}
          className="flex-row items-center justify-center gap-2 rounded-[14px] border border-app-outline bg-app-surface-2 px-4 py-2.5 active:bg-app-surface-3"
        >
          <Icon icon={Download} size={13} color="#83a7ff" />
          <Text variant="label" tone="inverse" className="text-[12px]">
            Faturayı indir (PDF)
          </Text>
        </Pressable>
      ) : null}
    </Surface>
  );
}

function AmountRow({
  label,
  amount,
  currency,
  tone = "inverse",
  emphasis = false,
}: {
  label: string;
  amount: number | null;
  currency: string;
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
        currency={currency}
        variant={emphasis ? "h3" : "label"}
        tone={tone}
        compact={!emphasis}
      />
    </View>
  );
}
