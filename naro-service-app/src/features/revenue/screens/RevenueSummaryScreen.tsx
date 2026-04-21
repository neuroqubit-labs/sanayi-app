import {
  BackButton,
  Icon,
  Screen,
  SectionHeader,
  Text,
  ToggleChip,
  TrustBadge,
} from "@naro/ui";
import { useRouter } from "expo-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { View } from "react-native";

type Period = "this_month" | "last_month" | "pending";

const METRICS: Record<
  Period,
  { gross: number; commission: number; net: number; pending: number }
> = {
  this_month: { gross: 24_600, commission: 6_150, net: 18_450, pending: 7_800 },
  last_month: { gross: 32_200, commission: 8_000, net: 24_200, pending: 0 },
  pending: { gross: 7_800, commission: 1_950, net: 5_850, pending: 7_800 },
};

type Transaction = {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  status: "paid" | "pending" | "on_hold";
  date: string;
};

const TRANSACTIONS: Transaction[] = [
  {
    id: "tx-001",
    title: "Mart periyodik bakım",
    subtitle: "BMW 3 · Mehmet Demir",
    amount: 2850,
    status: "paid",
    date: "20 Nis 09:00",
  },
  {
    id: "tx-002",
    title: "Kasko onarım",
    subtitle: "Mercedes · Selin Akın",
    amount: 7800,
    status: "pending",
    date: "19 Nis",
  },
  {
    id: "tx-003",
    title: "Lastik + balans",
    subtitle: "Renault · Burak Y.",
    amount: 1150,
    status: "paid",
    date: "18 Nis",
  },
  {
    id: "tx-004",
    title: "Yaz bakımı paketi",
    subtitle: "Audi · Zeynep A.",
    amount: 699,
    status: "paid",
    date: "15 Nis",
  },
  {
    id: "tx-005",
    title: "Motor revizyon",
    subtitle: "BMW · Onur Koç",
    amount: 18500,
    status: "on_hold",
    date: "14 Nis",
  },
  {
    id: "tx-006",
    title: "Fren sistemi yenileme",
    subtitle: "Toyota · Ayşe B.",
    amount: 3200,
    status: "paid",
    date: "10 Nis",
  },
];

const STATUS_TONE: Record<
  Transaction["status"],
  "success" | "warning" | "critical"
> = {
  paid: "success",
  pending: "warning",
  on_hold: "critical",
};

const STATUS_LABEL: Record<Transaction["status"], string> = {
  paid: "Ödendi",
  pending: "Beklemede",
  on_hold: "Askıda",
};

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: "this_month", label: "Bu ay" },
  { key: "last_month", label: "Geçen ay" },
  { key: "pending", label: "Bekleyen" },
];

export function RevenueSummaryScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("this_month");
  const metric = METRICS[period];

  const filteredTransactions = useMemo(() => {
    if (period === "pending") {
      return TRANSACTIONS.filter((tx) => tx.status !== "paid");
    }
    return TRANSACTIONS;
  }, [period]);

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-16">
      <View className="flex-row items-center gap-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="subtle">
            Finans
          </Text>
          <Text variant="h2" tone="inverse">
            Gelir Özeti
          </Text>
        </View>
      </View>

      <View className="flex-row gap-2">
        {PERIOD_OPTIONS.map((option) => (
          <ToggleChip
            key={option.key}
            label={option.label}
            selected={period === option.key}
            size="sm"
            onPress={() => setPeriod(option.key)}
          />
        ))}
      </View>

      <View className="gap-3 rounded-[24px] border border-app-outline-strong bg-app-surface-2 px-5 py-5">
        <View className="flex-row items-center gap-2">
          <Icon icon={TrendingUp} size={14} color="#2dd28d" />
          <Text variant="eyebrow" tone="subtle">
            Net kazanç
          </Text>
        </View>
        <Text variant="display" tone="inverse" className="text-[30px] leading-[34px]">
          ₺{metric.net.toLocaleString("tr-TR")}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <TrustBadge
            label={`Brüt ₺${metric.gross.toLocaleString("tr-TR")}`}
            tone="accent"
          />
          <TrustBadge
            label={`Komisyon ₺${metric.commission.toLocaleString("tr-TR")}`}
            tone="warning"
          />
          {metric.pending > 0 ? (
            <TrustBadge
              label={`Bekleyen ₺${metric.pending.toLocaleString("tr-TR")}`}
              tone="info"
            />
          ) : null}
        </View>
      </View>

      <View className="flex-row gap-2">
        <MetricCard
          icon={Wallet}
          color="#2dd28d"
          label="Tamamlanan"
          value={TRANSACTIONS.filter((tx) => tx.status === "paid").length.toString()}
        />
        <MetricCard
          icon={Clock}
          color="#f5b33f"
          label="Bekleyen"
          value={TRANSACTIONS.filter((tx) => tx.status === "pending").length.toString()}
        />
        <MetricCard
          icon={Receipt}
          color="#83a7ff"
          label="Askıda"
          value={TRANSACTIONS.filter((tx) => tx.status === "on_hold").length.toString()}
        />
      </View>

      <SectionHeader
        title="İşlem geçmişi"
        description={`${filteredTransactions.length} işlem`}
      />

      <View className="gap-2">
        {filteredTransactions.map((tx) => (
          <View
            key={tx.id}
            className="flex-row items-center gap-3 rounded-[16px] border border-app-outline bg-app-surface px-4 py-3"
          >
            <View
              className={`h-9 w-9 items-center justify-center rounded-full ${
                tx.status === "paid" ? "bg-app-success/15" : "bg-app-surface-2"
              }`}
            >
              <Icon
                icon={tx.status === "paid" ? ArrowUpRight : ArrowDownRight}
                size={14}
                color={tx.status === "paid" ? "#2dd28d" : "#f5b33f"}
              />
            </View>
            <View className="flex-1 gap-0.5">
              <Text
                variant="label"
                tone="inverse"
                className="text-[13px]"
                numberOfLines={1}
              >
                {tx.title}
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[11px]"
              >
                {tx.subtitle} · {tx.date}
              </Text>
            </View>
            <View className="items-end gap-1">
              <Text variant="label" tone="inverse" className="text-[13px]">
                ₺{tx.amount.toLocaleString("tr-TR")}
              </Text>
              <TrustBadge label={STATUS_LABEL[tx.status]} tone={STATUS_TONE[tx.status]} />
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

function MetricCard({
  icon,
  color,
  label,
  value,
}: {
  icon: typeof Wallet;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-1 gap-1 rounded-[16px] border border-app-outline bg-app-surface px-3 py-3">
      <Icon icon={icon} size={14} color={color} />
      <Text variant="h3" tone="inverse" className="text-[18px]">
        {value}
      </Text>
      <Text variant="caption" tone="muted" className="text-app-text-muted text-[11px]">
        {label}
      </Text>
    </View>
  );
}
