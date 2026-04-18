import { Button, Screen, Text } from "@naro/ui";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { useAuthStore } from "@/services/auth/store";

export function ProfileScreen() {
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);

  async function onLogout() {
    await clear();
    router.replace("/(auth)/login");
  }

  return (
    <Screen>
      <View className="gap-4">
        <Text variant="h2">İşletme Profili</Text>
        <Text tone="calm">İşletme bilgileri, usta ekibi, hizmetler ve belgeler burada yönetilecek.</Text>
        <View className="flex-1" />
        <Button label="Çıkış yap" variant="secondary" onPress={onLogout} fullWidth size="lg" />
      </View>
    </Screen>
  );
}
