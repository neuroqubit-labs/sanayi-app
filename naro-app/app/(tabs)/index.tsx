import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Home() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 p-6 gap-2">
        <Text className="text-2xl font-bold text-neutral-900">Naro</Text>
        <Text className="text-neutral-600">Araç servis eşleştirme platformu</Text>
      </View>
    </SafeAreaView>
  );
}
