import { zodResolver } from "@hookform/resolvers/zod";
import { Button, FormField, Screen, Text } from "@naro/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { View } from "react-native";
import { z } from "zod";

import { telemetry } from "@/runtime";
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
      // BE OtpVerifyResponse zenginleştirilmiş — ek round-trip yok.
      // is_new_user + profile_completed + approval_status ile routing matrisi.
      const res = await authApi.verifyOtp({ delivery_id: deliveryId, code: values.code });
      await setTokens(res.access_token, res.refresh_token);
      // setApprovalStatus null kabul ediyor; UserApprovalStatus'tan
      // ApprovalStatus type'ına cast — domain UserApprovalStatusSchema =
      // pending/active/suspended/rejected; auth store ApprovalStatus =
      // pending/active/suspended (rejected → pending UI'da). Şimdilik
      // direkt pass — rejected olursa pending fall-back.
      const approvalForStore =
        res.approval_status === "rejected" ? "pending" : res.approval_status;
      await setApprovalStatus(approvalForStore);

      telemetry.track("auth_verified", {
        app: "service",
        is_new_user: res.is_new_user,
        profile_completed: res.profile_completed,
        approval_status: res.approval_status,
      });

      // Routing matrisi:
      //   !profile_completed                                → onboarding/provider-type
      //   profile_completed && approval_status !== "active" → onboarding/pending
      //   profile_completed && approval_status === "active" → /(tabs)
      if (!res.profile_completed) {
        router.replace("/(onboarding)/provider-type");
      } else if (res.approval_status !== "active") {
        router.replace("/(onboarding)/pending");
      } else {
        router.replace("/(tabs)");
      }
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
