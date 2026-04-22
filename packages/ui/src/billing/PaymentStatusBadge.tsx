import { StatusChip, type StatusChipTone } from "../StatusChip";

export type PaymentStatusValue =
  | "preauth_requested"
  | "preauth_held"
  | "additional_hold_requested"
  | "captured"
  | "partial_refunded"
  | "full_refunded"
  | "kasko_pending"
  | "kasko_reimbursed"
  | "settled"
  | "cancelled"
  | "failed";

export type PaymentStatusBadgeProps = {
  status: PaymentStatusValue;
};

const STATUS_META: Record<
  PaymentStatusValue,
  { label: string; tone: StatusChipTone }
> = {
  preauth_requested: { label: "Ödeme başlatıldı", tone: "neutral" },
  preauth_held: { label: "Ön yetki tutuluyor", tone: "info" },
  additional_hold_requested: { label: "Ek tutar isteniyor", tone: "warning" },
  captured: { label: "Tahsil edildi", tone: "success" },
  partial_refunded: { label: "Kısmi iade", tone: "info" },
  full_refunded: { label: "Tam iade", tone: "info" },
  kasko_pending: { label: "Kasko bekleniyor", tone: "warning" },
  kasko_reimbursed: { label: "Kasko iade edildi", tone: "success" },
  settled: { label: "Tamamlandı", tone: "success" },
  cancelled: { label: "İptal edildi", tone: "neutral" },
  failed: { label: "Başarısız", tone: "critical" },
};

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  const meta = STATUS_META[status];
  return <StatusChip label={meta.label} tone={meta.tone} />;
}
