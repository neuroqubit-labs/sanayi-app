import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthStore } from "@/services/auth/store";
import { Button } from "@/shared/ui/Button";

export default function PendingScreen() {
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);

  async function onLogout() {
    await clear();
    router.replace("/(auth)/login");
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-12 gap-4">
        <Text className="text-3xl font-bold text-neutral-900">Hesabın inceleniyor</Text>
        <Text className="text-neutral-600">
          Usta başvurunu aldık. Belge doğrulama ve onay süreci tamamlandıktan sonra hesabın aktif hale gelecek ve iş tekliflerini görmeye başlayacaksın.
        </Text>
        <Text className="text-neutral-600">
          Bu süreç genellikle 1-2 iş günü sürer. Onay SMS ile bildirilecek.
        </Text>

        <View className="flex-1" />

        <Button label="Çıkış yap" variant="secondary" onPress={onLogout} />
      </View>
    </SafeAreaView>
  );
}
