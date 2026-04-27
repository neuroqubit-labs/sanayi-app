import { formatPhoneDisplay } from "@naro/mobile-core";
import {
  BackButton,
  FlowSummaryRow,
  Icon,
  PlatformTrustCard,
  PremiumListRow,
  Screen,
  Text,
  TrustBadge,
} from "@naro/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  BadgeCheck,
  ChevronRight,
  CreditCard,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Receipt,
  Shield,
  Smartphone,
  Trash2,
} from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, Switch, View } from "react-native";

import { useNotificationPreferencesStore } from "@/features/notifications";
import { useMe, useUpdateMe } from "@/features/user";

import { EditFieldSheet } from "../components/EditFieldSheet";
import {
  DEVICE_SESSIONS,
  INVOICES,
  LEGAL_DOCUMENTS,
  NOTIFICATION_PREFERENCES,
  PAYMENT_METHODS,
  SUPPORT_TOPICS,
  findProfileMenuItem,
} from "../data/fixtures";
import { useUserProfileStore, type UserProfileField } from "../user-store";

type SectionComponent = () => JSX.Element;

type EditTarget = {
  field: UserProfileField;
  title: string;
  label: string;
  description?: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
};

const EDIT_TARGETS: Record<UserProfileField, EditTarget> = {
  fullName: {
    field: "fullName",
    title: "Ad soyad",
    label: "Ad soyad",
    description: "Fatura ve servis kayıtlarında bu ad görünür.",
    autoCapitalize: "words",
  },
  phone: {
    field: "phone",
    title: "Telefon numarası",
    label: "Telefon",
    description:
      "Telefon değişikliği OTP ile yapılır — yakında ayrı bir akış gelir.",
    keyboardType: "phone-pad",
    autoCapitalize: "none",
  },
  email: {
    field: "email",
    title: "E-posta adresi",
    label: "E-posta",
    description: "Fatura ve raporlar buraya iletilir.",
    keyboardType: "email-address",
    autoCapitalize: "none",
  },
};

function KisiselBilgilerSection() {
  const router = useRouter();
  const fullName = useUserProfileStore((state) => state.fullName);
  const phone = useUserProfileStore((state) => state.phone);
  const email = useUserProfileStore((state) => state.email);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const updateMe = useUpdateMe();
  // Sayfa açılırken /users/me'yi tetikle — store güncel kalsın.
  useMe();

  const values: Record<UserProfileField, string> = { fullName, phone, email };
  const phoneDisplay = phone ? formatPhoneDisplay(phone) : "";

  return (
    <View className="gap-4">
      <View className="gap-3">
        <Text variant="h3" tone="inverse">
          Kimlik bilgileri
        </Text>
        <FlowSummaryRow
          label="Ad soyad"
          value={fullName}
          onEdit={() => setEditTarget(EDIT_TARGETS.fullName)}
        />
        <FlowSummaryRow
          label="Telefon"
          value={phoneDisplay}
          helperText="Giriş yaparken bu numaraya OTP gönderilir."
        />
        <FlowSummaryRow
          label="E-posta"
          value={email}
          helperText="Fatura ve raporlar buraya iletilir."
          onEdit={() => setEditTarget(EDIT_TARGETS.email)}
        />
      </View>

      <View className="gap-3">
        <Text variant="h3" tone="inverse">
          Güvenlik
        </Text>
        <PremiumListRow
          title="Parola / OTP davranışı"
          subtitle="Yeni cihazda her zaman OTP iste"
          leading={<RoundIcon icon={Shield} color="#2dd28d" />}
          badge={<TrustBadge label="Aktif" tone="success" />}
        />
        <PremiumListRow
          title="Bağlı cihazlar"
          subtitle={`${DEVICE_SESSIONS.length} aktif oturum`}
          leading={<RoundIcon icon={Smartphone} color="#83a7ff" />}
          onPress={() => router.push("/profil/cihaz")}
        />
      </View>

      <EditFieldSheet
        visible={editTarget !== null}
        title={editTarget?.title ?? ""}
        description={editTarget?.description}
        label={editTarget?.label ?? ""}
        value={editTarget ? values[editTarget.field] : ""}
        keyboardType={editTarget?.keyboardType}
        autoCapitalize={editTarget?.autoCapitalize}
        onClose={() => setEditTarget(null)}
        onSubmit={async (next) => {
          if (!editTarget) return;
          const trimmed = next.trim();
          try {
            if (editTarget.field === "fullName") {
              await updateMe.mutateAsync({ full_name: trimmed });
            } else if (editTarget.field === "email") {
              await updateMe.mutateAsync({ email: trimmed });
            }
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Güncellenemedi.";
            Alert.alert("Güncellenemedi", message);
          }
        }}
      />
    </View>
  );
}

