import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Jobs() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 p-6 gap-2">
        <Text className="text-2xl font-bold text-neutral-900">İş teklifleri</Text>
        <Text className="text-neutral-600">Bölgenizdeki uygun işler burada listelenecek.</Text>
      </View>
    </SafeAreaView>
  );
}
