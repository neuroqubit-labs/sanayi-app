import { Button, Icon, StatusChip, Text } from "@naro/ui";
import { useRouter } from "expo-router";
import { ArrowUpRight, MapPin, Truck } from "lucide-react-native";
import { View } from "react-native";

import { useShellConfig } from "@/features/shell";
import { useActiveTowCase } from "@/features/tow/api";

export function ActiveTowJobHero() {
  const router = useRouter();
  const shellConfig = useShellConfig();
  const hasTow = shellConfig.enabled_capabilities.includes("tow");
  const activeJob = useActiveTowCase(hasTow).data;

  if (!activeJob) return null;

  return (
    <View className="gap-3 rounded-[26px] border border-brand-500/40 bg-brand-500/10 px-5 py-5">
      <View className="flex-row items-center gap-2">
        <Icon icon={Truck} size={16} color="#0ea5e9" />
        <Text variant="eyebrow" tone="accent">
          Aktif çekici işi
        </Text>
        <View className="flex-1" />
        <StatusChip
          label={activeJob.stage_label}
          tone="accent"
        />
      </View>
      <Text variant="h3" tone="inverse">
        {activeJob.stage_label}
      </Text>
      <View className="flex-row items-start gap-2.5">
        <Icon icon={MapPin} size={14} color="#2dd28d" />
        <Text
          variant="caption"
          tone="muted"
          className="flex-1 text-app-text-muted text-[13px] leading-[18px]"
        >
          {activeJob.pickup_label ?? "Alınacak konum"}
        </Text>
      </View>
      <Button
        label="İşe git"
        size="md"
        fullWidth
        leftIcon={<Icon icon={ArrowUpRight} size={16} color="#ffffff" />}
        onPress={() => router.push(`/cekici/${activeJob.id}`)}
      />
    </View>
  );
}
