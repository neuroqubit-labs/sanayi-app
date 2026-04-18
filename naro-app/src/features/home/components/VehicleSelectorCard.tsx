import { Icon, Text } from "@naro/ui";
import { ChevronDown } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { useActiveVehicle } from "@/features/vehicles";

export function VehicleSelectorCard() {
  const { data: vehicle } = useActiveVehicle();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Araç seç"
      className="flex-row items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 active:bg-neutral-50"
    >
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-50">
          <Text className="font-semibold text-brand-600">
            {vehicle ? vehicle.plate.split(" ")[0] : "—"}
          </Text>
        </View>
        <View>
          <Text variant="caption" tone="muted">
            Seçili araç
          </Text>
          <Text variant="body" className="font-semibold">
            {vehicle ? `${vehicle.plate} · ${vehicle.make} ${vehicle.model}` : "Araç ekle"}
          </Text>
        </View>
      </View>
      <Icon icon={ChevronDown} size={20} color="#6b7280" />
    </Pressable>
  );
}
