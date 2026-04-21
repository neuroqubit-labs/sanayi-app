import type { TowTechnicianProfile } from "@naro/domain";
import { Avatar, Icon, StatusChip, Text } from "@naro/ui";
import { Phone, Star } from "lucide-react-native";
import { Linking, Platform, Pressable, View } from "react-native";

import { labelForEquipment } from "../presentation";

type Props = {
  technician: TowTechnicianProfile;
  etaLabel?: string | null;
};

function dialNumber(number: string) {
  const url = Platform.OS === "ios" ? `telprompt:${number}` : `tel:${number}`;
  Linking.openURL(url).catch(() => undefined);
}

export function TowTechnicianCard({ technician, etaLabel }: Props) {
  return (
    <View className="flex-row items-center gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
      <Avatar name={technician.name} size="lg" />
      <View className="flex-1 gap-1">
        <Text variant="h3" tone="inverse">
          {technician.name}
        </Text>
        <Text variant="caption" tone="muted" className="text-app-text-muted">
          {technician.truck_model} · {technician.plate}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <Icon icon={Star} size={12} color="#f5b33f" strokeWidth={2.5} />
          <Text variant="caption" tone="warning">
            {technician.rating.toFixed(1)}
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-subtle">
            · {technician.completed_jobs} iş
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-1.5 pt-1">
          <StatusChip label={labelForEquipment(technician.equipment)} tone="neutral" />
          {etaLabel ? <StatusChip label={etaLabel} tone="accent" /> : null}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Operatörü ara"
        onPress={() => dialNumber(technician.phone)}
        className="h-12 w-12 items-center justify-center rounded-full bg-brand-500 active:bg-brand-600"
      >
        <Icon icon={Phone} size={18} color="#ffffff" />
      </Pressable>
    </View>
  );
}
