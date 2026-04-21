import type { CaseAttachmentKind, CaseTone } from "@naro/domain";
import type { StatusChipTone } from "@naro/ui";
import {
  AlertTriangle,
  AudioWaveform,
  Bell,
  FileText,
  MapPin,
  Receipt,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";

export type Tone = CaseTone;

export const toneIconColor: Record<Tone, string> = {
  accent: "#0ea5e9",
  neutral: "#f5f7ff",
  success: "#2dd28d",
  warning: "#f5b33f",
  critical: "#ff6b6b",
  info: "#83a7ff",
};

export const toneSurfaceClass: Record<Tone, string> = {
  accent: "bg-brand-500/15 border-brand-500/30",
  neutral: "bg-app-surface border-app-outline",
  success: "bg-app-success-soft border-app-success/30",
  warning: "bg-app-warning-soft border-app-warning/30",
  critical: "bg-app-critical-soft border-app-critical/30",
  info: "bg-app-info-soft border-app-info/30",
};

export const toneBorderClass: Record<Tone, string> = {
  accent: "border-brand-500/30",
  neutral: "border-app-outline",
  success: "border-app-success/30",
  warning: "border-app-warning/30",
  critical: "border-app-critical/30",
  info: "border-app-info/30",
};

export const toneSoftFillClass: Record<Tone, string> = {
  accent: "bg-brand-500/15",
  neutral: "bg-app-surface-2",
  success: "bg-app-success-soft",
  warning: "bg-app-warning-soft",
  critical: "bg-app-critical-soft",
  info: "bg-app-info-soft",
};

export function toStatusChipTone(tone: Tone): StatusChipTone {
  return tone;
}

const ACTIVITY_ICON_BY_TONE: Record<Tone, LucideIcon> = {
  accent: Wrench,
  info: Bell,
  success: Receipt,
  warning: Bell,
  critical: AlertTriangle,
  neutral: Sparkles,
};

export function activityIconFor(tone: Tone): LucideIcon {
  return ACTIVITY_ICON_BY_TONE[tone] ?? Bell;
}

const ATTACHMENT_ICON_BY_KIND: Record<CaseAttachmentKind, LucideIcon> = {
  photo: Receipt,
  video: Receipt,
  audio: AudioWaveform,
  invoice: Receipt,
  report: FileText,
  document: FileText,
  location: MapPin,
};

export function attachmentIconFor(kind: CaseAttachmentKind): LucideIcon {
  return ATTACHMENT_ICON_BY_KIND[kind] ?? FileText;
}

export function documentStatusTone(statusLabel: string): Tone {
  const value = statusLabel.toLowerCase();

  if (value.includes("onay") || value.includes("bekle")) {
    return "warning";
  }

  if (value.includes("arsiv") || value.includes("arşiv")) {
    return "neutral";
  }

  if (value.includes("red") || value.includes("iptal")) {
    return "critical";
  }

  if (
    value.includes("tamam") ||
    value.includes("hazir") ||
    value.includes("hazır") ||
    value.includes("kabul")
  ) {
    return "success";
  }

  return "info";
}

export type UrgencyLevel = "planned" | "today" | "urgent";

export function urgencyToTone(level: UrgencyLevel): Tone {
  switch (level) {
    case "urgent":
      return "critical";
    case "today":
      return "warning";
    case "planned":
      return "accent";
  }
}

export function urgencyLabel(level: UrgencyLevel): string {
  switch (level) {
    case "urgent":
      return "Acil";
    case "today":
      return "Bugün";
    case "planned":
      return "Planlı";
  }
}
