import { Icon, Text, TrustBadge } from "@naro/ui";
import { Href, useRouter } from "expo-router";
import { ArrowRight, MapPin, Store } from "lucide-react-native";
import { Pressable, View } from "react-native";

import type { NearbyService } from "../types";

type NearbyServiceCardProps = {
  service: NearbyService;
};

export function NearbyServiceCard({ service }: NearbyServiceCardProps) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${service.name} profilini ac`}
      onPress={() => router.push(service.route as Href)}
      className="flex-1 gap-4 overflow-hidden rounded-[24px] border border-app-outline bg-app-surface active:bg-app-surface-2"
    >
      <View className="relative h-20 overflow-hidden bg-brand-500/10">
        <View className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-brand-500/15" />
        <View className="absolute bottom-3 left-4 flex-row items-center gap-1.5 rounded-full border border-app-outline bg-app-surface-2 px-3 py-1.5">
          <Icon icon={MapPin} size={12} color="#83a7ff" />
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            {service.distanceLabel}
          </Text>
        </View>
        <View className="absolute -right-2 top-3 h-14 w-14 items-center justify-center rounded-[20px] border border-brand-500/40 bg-app-surface-2">
          <Icon icon={Store} size={22} color="#0ea5e9" />
        </View>
      </View>

      <View className="gap-4 px-4 pb-4">
        <View className="gap-1">
          <Text variant="h3" tone="inverse">
            {service.name}
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            {service.ratingLabel}
          </Text>
        </View>

        <View className="flex-row flex-wrap gap-2">
          {service.badges.map((badge) => (
            <TrustBadge key={badge} label={badge} tone="neutral" />
          ))}
        </View>

        <View className="flex-row items-center justify-between border-t border-app-outline pt-3">
          <Text variant="eyebrow" tone="subtle">
            Servis profili
          </Text>
          <View className="flex-row items-center gap-1">
            <Text variant="label" tone="accent">
              Aç
            </Text>
            <Icon icon={ArrowRight} size={14} color="#0ea5e9" />
          </View>
        </View>
      </View>
    </Pressable>
  );
}
