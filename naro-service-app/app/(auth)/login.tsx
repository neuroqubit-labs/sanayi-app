import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { authApi } from "@/services/auth/api";
import { Button } from "@/shared/ui/Button";

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.requestOtp({ channel: "sms", phone });
      router.push({ pathname: "/(auth)/verify", params: { deliveryId: res.delivery_id } });
    } catch {
      setError("Kod gönderilemedi, tekrar deneyin");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-12 gap-6">
        <Text className="text-3xl font-bold text-neutral-900">Naro Servis'e giriş</Text>
        <Text className="text-neutral-600">
          Usta hesabınla giriş yap. Hesabın yoksa, telefon numaranı gir — onay süreci ile devam edeceğiz.
        </Text>

        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="+905551112233"
          keyboardType="phone-pad"
          autoComplete="tel"
          className="border border-neutral-300 rounded-xl px-4 py-3 text-base"
        />

        {error && <Text className="text-red-600">{error}</Text>}

        <Button
          label={loading ? "Gönderiliyor..." : "Kod gönder"}
          disabled={loading || !phone}
          onPress={onSubmit}
        />
      </View>
    </SafeAreaView>
  );
}
