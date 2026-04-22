import { CheckCircle2, Clock3, XCircle } from "lucide-react-native";
import { View } from "react-native";

import { Icon } from "../Icon";
import { Text } from "../Text";

import { MoneyAmount } from "./MoneyAmount";

export type RefundStateValue = "pending" | "success" | "failed";

export type RefundTrackingRowProps = {
  amount: number;
  currency?: string;
  state: RefundStateValue;
  reasonLabel: string;
  /** Human-readable ETA (örn "3-5 iş günü"). */
  etaLabel?: string;
  /** ISO timestamp — başarı durumunda "tamamlandı" mesajı için. */
  completedAtLabel?: string;
};

const STATE_META: Record<
  RefundStateValue,
  { icon: typeof Clock3; color: string; caption: string }
> = {
  pending: { icon: Clock3, color: "#83a7ff", caption: "İade işleme alındı" },
  success: {
    icon: CheckCircle2,
    color: "#2dd28d",
    caption: "İade tamamlandı",
  },
  failed: { icon: XCircle, color: "#ff7e7e", caption: "İade başarısız" },
};

export function RefundTrackingRow({
  amount,
  currency = "TRY",
  state,
  reasonLabel,
  etaLabel,
  completedAtLabel,
}: RefundTrackingRowProps) {
  const meta = STATE_META[state];
  const subtitle =
    state === "pending"
      ? `${meta.caption}${etaLabel ? ` · ${etaLabel}` : ""}`
      : state === "success"
        ? `${meta.caption}${completedAtLabel ? ` · ${completedAtLabel}` : ""}`
        : meta.caption;

  return (
    <View className="flex-row items-center gap-3 rounded-[18px] border border-app-outline bg-app-surface px-4 py-3">
      <View
        className="h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: `${meta.color}22` }}
      >
        <Icon icon={meta.icon} size={15} color={meta.color} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="label" tone="inverse" className="text-[13px]">
          {reasonLabel}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[11px]"
        >
          {subtitle}
        </Text>
      </View>
      <MoneyAmount
        amount={amount}
        currency={currency}
        variant="label"
        tone={state === "success" ? "success" : "inverse"}
        compact
      />
    </View>
  );
}
