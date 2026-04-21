import { BackButton, Button, Screen, Text } from "@naro/ui";
import { useRouter } from "expo-router";
import { TextInput, View } from "react-native";

import { useOnboardingStore } from "@/features/onboarding";

export default function BusinessStep() {
  const router = useRouter();
  const business = useOnboardingStore((s) => s.business);
  const updateBusiness = useOnboardingStore((s) => s.updateBusiness);

  const canContinue =
    (business.legal_name ?? "").trim().length > 2 &&
    (business.address ?? "").trim().length > 3;

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-28">
      <View className="flex-row items-center gap-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="subtle">
            Adım 2 / 5 · İşletme
          </Text>
          <Text variant="h2" tone="inverse">
            İşletme bilgileri
          </Text>
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            Vergi levhasındaki ünvan ve hizmet adresi. Daha sonra profilden güncellenebilir.
          </Text>
        </View>
      </View>

      <Field
        label="Ticari ünvan"
        value={business.legal_name ?? ""}
        onChangeText={(v) => updateBusiness({ legal_name: v })}
        placeholder="Örn. AutoPro Servis Ltd. Şti."
      />
      <Field
        label="Vergi numarası"
        value={business.tax_number ?? ""}
        onChangeText={(v) => updateBusiness({ tax_number: v })}
        placeholder="Opsiyonel ama önerilir"
        keyboardType="number-pad"
      />
      <Field
        label="Adres"
        value={business.address ?? ""}
        onChangeText={(v) => updateBusiness({ address: v })}
        placeholder="Cadde, mahalle ve numara"
        multiline
      />
      <Field
        label="İl / İlçe"
        value={business.city_district ?? ""}
        onChangeText={(v) => updateBusiness({ city_district: v })}
        placeholder="Örn. Sarıyer / İstanbul"
      />
      <Field
        label="Kısa slogan"
        value={business.tagline ?? ""}
        onChangeText={(v) => updateBusiness({ tagline: v })}
        placeholder="Örn. Motor · Elektrik · BMW Uzmanı"
      />

      <Button
        label="Devam et"
        size="lg"
        disabled={!canContinue}
        variant={canContinue ? "primary" : "outline"}
        onPress={() => router.push("/(onboarding)/capabilities")}
        fullWidth
      />
    </Screen>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "number-pad";
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: FieldProps) {
  return (
    <View className="gap-1.5">
      <Text variant="eyebrow" tone="subtle">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#66718d"
        multiline={multiline}
        keyboardType={keyboardType}
        className="rounded-[14px] border border-app-outline bg-app-surface px-4 py-3 text-app-text"
        style={multiline ? { minHeight: 80, textAlignVertical: "top" } : undefined}
      />
    </View>
  );
}
