import { Text } from "@naro/ui";
import { View } from "react-native";

import { useHomeSummary } from "../api";

export function ActiveProcessBanner() {
  const { data } = useHomeSummary();
  if (!data?.activeProcess) return null;

  return (
    <View className="gap-2 rounded-xl border border-brand-500 bg-brand-50 p-4">
      <Text variant="caption" tone="calm" className="font-semibold">
        İşlem devam ediyor
      </Text>
      <Text variant="h3">{data.activeProcess.servisAd}</Text>
      <Text tone="calm">{data.activeProcess.status}</Text>
    </View>
  );
}
