import { zodResolver } from "@hookform/resolvers/zod";
import { Button, FormField, Screen, Text } from "@naro/ui";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, View } from "react-native";
import { z } from "zod";

import { useUpdateMe } from "@/features/user";
import { telemetry } from "@/runtime";
import { useAuthStore } from "@/services/auth/store";

/**
 * Customer kısa profil ekranı — yeni user verify sonrası gelir.
 *
 * PO vizyonu (mobile-auth-onboarding-strategy 3.1-C):
 *   - Tek giriş kapısı; ayrı register ekranı yok
 *   - Minimum friction: ad zorunlu, e-posta önerilen
 *   - KVKK pasif kabul (login altında metin) + submit anında consent timestamp
 *
 * Verify routing buraya yönlendirir → submit sonrası /(tabs)'e geçer.
 * Vehicle nudge HomeScreen'in empty state'inde persistent banner olarak.
 */

const ProfileSetupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Ad soyad en az 2 karakter olmalı")
    .max(255, "Çok uzun"),
  email: z
    .string()
    .trim()
    .email("Geçerli bir e-posta gir")
    .or(z.literal(""))
    .optional(),
});

type ProfileSetupValues = z.infer<typeof ProfileSetupSchema>;

export default function ProfileSetupScreen() {
  const router = useRouter();
  const updateMe = useUpdateMe();
  const clear = useAuthStore((s) => s.clear);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ProfileSetupValues>({
    resolver: zodResolver(ProfileSetupSchema),
    defaultValues: { fullName: "", email: "" },
  });

  async function onSubmit(values: ProfileSetupValues) {
    setSubmitError(null);
    const trimmedEmail = values.email?.trim();
    try {
      await updateMe.mutateAsync({
        full_name: values.fullName.trim(),
        ...(trimmedEmail ? { email: trimmedEmail } : {}),
        // Industry-standard pasif kabul: login altında metin görünür,
        // submit anında consent timestamp DB'ye yazılır.
        kvkk_consented_at: new Date().toISOString(),
      });
      telemetry.track("auth_profile_setup_submitted", {
        app: "customer",
        has_email: Boolean(trimmedEmail),
      });
      router.replace("/(tabs)");
    } catch (error) {
      telemetry.captureError(error, { app: "customer", stage: "profile_setup" });
      const message =
        error instanceof Error ? error.message : "Kaydedilemedi, tekrar deneyin";
      setSubmitError(message);
    }
  }

  async function onLogout() {
    Alert.alert(
      "Çıkış yapmak istediğine emin misin?",
      "Profil tamamlanmadan çıkarsan tekrar giriş için OTP gerekir.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Çıkış yap",
          style: "destructive",
          onPress: async () => {
            await clear();
            router.replace("/(auth)/login");
          },
        },
      ],
    );
  }

  return (
    <Screen scroll>
      <View className="gap-6">
        <View className="gap-2">
          <Text variant="h1">Bir adım daha</Text>
          <Text tone="calm">
            Sana ulaşan ustaların seni tanıması için ad soyadını girelim.
            E-posta opsiyonel — fatura ve raporlar için kullanılır.
          </Text>
        </View>

        <View className="gap-4">
          <FormField
            control={control}
            name="fullName"
            label="Ad soyad"
            placeholder="Ali Veli"
            autoCapitalize="words"
            autoComplete="name"
          />
          <FormField
            control={control}
            name="email"
            label="E-posta (opsiyonel)"
            placeholder="ali@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        </View>

        {submitError ? <Text tone="panic">{submitError}</Text> : null}

        <View className="gap-2">
          <Button
            label={isSubmitting ? "Kaydediliyor..." : "Devam"}
            loading={isSubmitting}
            onPress={handleSubmit(onSubmit)}
            fullWidth
            size="lg"
          />
          <Button
            label="Çıkış yap"
            variant="outline"
            onPress={onLogout}
            fullWidth
          />
        </View>
      </View>
    </Screen>
  );
}
