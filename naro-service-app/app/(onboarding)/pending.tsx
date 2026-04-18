import { Button, Icon, Screen, Text } from "@naro/ui";
import { useRouter } from "expo-router";
import { Clock } from "lucide-react-native";
import { View } from "react-native";

import { useAuthStore } from "@/services/auth/store";

export default function PendingScreen() {
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);

  async function onLogout() {
    await clear();
    router.replace("/(auth)/login");
  }

  return (
    <Screen>
      <View className="flex-1 gap-4">
        <View className="items-center gap-4 pt-8">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-50">
            <Icon icon={Clock} size={36} color="#d94a1f" />
          </View>
          <Text variant="h1" className="text-center">
            Hesabın inceleniyor
          </Text>
        </View>

        <Text tone="calm">
          Usta başvurunu aldık. Belge doğrulama ve onay süreci tamamlandıktan sonra hesabın aktif hale gelecek ve iş tekliflerini görmeye başlayacaksın.
        </Text>
        <Text tone="calm">Bu süreç genellikle 1-2 iş günü sürer. Onay SMS ile bildirilecek.</Text>

        <View className="flex-1" />

        <Button label="Çıkış yap" variant="secondary" onPress={onLogout} fullWidth size="lg" />
      </View>
    </Screen>
  );
}
