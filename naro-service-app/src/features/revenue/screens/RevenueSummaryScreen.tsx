import {
  BackButton,
  Icon,
  MoneyAmount,
  Screen,
  SectionHeader,
  Text,
  ToggleChip,
  TrustBadge,
} from "@naro/ui";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { useMyPayoutsQuery } from "../api";
import type { TechnicianPayoutItem } from "../schemas";

type PeriodFilter = "all" | "completed" | "pending";

const PERIOD_OPTIONS: { key: PeriodFilter; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "completed", label: "Ödenmiş" },
  { key: "pending", label: "Bekleyen" },
];

export function RevenueSummaryScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const { data, isLoading, isError, refetch } = useMyPayoutsQuery();

  const items = useMemo(() => data ?? [], [data]);

  const totals = useMemo(() => {
    let netTotal = 0;
    let completedAmount = 0;
    let pendingAmount = 0;
    let completedCount = 0;
    let pendingCount = 0;
    for (const item of items) {
      netTotal += item.net_to_technician_amount;
      if (item.payout_completed_at) {
        completedAmount += item.net_to_technician_amount;
        completedCount += 1;
      } else {
        pendingAmount += item.net_to_technician_amount;
        pendingCount += 1;
      }
    }
    return {
      netTotal,
      completedAmount,
      pendingAmount,
      completedCount,
      pendingCount,
      totalCount: items.length,
    };
  }, [items]);

  const filtered = useMemo(() => {
    if (period === "completed") {
      return items.filter((item) => Boolean(item.payout_completed_at));
    }
    if (period === "pending") {
      return items.filter((item) => !item.payout_completed_at);
    }
    return items;
  }, [items, period]);

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
            Toplam net kazanç
          </Text>
        </View>
        <MoneyAmount
          amount={isLoading ? null : totals.netTotal}
          variant="display"
          tone="inverse"
          className="text-[30px] leading-[34px]"
        />
        <View className="flex-row flex-wrap gap-2">
          <TrustBadge
            label={`Ödenmiş ₺${Math.round(totals.completedAmount).toLocaleString("tr-TR")}`}
            tone="success"
          />
          {totals.pendingAmount > 0 ? (
            <TrustBadge
              label={`Bekleyen ₺${Math.round(totals.pendingAmount).toLocaleString("tr-TR")}`}
              tone="warning"
            />
          ) : null}
        </View>
      </View>

      <View className="flex-row gap-2">
        <MetricCard
          icon={Wallet}
          color="#2dd28d"
          label="Ödenmiş"
          value={totals.completedCount.toString()}
        />
        <MetricCard
          icon={Clock}
          color="#f5b33f"
          label="Bekleyen"
          value={totals.pendingCount.toString()}
        />
        <MetricCard
          icon={Receipt}
          color="#83a7ff"
          label="Toplam vaka"
          value={totals.totalCount.toString()}
        />
      </View>

      <SectionHeader
        title="Hak ediş geçmişi"
        description={`${filtered.length} kayıt`}
      />

      {isLoading ? (
        <View className="items-center py-10">
          <ActivityIndicator color="#83a7ff" />
        </View>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState period={period} />
      ) : (
        <View className="gap-2">
          {filtered.map((item) => (
            <PayoutRow key={item.settlement_id} item={item} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function PayoutRow({ item }: { item: TechnicianPayoutItem }) {
  const isCompleted = Boolean(item.payout_completed_at);
  const capturedLabel = formatDate(item.captured_at);
  const payoutLabel = item.payout_completed_at
    ? `Ödendi · ${formatDate(item.payout_completed_at)}`
    : item.payout_scheduled_at
      ? `Planlandı · ${formatDate(item.payout_scheduled_at)}`
      : "Beklemede";

  return (
    <View className="flex-row items-center gap-3 rounded-[16px] border border-app-outline bg-app-surface px-4 py-3">
      <View
        className={`h-9 w-9 items-center justify-center rounded-full ${
          isCompleted ? "bg-app-success/15" : "bg-app-surface-2"
        }`}
      >
        <Icon
          icon={isCompleted ? CheckCircle2 : Clock}
          size={14}
          color={isCompleted ? "#2dd28d" : "#f5b33f"}
        />
      </View>
      <View className="flex-1 gap-0.5">
        <Text
          variant="label"
          tone="inverse"
          className="text-[13px]"
          numberOfLines={1}
        >
          Vaka #{item.case_id.slice(0, 8)}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[11px]"
        >
          Tahsilat · {capturedLabel}
          {item.payout_reference ? ` · Ref ${item.payout_reference}` : ""}
        </Text>
      </View>
      <View className="items-end gap-1">
        <MoneyAmount
          amount={item.net_to_technician_amount}
          currency={item.platform_currency}
          variant="label"
          tone="inverse"
          className="text-[13px]"
          compact
        />
        <TrustBadge
          label={payoutLabel}
          tone={isCompleted ? "success" : "warning"}
        />
      </View>
    </View>
  );
}

function EmptyState({ period }: { period: PeriodFilter }) {
  const message =
    period === "completed"
      ? "Henüz ödemesi tamamlanmış hak ediş yok."
      : period === "pending"
        ? "Bekleyen hak ediş bulunmuyor."
        : "Henüz tamamlanmış vaka kaydın yok. İlk hizmetinden sonra burada görünecek.";
  return (
    <View className="items-center gap-2 rounded-[16px] border border-app-outline bg-app-surface px-4 py-8">
      <Icon icon={Wallet} size={20} color="#83a7ff" />
      <Text variant="body" tone="muted" className="text-center">
        {message}
      </Text>
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="items-center gap-3 rounded-[16px] border border-app-critical/40 bg-app-critical/10 px-4 py-6">
      <Icon icon={AlertCircle} size={20} color="#ff6b6b" />
      <Text variant="body" tone="inverse" className="text-center">
        Hak ediş listesi yüklenemedi.
      </Text>
      <ToggleChip label="Tekrar dene" size="sm" selected onPress={onRetry} />
    </View>
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

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}
