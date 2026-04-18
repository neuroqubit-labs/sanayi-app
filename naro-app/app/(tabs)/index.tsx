import { Screen, Text } from "@naro/ui";
import { View } from "react-native";

export default function Home() {
  return (
    <Screen>
      <View className="gap-2">
        <Text variant="h2">Naro</Text>
        <Text tone="calm">Araç servis eşleştirme platformu</Text>
      </View>
    </Screen>
  );
}
