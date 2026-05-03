import { zodResolver } from "@hookform/resolvers/zod";
import { normalizePhoneTR } from "@naro/mobile-core";
import { Button, FormField, Screen, Text } from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Pressable, View } from "react-native";
import { z } from "zod";

import { telemetry } from "@/runtime";
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
    // Phone'u E.164'e normalize et — backend unique check + technician
    // lookup string-eq, yani "0555900007" ve "+905559000007" farklı kayıt
    // sayar ve sessizce ikinci pending user yaratır.
    const normalized = normalizePhoneTR(values.phone);
    if (!normalized) {
      setSubmitError("Telefon numarası geçerli değil");
      return;
    }
    try {
      const res = await authApi.requestOtp({ channel: "sms", phone: normalized });
      telemetry.track("auth_otp_requested", { app: "service" });
      router.push({ pathname: "/(auth)/verify", params: { deliveryId: res.delivery_id } });
    } catch (error) {
      telemetry.captureError(error, { app: "service", stage: "request_otp" });
      setSubmitError("Kod gönderilemedi, tekrar deneyin");
    }
  }

  return (
    <Screen>
      <View className="gap-6">
        <View className="gap-2">
          <Text variant="h1">Naro Servis'e giriş</Text>
          <Text tone="calm">
            Usta hesabınla giriş yap. Hesabın yoksa, telefon numaranı gir — onay süreci ile devam edeceğiz.
          </Text>
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

        <Text
          tone="muted"
          className="text-app-text-muted text-[12px] leading-[18px]"
        >
          Devam ederek{" "}
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push("/(modal)/legal?doc=terms" as Href)}
          >
            <Text tone="accent" className="text-[12px] underline">
              Kullanım koşulları
            </Text>
          </Pressable>
          {" ve "}
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push("/(modal)/legal?doc=kvkk" as Href)}
          >
            <Text tone="accent" className="text-[12px] underline">
              KVKK aydınlatma metnini
            </Text>
          </Pressable>
          {" kabul etmiş olursun."}
        </Text>
      </View>
    </Screen>
  );
}
