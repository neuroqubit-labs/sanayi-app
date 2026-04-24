import { useNaroTheme } from "./theme";

export type NaroTone =
  | "accent"
  | "neutral"
  | "success"
  | "warning"
  | "critical"
  | "info";

export const toneSurfaceClass: Record<NaroTone, string> = {
  accent: "border border-brand-500/30 bg-brand-500/15",
  neutral: "border border-app-outline bg-app-surface",
  success: "border border-app-success/30 bg-app-success-soft",
  warning: "border border-app-warning/30 bg-app-warning-soft",
  critical: "border border-app-critical/30 bg-app-critical-soft",
  info: "border border-app-info/30 bg-app-info-soft",
};

export const toneTextClass: Record<NaroTone, string> = {
  accent: "text-brand-500",
  neutral: "text-app-text",
  success: "text-app-success",
  warning: "text-app-warning",
  critical: "text-app-critical",
  info: "text-app-info",
};

export function useToneColor(tone: NaroTone) {
  const { colors } = useNaroTheme();

  switch (tone) {
    case "accent":
    case "info":
      return colors.info;
    case "success":
      return colors.success;
    case "warning":
      return colors.warning;
    case "critical":
      return colors.critical;
    case "neutral":
    default:
      return colors.text;
  }
}
