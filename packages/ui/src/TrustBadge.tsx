import type { LucideIcon } from "lucide-react-native";

import { StatusChip, type StatusChipProps, type StatusChipTone } from "./StatusChip";

export type TrustBadgeProps = Omit<StatusChipProps, "tone"> & {
  tone?: StatusChipTone;
  icon?: LucideIcon;
};

export function TrustBadge({ tone = "success", ...props }: TrustBadgeProps) {
  return <StatusChip tone={tone} {...props} />;
}
