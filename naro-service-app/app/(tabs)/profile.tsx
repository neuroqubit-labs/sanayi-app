import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthStore } from "@/services/auth/store";
import { Button } from "@/shared/ui/Button";

export default function Profile() {
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);

  async function onLogout() {
    await clear();
    router.replace("/(auth)/login");
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 p-6 gap-4">
        <Text className="text-2xl font-bold text-neutral-900">Profil</Text>
        <Button label="Çıkış yap" variant="secondary" onPress={onLogout} />
      </View>
    </SafeAreaView>
  );
}
