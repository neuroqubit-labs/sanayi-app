import { Icon, Text } from "@naro/ui";
import { ClipboardCheck, Hammer } from "lucide-react-native";
import { View } from "react-native";

export function ExpertiseRequestsCard() {
  return (
    <View className="gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
      <View className="flex-row items-center gap-2">
        <Icon icon={ClipboardCheck} size={14} color="#83a7ff" />
        <Text variant="eyebrow" tone="subtle">
          Ekspertiz talepleri
        </Text>
      </View>
      <Text variant="label" tone="inverse">
        0 bekleyen ekspertiz
      </Text>
      <View className="flex-row items-start gap-2">
        <Icon icon={Hammer} size={12} color="#6f7b97" />
        <Text
          variant="caption"
          tone="muted"
          className="flex-1 text-app-text-muted text-[12px]"
        >
          Kaza hasarı olan araçlar için ekspertiz talepleri burada listelenir. Şu an boş.
        </Text>
      </View>
    </View>
  );
}
