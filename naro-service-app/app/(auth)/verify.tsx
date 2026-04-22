import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@naro/mobile-core";
import { Button, FormField, Screen, Text } from "@naro/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { View } from "react-native";
import { z } from "zod";

import { apiClient, telemetry } from "@/runtime";
import { authApi } from "@/services/auth/api";
import { useAuthStore, type ApprovalStatus } from "@/services/auth/store";

/**
 * BE `/technicians/me/shell-config` minimal parse — admission_status alanı
 * kritik. Diğer alanlar useShellConfig içinde Zustand'tan türetiliyor; bu
 * sadece verify sonrası ilk admission status hydration için.
 */
const AdmissionShellSchema = z.object({
  admission_status: z.enum(["pending", "active", "suspended"]),
});

async function fetchLiveAdmissionStatus(): Promise<ApprovalStatus> {
  try {
    const raw = await apiClient("/technicians/me/shell-config");
    const parsed = AdmissionShellSchema.parse(raw);
    return parsed.admission_status;
  } catch (err) {
    // 404 = technician_profile yok → yeni kayıt, onboarding'e ihtiyaç var.
    // Diğer hatalar telemetry'e log; pending fallback ile onboarding akışı çalışır.
    if (!(err instanceof ApiError) || err.status !== 404) {
      telemetry.captureError(err, {
        app: "service",
        stage: "shell_config_after_verify",
      });
    }
    return "pending";
  }
}

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
  const { setTokens, setApprovalStatus } = useAuthStore();
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
      const approvalStatus = await fetchLiveAdmissionStatus();
      await setApprovalStatus(approvalStatus);
      telemetry.track("auth_verified", { app: "service", approvalStatus });
      router.replace(
        approvalStatus === "active" ? "/(tabs)" : "/(onboarding)/pending",
      );
    } catch (error) {
      telemetry.captureError(error, { app: "service", stage: "verify_otp" });
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
