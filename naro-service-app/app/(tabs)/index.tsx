import { Screen, Text } from "@naro/ui";
import { View } from "react-native";

export default function Jobs() {
  return (
    <Screen>
      <View className="gap-2">
        <Text variant="h2">İş teklifleri</Text>
        <Text tone="calm">Bölgenizdeki uygun işler burada listelenecek.</Text>
      </View>
    </Screen>
  );
}
