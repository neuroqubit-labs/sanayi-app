import { StatusChip, type StatusChipTone } from "../StatusChip";

/**
 * 14-state machine — backend enums.md canonical. PaymentStatusBadge
 * (11 değer) deprecate; yeni tüketiciler BillingStateBadge kullanmalı.
 */
export type BillingStateValue =
  | "estimate"
  | "preauth_requested"
  | "preauth_held"
  | "preauth_failed"
  | "additional_hold_requested"
  | "additional_held"
  | "captured"
  | "kasko_pending"
  | "kasko_reimbursed"
  | "kasko_rejected"
  | "partial_refunded"
  | "full_refunded"
  | "settled"
  | "cancelled";

export type BillingStateBadgeProps = {
  state: BillingStateValue;
};

const STATE_META: Record<
  BillingStateValue,
  { label: string; tone: StatusChipTone }
> = {
  estimate: { label: "Tahmin edildi", tone: "neutral" },
  preauth_requested: { label: "Ödeme başlatıldı", tone: "neutral" },
  preauth_held: { label: "Ön yetki tutuluyor", tone: "info" },
  preauth_failed: { label: "Ön yetki başarısız", tone: "critical" },
  additional_hold_requested: { label: "Ek tutar isteniyor", tone: "warning" },
  additional_held: { label: "Ek tutar tutuldu", tone: "info" },
  captured: { label: "Tahsil edildi", tone: "success" },
  kasko_pending: { label: "Kasko bekleniyor", tone: "warning" },
  kasko_reimbursed: { label: "Kasko iade edildi", tone: "success" },
  kasko_rejected: { label: "Kasko reddedildi", tone: "critical" },
  partial_refunded: { label: "Kısmi iade", tone: "info" },
  full_refunded: { label: "Tam iade", tone: "info" },
  settled: { label: "Tamamlandı", tone: "success" },
  cancelled: { label: "İptal edildi", tone: "neutral" },
};

export function BillingStateBadge({ state }: BillingStateBadgeProps) {
  const meta = STATE_META[state];
  return <StatusChip label={meta.label} tone={meta.tone} />;
}
