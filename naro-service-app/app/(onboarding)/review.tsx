import { BackButton, Button, Icon, Screen, Text, TrustBadge } from "@naro/ui";
import { useRouter } from "expo-router";
import { BadgeCheck, CheckCircle2 } from "lucide-react-native";
import { View } from "react-native";

import { useOnboardingStore } from "@/features/onboarding";
import {
  PROVIDER_TYPE_META,
  useTechnicianProfileStore,
} from "@/features/technicians";

export default function ReviewStep() {
  const router = useRouter();
  const onboarding = useOnboardingStore();
  const updateField = useTechnicianProfileStore((s) => s.updateField);
  const updateBusiness = useTechnicianProfileStore((s) => s.updateBusiness);
  const setCapability = useTechnicianProfileStore((s) => s.setCapability);
  const addCertificate = useTechnicianProfileStore((s) => s.addCertificate);
  const setProviderMode = useTechnicianProfileStore((s) => s.setProviderMode);
  const setActiveProviderType = useTechnicianProfileStore(
    (s) => s.setActiveProviderType,
  );
  const reset = useOnboardingStore((s) => s.reset);

  const meta = onboarding.provider_type
    ? PROVIDER_TYPE_META[onboarding.provider_type]
    : null;

  const handleSubmit = () => {
    if (!onboarding.provider_type) return;
    updateField("provider_type", onboarding.provider_type);
    setActiveProviderType(onboarding.provider_type);
    if (onboarding.provider_mode) {
      setProviderMode(onboarding.provider_mode);
    }
    if (onboarding.business.legal_name || onboarding.business.address) {
      updateBusiness({
        legal_name: onboarding.business.legal_name ?? "",
        tax_number: onboarding.business.tax_number,
        address: onboarding.business.address ?? "",
        city_district: onboarding.business.city_district,
      });
    }
    if (onboarding.business.tagline) {
      updateField("tagline", onboarding.business.tagline);
    }
    (Object.keys(onboarding.capabilities) as (keyof typeof onboarding.capabilities)[]).forEach(
      (key) => {
        const value = onboarding.capabilities[key];
        if (value !== undefined) {
          setCapability(key, value);
        }
      },
    );
    onboarding.certificates.forEach((cert) => addCertificate(cert));
    reset();
    router.replace("/(onboarding)/pending");
  };

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-28">
      <View className="flex-row items-center gap-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="subtle">
            Adım 7 / 7 · Özet
          </Text>
          <Text variant="h2" tone="inverse">
            Başvurunu gözden geçir
          </Text>
        </View>
      </View>

      <SummaryCard title="Sağlayıcı tipi">
        <Text variant="label" tone="inverse" className="text-[15px]">
          {meta?.label ?? "Seçilmedi"}
        </Text>
        {meta ? (
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            {meta.description}
          </Text>
        ) : null}
      </SummaryCard>

      <SummaryCard title="İşletme">
        <SummaryRow label="Ünvan" value={onboarding.business.legal_name} />
        <SummaryRow label="Adres" value={onboarding.business.address} />
        <SummaryRow
          label="Bölge"
          value={onboarding.business.city_district}
        />
        <SummaryRow label="Vergi" value={onboarding.business.tax_number} />
        <SummaryRow label="Slogan" value={onboarding.business.tagline} />
      </SummaryCard>

      <SummaryCard title="Hizmet kapsamı">
        <View className="flex-row flex-wrap gap-2">
          {(
            Object.entries(onboarding.capabilities) as [string, boolean][]
          )
            .filter(([, v]) => v)
            .map(([key]) => (
              <TrustBadge
                key={key}
                label={CAPABILITY_LABEL[key] ?? key}
                tone="accent"
              />
            ))}
          {Object.values(onboarding.capabilities).every((v) => !v) ? (
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-subtle"
            >
              Seçim yok
            </Text>
          ) : null}
        </View>
      </SummaryCard>

      <SummaryCard title={`Sertifikalar (${onboarding.certificates.length})`}>
        {onboarding.certificates.length > 0 ? (
          <View className="gap-1.5">
            {onboarding.certificates.map((cert) => (
              <View
                key={cert.id}
                className="flex-row items-center gap-2"
              >
                <Icon icon={BadgeCheck} size={13} color="#2dd28d" />
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-[12px] text-app-text"
                >
                  {cert.title}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text variant="caption" tone="muted" className="text-app-text-subtle">
            Henüz belge yok
          </Text>
        )}
      </SummaryCard>

      <View className="flex-row items-start gap-3 rounded-[16px] border border-app-info/30 bg-app-info-soft px-4 py-3">
        <Icon icon={CheckCircle2} size={16} color="#4aa8ff" />
        <View className="flex-1 gap-0.5">
          <Text variant="label" tone="inverse" className="text-[13px]">
            Başvuru gönderildiğinde
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[12px] leading-[16px]"
          >
            Admin incelemesi 1-2 iş günü sürer. Onay bildirimi SMS + uygulamadan
            gelir. O zamana kadar profili gezerek eksikleri tamamlayabilirsin.
          </Text>
        </View>
      </View>

      <Button
        label="Başvuruyu gönder"
        size="lg"
        disabled={!onboarding.provider_type}
        variant={onboarding.provider_type ? "primary" : "outline"}
        onPress={handleSubmit}
        fullWidth
      />
    </Screen>
  );
}

const CAPABILITY_LABEL: Record<string, string> = {
  insurance_case_handler: "Sigorta dosyası",
  on_site_repair: "Yerinde onarım",
  towing_coordination: "Çekici",
  valet_service: "Valet",
};

function SummaryCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2 rounded-[20px] border border-app-outline bg-app-surface px-4 py-3.5">
      <Text variant="eyebrow" tone="subtle">
        {title}
      </Text>
      <View className="gap-1.5">{children}</View>
    </View>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  if (!value) return null;
  return (
    <View className="flex-row items-start gap-2">
      <Text variant="caption" tone="muted" className="w-20 text-app-text-subtle text-[11px]">
        {label}
      </Text>
      <Text
        variant="caption"
        tone="muted"
        className="flex-1 text-[12px] text-app-text"
      >
        {value}
      </Text>
    </View>
  );
}
