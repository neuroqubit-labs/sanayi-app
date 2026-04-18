import { Screen, Text } from "@naro/ui";
import { View } from "react-native";

export default function Earnings() {
  return (
    <Screen>
      <View className="gap-2">
        <Text variant="h2">Kazançlarım</Text>
        <Text tone="calm">Tamamlanan işler ve ödeme geçmişi burada görünecek.</Text>
      </View>
    </Screen>
  );
}
