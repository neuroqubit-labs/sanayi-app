import { Icon, Text } from "@naro/ui";
import { ChevronRight, Truck } from "lucide-react-native";
import { Pressable, View } from "react-native";

export function MobileServiceRow() {
  return (
    <Pressable
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-3.5 active:bg-app-surface-2"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-app-success-soft">
        <Icon icon={Truck} size={16} color="#2dd28d" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="label" tone="inverse">
          Mobil servis hattı
        </Text>
        <Text variant="caption" tone="muted" className="text-app-text-muted text-[12px]">
          Yerinde onarım + vale servis talepleri
        </Text>
      </View>
      <Icon icon={ChevronRight} size={14} color="#83a7ff" />
    </Pressable>
  );
}
