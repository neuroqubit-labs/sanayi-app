import type { TechnicianCertificateKind } from "@naro/domain";
import { BackButton, Button, Screen, Text } from "@naro/ui";
import { type Href, useRouter } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";

import { useOnboardingStore } from "@/features/onboarding";
import { CertificateSection } from "@/features/profile/components/CertificateSection";
import { resolveRequiredCertKinds } from "@/features/shell";

export default function CertificatesStep() {
  const router = useRouter();
  const certificates = useOnboardingStore((s) => s.certificates);
  const provider_type = useOnboardingStore((s) => s.provider_type);
  const provider_mode = useOnboardingStore((s) => s.provider_mode);

  const requiredKinds = useMemo(
    () =>
      provider_type && provider_mode
        ? resolveRequiredCertKinds(provider_type, provider_mode)
        : (["identity"] as TechnicianCertificateKind[]),
    [provider_type, provider_mode],
  );

  const approvedKinds = new Set(
    certificates
      .filter((c) => c.status === "approved" || c.status === "pending")
      .map((c) => c.kind),
  );
  const missing = requiredKinds.filter((k) => !approvedKinds.has(k));
  const allUploaded = missing.length === 0;

  const openUpload = (kind: TechnicianCertificateKind) => {
    router.push({
      pathname: "/(modal)/sertifika-yukle",
      params: { kind, context: "onboarding" },
    });
  };

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-28">
      <View className="flex-row items-center gap-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="subtle">
            Adım 5 / 7 · Sertifikalar
          </Text>
          <Text variant="h2" tone="inverse">
            Doğrulama belgeleri
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            Seçtiğin rol + işletme modu için {requiredKinds.length} belge
            zorunlu. Hepsi yüklenmeden başvuru tamamlanmaz.
          </Text>
        </View>
      </View>

      <CertificateSection
        certificates={certificates}
        onUpload={openUpload}
        kinds={requiredKinds}
      />

      <View className="gap-2">
        <Button
          label={
            allUploaded
              ? "Devam et"
              : `${missing.length} belge daha gerekli`
          }
          size="lg"
          disabled={!allUploaded}
          variant={allUploaded ? "primary" : "outline"}
          onPress={() => router.push("/(onboarding)/service-area" as Href)}
          fullWidth
        />
      </View>
    </Screen>
  );
}
