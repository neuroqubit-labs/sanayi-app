import type { TechnicianCertificateKind } from "@naro/domain";
import { BackButton, Button, Screen, Text } from "@naro/ui";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { useOnboardingStore } from "@/features/onboarding";
import { CertificateSection } from "@/features/profile/components/CertificateSection";

export default function CertificatesStep() {
  const router = useRouter();
  const certificates = useOnboardingStore((s) => s.certificates);

  const hasIdentity = certificates.some((c) => c.kind === "identity");
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
            Adım 4 / 5 · Sertifikalar
          </Text>
          <Text variant="h2" tone="inverse">
            Doğrulama belgeleri
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            En az kimlik belgesi gerekli. Diğerleri verified_level'ı yükseltir,
            sonra da yüklenebilir.
          </Text>
        </View>
      </View>

      <CertificateSection
        certificates={certificates}
        onUpload={openUpload}
      />

      <View className="gap-2">
        <Button
          label={hasIdentity ? "Devam et" : "Kimlik belgesi gerekli"}
          size="lg"
          disabled={!hasIdentity}
          variant={hasIdentity ? "primary" : "outline"}
          onPress={() => router.push("/(onboarding)/review")}
          fullWidth
        />
        <Button
          label="Sertifikayı sonra yükle"
          variant="outline"
          onPress={() => router.push("/(onboarding)/review")}
          fullWidth
        />
      </View>
    </Screen>
  );
}
