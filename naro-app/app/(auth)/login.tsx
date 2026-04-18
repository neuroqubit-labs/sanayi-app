import { zodResolver } from "@hookform/resolvers/zod";
import { Button, FormField, Screen, Text } from "@naro/ui";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { View } from "react-native";
import { z } from "zod";

import { authApi } from "@/services/auth/api";

const LoginFormSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(10, "Telefon numarası en az 10 karakter olmalı")
    .max(16, "Çok uzun"),
});

type LoginFormValues = z.infer<typeof LoginFormSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(LoginFormSchema),
    defaultValues: { phone: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    setSubmitError(null);
    try {
      const res = await authApi.requestOtp({ channel: "sms", phone: values.phone });
      router.push({ pathname: "/(auth)/verify", params: { deliveryId: res.delivery_id } });
    } catch {
      setSubmitError("Kod gönderilemedi, tekrar deneyin");
    }
  }

  return (
    <Screen>
      <View className="gap-6">
        <View className="gap-2">
          <Text variant="h1">Naro'ya hoş geldin</Text>
          <Text tone="calm">Telefon numaranı gir, SMS ile kod gönderelim.</Text>
        </View>

        <FormField
          control={control}
          name="phone"
          label="Telefon"
          placeholder="+905551112233"
          keyboardType="phone-pad"
          autoComplete="tel"
        />

        {submitError ? <Text tone="panic">{submitError}</Text> : null}

        <Button
          label={isSubmitting ? "Gönderiliyor..." : "Kod gönder"}
          loading={isSubmitting}
          onPress={handleSubmit(onSubmit)}
          fullWidth
          size="lg"
        />
      </View>
    </Screen>
  );
}
