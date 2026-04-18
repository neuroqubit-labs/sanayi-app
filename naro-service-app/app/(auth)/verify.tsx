import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { authApi } from "@/services/auth/api";
import { useAuthStore } from "@/services/auth/store";
import { Button } from "@/shared/ui/Button";

export default function VerifyScreen() {
  const router = useRouter();
  const { deliveryId } = useLocalSearchParams<{ deliveryId: string }>();
  const { setTokens, setApprovalStatus } = useAuthStore();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!deliveryId) return;
    setLoading(true);
    setError(null);
    try {
      const tokens = await authApi.verifyOtp({ delivery_id: deliveryId, code });
      await setTokens(tokens.access_token, tokens.refresh_token);
      // Yeni technician kayıtları backend tarafında "pending" olarak oluşturulur.
      // Gerçek akışta /users/me çağırıp status alınmalı; şimdilik varsayılan pending.
      setApprovalStatus("pending");
      router.replace("/(onboarding)/pending");
    } catch {
      setError("Kod geçersiz veya süresi dolmuş");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-12 gap-6">
        <Text className="text-3xl font-bold text-neutral-900">Kodu gir</Text>
        <Text className="text-neutral-600">Telefonuna gelen 6 haneli kodu gir.</Text>

        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="------"
          keyboardType="number-pad"
          maxLength={6}
          className="border border-neutral-300 rounded-xl px-4 py-3 text-2xl text-center tracking-widest"
        />

        {error && <Text className="text-red-600">{error}</Text>}

        <Button
          label={loading ? "Doğrulanıyor..." : "Devam"}
          disabled={loading || code.length < 4}
          onPress={onSubmit}
        />
      </View>
    </SafeAreaView>
  );
}
