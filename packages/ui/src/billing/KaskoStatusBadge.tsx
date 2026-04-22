import { ShieldCheck } from "lucide-react-native";

import { StatusChip, type StatusChipTone } from "../StatusChip";

/**
 * BE canonical kasko_state enum — `not_applicable` kaldırıldı; kasko null
 * ise caller render etmez (BillingSummary.kasko nullable).
 */
export type KaskoStatusValue =
  | "pending"
  | "submitted"
  | "approved"
  | "rejected"
  | "reimbursed"
  | "partially_reimbursed";

export type KaskoStatusBadgeProps = {
  status: KaskoStatusValue;
};

const STATUS_META: Record<
  KaskoStatusValue,
  { label: string; tone: StatusChipTone }
> = {
  pending: { label: "Kasko bekliyor", tone: "warning" },
  submitted: { label: "Sigortaya iletildi", tone: "info" },
  approved: { label: "Kasko onayladı", tone: "info" },
  rejected: { label: "Kasko reddetti", tone: "critical" },
  reimbursed: { label: "Kasko iade tamam", tone: "success" },
  partially_reimbursed: { label: "Kısmi kasko iade", tone: "info" },
};

export function KaskoStatusBadge({ status }: KaskoStatusBadgeProps) {
  const meta = STATUS_META[status];
  return <StatusChip label={meta.label} tone={meta.tone} icon={ShieldCheck} />;
}
