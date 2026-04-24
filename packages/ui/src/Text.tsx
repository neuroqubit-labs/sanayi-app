import { Text as RNText, type TextProps as RNTextProps } from "react-native";

export type TextVariant =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "body"
  | "caption"
  | "label"
  | "eyebrow";
export type TextTone =
  | "panic"
  | "calm"
  | "neutral"
  | "muted"
  | "inverse"
  | "accent"
  | "success"
  | "warning"
  | "critical"
  | "subtle";

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  className?: string;
};

const VARIANT_CLASS: Record<TextVariant, string> = {
  display: "text-4xl font-bold",
  h1: "text-3xl font-bold",
  h2: "text-2xl font-bold",
  h3: "text-xl font-semibold",
  body: "text-base",
  caption: "text-sm",
  label: "text-sm font-semibold",
  eyebrow: "text-xs font-semibold uppercase",
};

const TONE_CLASS: Record<TextTone, string> = {
  panic: "text-red-700 font-semibold",
  calm: "text-neutral-700",
  neutral: "text-neutral-900",
  muted: "text-neutral-500",
  inverse: "text-app-text",
  accent: "text-brand-500",
  success: "text-app-success",
  warning: "text-app-warning",
  critical: "text-app-critical",
  subtle: "text-app-text-subtle",
};

export function Text({
  variant = "body",
  tone = "neutral",
  className,
  ...rest
}: TextProps) {
  const composed = [
    VARIANT_CLASS[variant],
    TONE_CLASS[tone],
    typeof className === "string" ? className : "",
  ]
    .filter(Boolean)
    .join(" ");
  return <RNText className={composed} {...rest} />;
}
