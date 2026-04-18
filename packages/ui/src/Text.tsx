import { Text as RNText, type TextProps as RNTextProps } from "react-native";

export type TextVariant = "h1" | "h2" | "h3" | "body" | "caption";
export type TextTone = "panic" | "calm" | "neutral" | "muted";

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
};

const VARIANT_CLASS: Record<TextVariant, string> = {
  h1: "text-3xl font-bold",
  h2: "text-2xl font-bold",
  h3: "text-xl font-semibold",
  body: "text-base",
  caption: "text-sm",
};

const TONE_CLASS: Record<TextTone, string> = {
  panic: "text-red-700 font-semibold",
  calm: "text-neutral-700",
  neutral: "text-neutral-900",
  muted: "text-neutral-500",
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
