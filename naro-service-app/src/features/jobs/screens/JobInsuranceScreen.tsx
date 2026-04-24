import {
  BackButton,
  Button,
  Icon,
  Screen,
  SectionHeader,
  Text,
  TrustBadge,
} from "@naro/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CheckCircle2,
  FileText,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react-native";
import { Alert, View } from "react-native";

import { useJobDetail } from "../api.live";

const STATUS_FLOW = ["drafted", "submitted", "accepted", "paid"] as const;

const STATUS_LABEL: Record<string, string> = {
  drafted: "Taslak",
  submitted: "Gönderildi",
  accepted: "Kabul edildi",
  paid: "Ödendi",
  rejected: "Reddedildi",
};

const STATUS_TONE: Record<
  string,
  "success" | "warning" | "critical" | "accent" | "info" | "neutral"
> = {
  drafted: "neutral",
  submitted: "warning",
  accepted: "accent",
  paid: "success",
  rejected: "critical",
};

export function JobInsuranceScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: caseItem } = useJobDetail(id ?? "");

  if (!caseItem) {
    return (
      <Screen backgroundClassName="bg-app-bg" className="flex-1 justify-center gap-4">
        <Text variant="h2" tone="inverse">
          Vaka bulunamadı
        </Text>
        <Button label="Geri" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  const claim = caseItem.insurance_claim;

  if (!claim) {
    return (
      <Screen backgroundClassName="bg-app-bg" className="flex-1 justify-center gap-4 px-6">
        <Text variant="h2" tone="inverse" className="text-center">
          Bu vakada sigorta dosyası yok
        </Text>
        <Text tone="muted" className="text-center text-app-text-muted">
          Yalnızca usta tarafından açılmış hasar dosyalarında sigorta akışı görünür.
        </Text>
        <Button label="Geri" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  const currentStatusIndex = STATUS_FLOW.indexOf(claim.status as "drafted");
  const nextStatus = currentStatusIndex >= 0 && currentStatusIndex < STATUS_FLOW.length - 1
    ? STATUS_FLOW[currentStatusIndex + 1]
    : null;

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-20">
      <View className="flex-row items-center gap-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="subtle">
            Sigorta Dosyası
          </Text>
          <Text variant="h2" tone="inverse" numberOfLines={1}>
            {caseItem.title}
          </Text>
        </View>
      </View>

      <View className="gap-3 rounded-[22px] border border-brand-500/30 bg-brand-500/10 px-4 py-4">
        <View className="flex-row items-center gap-2">
          <Icon icon={ShieldCheck} size={16} color="#0ea5e9" />
          <Text variant="eyebrow" tone="subtle">
            Durum
          </Text>
          <View className="ml-auto">
            <TrustBadge
              label={STATUS_LABEL[claim.status] ?? claim.status}
              tone={STATUS_TONE[claim.status] ?? "neutral"}
            />
          </View>
        </View>
        <View className="flex-row items-center gap-1">
          {STATUS_FLOW.map((status, index) => {
            const isDone = index <= currentStatusIndex;
            const isCurrent = index === currentStatusIndex;
            return (
              <View key={status} className="flex-1 items-center gap-1">
                <View
                  className={`h-2 w-full rounded-full ${
                    isDone ? "bg-brand-500" : "bg-app-surface-2"
                  }`}
                />
                <Text
                  variant="caption"
                  tone={isCurrent ? "accent" : isDone ? "muted" : "muted"}
                  className="text-[10px]"
                >
                  {STATUS_LABEL[status]}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <SectionHeader title="Poliçe bilgisi" />
      <View className="gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-4">
        <InfoRow label="Sigorta şirketi" value={claim.insurer} icon={ShieldCheck} />
        <InfoRow
          label="Teminat türü"
          value={claim.coverage_kind === "kasko" ? "Kasko" : "Trafik"}
          icon={FileText}
        />
        <InfoRow label="Poliçe numarası" value={claim.policy_number} icon={FileText} />
        {claim.claim_amount_estimate ? (
          <InfoRow
            label="Tahmini bedel"
            value={`₺${claim.claim_amount_estimate.toLocaleString("tr-TR")}`}
            icon={FileText}
          />
        ) : null}
      </View>

      {claim.customer_name || claim.customer_phone ? (
        <>
          <SectionHeader title="Müşteri iletişim" />
          <View className="gap-3 rounded-[20px] border border-app-outline bg-app-surface px-4 py-4">
            {claim.customer_name ? (
              <InfoRow label="Ad soyad" value={claim.customer_name} icon={User} />
            ) : null}
            {claim.customer_phone ? (
              <InfoRow label="Telefon" value={claim.customer_phone} icon={Phone} />
            ) : null}
          </View>
        </>
      ) : null}

      <View className="gap-2">
        {nextStatus ? (
          <Button
            label={`Durumu '${STATUS_LABEL[nextStatus]}' olarak güncelle`}
            leftIcon={<Icon icon={CheckCircle2} size={14} color="#ffffff" />}
            onPress={() =>
              Alert.alert(
                "Sigorta durumu",
                `Dosya durumu "${STATUS_LABEL[nextStatus]}" olarak güncellenecek. (Mock — gerçek sigorta API entegrasyonu v2.)`,
              )
            }
          />
        ) : (
          <Text
            variant="caption"
            tone="muted"
            className="text-center text-app-text-subtle text-[11px]"
          >
            Dosya son aşamasında.
          </Text>
        )}
      </View>
    </Screen>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: typeof ShieldCheck;
}) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-app-surface-2">
        <Icon icon={icon} size={14} color="#83a7ff" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="eyebrow" tone="subtle">
          {label}
        </Text>
        <Text variant="label" tone="inverse" className="text-[13px]">
          {value}
        </Text>
      </View>
    </View>
  );
}
