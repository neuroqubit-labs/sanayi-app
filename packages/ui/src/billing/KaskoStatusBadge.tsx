import { ShieldCheck } from "lucide-react-native";

import { StatusChip, type StatusChipTone } from "../StatusChip";

export type KaskoStatusValue =
  | "not_applicable"
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
  { label: string; tone: StatusChipTone; visible: boolean }
> = {
  not_applicable: { label: "Kasko yok", tone: "neutral", visible: false },
  pending: { label: "Kasko bekliyor", tone: "warning", visible: true },
  submitted: { label: "Sigortaya iletildi", tone: "info", visible: true },
  approved: { label: "Kasko onayladı", tone: "info", visible: true },
  rejected: { label: "Kasko reddetti", tone: "critical", visible: true },
  reimbursed: { label: "Kasko iade tamam", tone: "success", visible: true },
  partially_reimbursed: {
    label: "Kısmi kasko iade",
    tone: "info",
    visible: true,
  },
};

export function KaskoStatusBadge({ status }: KaskoStatusBadgeProps) {
  const meta = STATUS_META[status];
  if (!meta.visible) return null;
  return <StatusChip label={meta.label} tone={meta.tone} icon={ShieldCheck} />;
}
