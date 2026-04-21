import { Text } from "@naro/ui";
import { Pressable, View } from "react-native";

import { useTechnicianProfileStore } from "@/features/technicians";

import { useBusinessSummary } from "../api";

export function BusinessSummaryCard() {
  const { data } = useBusinessSummary();
  const setAvailability = useTechnicianProfileStore(
    (state) => state.setAvailability,
  );
  if (!data) return null;

  const toggleAvailability = () => {
    setAvailability(data.availability ? "busy" : "available");
  };

  return (
    <View className="gap-4 rounded-[30px] border border-app-outline-strong bg-app-surface-2 px-5 py-5">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-0.5">
          <Text variant="h3" tone="inverse">
            {data.businessName}
          </Text>
          {data.tagline ? (
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[12px]"
              numberOfLines={1}
            >
              {data.tagline}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={
            data.availability ? "Müsaitliği kapat" : "Müsait olarak aç"
          }
          accessibilityState={{ checked: data.availability }}
          onPress={toggleAvailability}
          className={`rounded-full px-3 py-1.5 active:opacity-80 ${
            data.availability
              ? "border border-app-success/40 bg-app-success-soft"
              : "border border-app-outline bg-app-surface"
          }`}
        >
          <Text
            variant="caption"
            className={`font-semibold text-[12px] ${
              data.availability ? "text-app-success" : "text-app-text-subtle"
            }`}
          >
            {data.availability ? "Açık" : "Kapalı"}
          </Text>
        </Pressable>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <StatPill value={`${data.stats.activeJobs}`} label="Aktif" tone="inverse" />
        <StatPill value={`${data.stats.upcoming}`} label="Bekleyen" tone="warning" />
        <StatPill value={`${data.stats.weeklyJobs}`} label="Bu Hafta" tone="success" />
        <StatPill
          value={data.stats.dailyEarningsLabel}
          label="Bugün"
          tone="accent"
        />
      </View>
    </View>
  );
}

function StatPill({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "inverse" | "warning" | "success" | "accent";
}) {
  return (
    <View className="min-w-[22%] flex-1 items-center gap-1 rounded-[20px] border border-app-outline bg-app-surface p-3">
      <Text variant="h3" tone={tone} className="text-[20px] leading-[22px]">
        {value}
      </Text>
      <Text variant="caption" tone="muted" className="text-app-text-muted text-[11px]">
        {label}
      </Text>
    </View>
  );
}
