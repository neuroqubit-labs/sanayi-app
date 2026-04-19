import { Button, Screen, Text } from "@naro/ui";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { telemetry } from "@/runtime";
import { useAuthStore } from "@/services/auth/store";

export function ProfileScreen() {
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);

  async function onLogout() {
    await clear();
    telemetry.track("auth_logout", { app: "customer" });
    router.replace("/(auth)/login");
  }

  return (
    <Screen>
      <View className="gap-4">
        <Text variant="h2">Profil</Text>
        <Text tone="calm">Kullanıcı bilgileri, araçlar ve tercihler burada.</Text>
        <View className="flex-1" />
        <Button label="Çıkış yap" variant="secondary" onPress={onLogout} fullWidth size="lg" />
      </View>
    </Screen>
  );
}
