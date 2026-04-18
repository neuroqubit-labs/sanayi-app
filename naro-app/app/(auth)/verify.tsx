import { zodResolver } from "@hookform/resolvers/zod";
import { Button, FormField, Screen, Text } from "@naro/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { View } from "react-native";
import { z } from "zod";

import { authApi } from "@/services/auth/api";
import { useAuthStore } from "@/services/auth/store";

const VerifyFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4, "Kod en az 4 haneli olmalı")
    .max(8, "Kod en fazla 8 haneli olabilir"),
});

type VerifyFormValues = z.infer<typeof VerifyFormSchema>;

export default function VerifyScreen() {
  const router = useRouter();
  const { deliveryId } = useLocalSearchParams<{ deliveryId: string }>();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<VerifyFormValues>({
    resolver: zodResolver(VerifyFormSchema),
    defaultValues: { code: "" },
  });

  async function onSubmit(values: VerifyFormValues) {
    if (!deliveryId) return;
    setSubmitError(null);
    try {
      const tokens = await authApi.verifyOtp({ delivery_id: deliveryId, code: values.code });
      await setTokens(tokens.access_token, tokens.refresh_token);
      router.replace("/(tabs)");
    } catch {
      setSubmitError("Kod geçersiz veya süresi dolmuş");
    }
  }

  return (
    <Screen>
      <View className="gap-6">
        <View className="gap-2">
          <Text variant="h1">Kodu gir</Text>
          <Text tone="calm">Telefonuna gelen 6 haneli kodu gir.</Text>
        </View>

        <FormField
          control={control}
          name="code"
          placeholder="------"
          keyboardType="number-pad"
          maxLength={6}
          inputClassName="text-2xl text-center tracking-widest"
        />

        {submitError ? <Text tone="panic">{submitError}</Text> : null}

        <Button
          label={isSubmitting ? "Doğrulanıyor..." : "Devam"}
          loading={isSubmitting}
          onPress={handleSubmit(onSubmit)}
          fullWidth
          size="lg"
        />
      </View>
    </Screen>
  );
}