function OdemeYontemleriSection() {
  return (
    <View className="gap-4">
      <Text variant="h3" tone="inverse">
        Kayıtlı kartlar
      </Text>

      <View className="gap-3">
        {PAYMENT_METHODS.map((method) => (
          <View
            key={method.id}
            className={[
              "gap-3 rounded-[24px] border px-4 py-4",
              method.isDefault
                ? "border-brand-500/40 bg-brand-500/10"
                : "border-app-outline bg-app-surface",
            ].join(" ")}
          >
            <View className="flex-row items-center gap-3">
              <RoundIcon icon={CreditCard} color="#0ea5e9" />
              <View className="flex-1 gap-0.5">
                <Text variant="label" tone="inverse">
                  {method.brand} •••• {method.last4}
                </Text>
                <Text variant="caption" tone="muted" className="text-app-text-muted">
                  {method.holder} · {method.expires}
                </Text>
              </View>
              {method.isDefault ? (
                <TrustBadge label="Varsayılan" tone="accent" />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Kartı kaldır"
                  onPress={() => Alert.alert("Kartı kaldır", "Mock akış")}
                >
                  <Icon icon={Trash2} size={16} color="#ff6b6b" />
                </Pressable>
              )}
            </View>
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Yeni kart ekle"
          onPress={() => Alert.alert("Yeni kart", "Kart ekleme akışı yakında")}
          className="flex-row items-center gap-3 rounded-[24px] border border-dashed border-app-outline bg-app-surface px-4 py-4 active:bg-app-surface-2"
        >
          <RoundIcon icon={Plus} color="#83a7ff" />
          <View className="flex-1 gap-0.5">
            <Text variant="label" tone="inverse">
              Yeni kart ekle
            </Text>
            <Text variant="caption" tone="muted" className="text-app-text-muted">
              Ödeme altyapısı korumalıdır, kart bilgileri Naro'da saklanmaz.
            </Text>
          </View>
          <Icon icon={ChevronRight} size={18} color="#6f7b97" />
        </Pressable>
      </View>

      <PlatformTrustCard />
    </View>
  );
}

function FaturalarSection() {
  return (
    <View className="gap-3">
      <Text variant="h3" tone="inverse">
        Geçmiş faturalar
      </Text>
      {INVOICES.map((invoice) => (
        <PremiumListRow
          key={invoice.id}
          title={invoice.title}
          subtitle={`${invoice.subtitle} · ${invoice.dateLabel}`}
          leading={<RoundIcon icon={Receipt} color="#2dd28d" />}
          trailing={
            <Text variant="label" tone="success">
              {invoice.amountLabel}
            </Text>
          }
        />
      ))}
    </View>
  );
}

function BildirimlerSection() {
  const values = useNotificationPreferencesStore((state) => state.values);
  const setValue = useNotificationPreferencesStore((state) => state.setValue);

  return (
    <View className="gap-3">
      <Text variant="h3" tone="inverse">
        Bildirim tercihleri
      </Text>
      <Text tone="muted" className="text-app-text-muted">
        Acil sinyallere dokunma — önemsiz olanları sessize al.
      </Text>

      <View className="gap-3">
        {NOTIFICATION_PREFERENCES.map((pref) => (
          <View
            key={pref.key}
            className="flex-row items-center gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-3.5"
          >
            <View className="flex-1 gap-0.5">
              <Text variant="label" tone="inverse">
                {pref.title}
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted"
              >
                {pref.description}
              </Text>
            </View>
            <Switch
              value={values[pref.key]}
              onValueChange={(next) => setValue(pref.key, next)}
              trackColor={{ false: "#2a2f3a", true: "#0ea5e9" }}
              thumbColor={values[pref.key] ? "#ffffff" : "#f5f7ff"}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function CihazSection() {
  return (
    <View className="gap-3">
      <Text variant="h3" tone="inverse">
        Bağlı cihazlar
      </Text>
      <Text tone="muted" className="text-app-text-muted">
        Tanımadığın bir oturum görürsen hemen kapat.
      </Text>

      <View className="gap-3">
        {DEVICE_SESSIONS.map((device) => (
          <PremiumListRow
            key={device.id}
            title={device.title}
            subtitle={`${device.subtitle} · ${device.lastSeenLabel}`}
            leading={<RoundIcon icon={Smartphone} color="#83a7ff" />}
            badge={
              device.isCurrent ? (
                <TrustBadge label="Bu cihaz" tone="success" />
              ) : undefined
            }
            trailing={
              device.isCurrent ? undefined : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Oturumu sonlandır"
                  onPress={() =>
                    Alert.alert(
                      "Oturumu sonlandır",
                      `${device.title} oturumu kapatılsın mı?`,
                      [
                        { text: "Vazgeç", style: "cancel" },
                        { text: "Sonlandır", style: "destructive" },
                      ],
                    )
                  }
                >
                  <Text variant="caption" tone="critical">
                    Sonlandır
                  </Text>
                </Pressable>
              )
            }
          />
        ))}
      </View>
    </View>
  );
}

function DestekSection() {
  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text variant="h3" tone="inverse">
          Sık sorulan
        </Text>
        <Text tone="muted" className="text-app-text-muted">
          Uygulama içi cevaplar — aradığını bulamazsan canlı destek bir tık
          uzakta.
        </Text>
      </View>

      <View className="gap-3">
        {SUPPORT_TOPICS.map((topic) => (
          <View
            key={topic.id}
            className="gap-2 rounded-[22px] border border-app-outline bg-app-surface px-4 py-3.5"
          >
            <Text variant="label" tone="inverse">
              {topic.title}
            </Text>
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted"
            >
              {topic.answer}
            </Text>
          </View>
        ))}
      </View>

      <View className="gap-3">
        <PremiumListRow
          title="Canlı destek"
          subtitle="Ortalama 2 dakikada yanıt"
          leading={<RoundIcon icon={MessageCircle} color="#2dd28d" />}
          onPress={() => Alert.alert("Canlı destek", "Mesajlaşma yakında")}
        />
        <PremiumListRow
          title="Telefonla ara"
          subtitle="+90 850 000 00 00 · Hafta içi 09–18"
          leading={<RoundIcon icon={Phone} color="#83a7ff" />}
          onPress={() => {}}
        />
        <PremiumListRow
          title="E-posta ile yaz"
          subtitle="destek@naro.app"
          leading={<RoundIcon icon={Mail} color="#f5f7ff" />}
          onPress={() => {}}
        />
      </View>
    </View>
  );
}

function GuvenSection() {
  return (
    <View className="gap-4">
      <PlatformTrustCard />

      <View className="gap-3">
        <Text variant="h3" tone="inverse">
          Şeffaflık ve ihtilaf
        </Text>
        <PremiumListRow
          title="Servis değerlendirme sistemi"
          subtitle="Puan, yorum ve itibar nasıl hesaplanıyor"
          leading={<RoundIcon icon={BadgeCheck} color="#2dd28d" />}
        />
        <PremiumListRow
          title="Koruma altında ödeme"
          subtitle="Escrow benzeri model, iş onayıyla açılır"
          leading={<RoundIcon icon={Shield} color="#0ea5e9" />}
        />
        <PremiumListRow
          title="Anlaşmazlık süreci"
          subtitle="Kayıtlar + destek ekibi iletişimi; taraflar kendi kayıtlarına erişir"
          leading={<RoundIcon icon={FileText} color="#f5f7ff" />}
        />
      </View>
    </View>
  );
}

function BelgelerSection() {
  return (
    <View className="gap-3">
      <Text variant="h3" tone="inverse">
        Yasal belgeler
      </Text>
      {LEGAL_DOCUMENTS.map((document) => (
        <PremiumListRow
          key={document.id}
          title={document.title}
          subtitle={document.description}
          leading={<RoundIcon icon={document.icon} color="#f5f7ff" />}
          onPress={() => Alert.alert(document.title, "Belge mini sayfası yakında")}
        />
      ))}
    </View>
  );
}

const SECTION_MAP: Record<string, SectionComponent> = {
  "kisisel-bilgiler": KisiselBilgilerSection,
  "odeme-yontemleri": OdemeYontemleriSection,
  faturalar: FaturalarSection,
  bildirimler: BildirimlerSection,
  cihaz: CihazSection,
  destek: DestekSection,
  guven: GuvenSection,
  belgeler: BelgelerSection,
};

export function ProfileDetailScreen() {
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section: string }>();
  const sectionKey = section ?? "destek";
  const meta = findProfileMenuItem(sectionKey);
  const SectionBody = SECTION_MAP[sectionKey] ?? DestekSection;

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-24">
      <View className="flex-row items-center gap-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="subtle">
            Profil
          </Text>
          <Text variant="h2" tone="inverse">
            {meta?.title ?? "Profil detayı"}
          </Text>
        </View>
      </View>

      {meta ? (
        <Text tone="muted" className="text-app-text-muted">
          {meta.subtitle}
        </Text>
      ) : null}

      <SectionBody />
    </Screen>
  );
}

function RoundIcon({
  icon,
  color,
}: {
  icon: Parameters<typeof Icon>[0]["icon"];
  color: string;
}) {
  return (
    <View className="h-11 w-11 items-center justify-center rounded-full border border-app-outline bg-app-surface-2">
      <Icon icon={icon} size={18} color={color} />
    </View>
  );
}
