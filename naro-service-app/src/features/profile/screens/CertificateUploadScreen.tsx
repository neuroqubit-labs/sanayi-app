import type {
  TechnicianCertificate,
  TechnicianCertificateKind,
} from "@naro/domain";
import { PRIMARY_TECHNICIAN_ID } from "@naro/mobile-core";
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
import { FileText, Image as ImageIcon, Upload } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";

import type { CertificateKindMeta } from "@/features/profile/components/CertificateSection";
import { ALL_CERT_KINDS, CERT_KIND_META } from "@/features/profile/certCatalog";
import { useOnboardingStore } from "@/features/onboarding";
import { useTechnicianProfileStore } from "@/features/technicians";
import { useServiceMediaUpload } from "@/shared/media/useServiceMediaUpload";

type FileChoice = {
  name: string;
  mime: string;
  uri: string;
  asset: TechnicianCertificate["asset"];
};

export function CertificateUploadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string; context?: string }>();
  const initialKind = (params.kind as TechnicianCertificateKind | undefined) ??
    "identity";
  const context = params.context === "onboarding" ? "onboarding" : "profile";
  const addCertificate = useTechnicianProfileStore(
    (state) => state.addCertificate,
  );
  const addOnboardingCertificate = useOnboardingStore((state) => state.addCertificate);
  const { isUploading, pickAndUpload } = useServiceMediaUpload();

  const [kind, setKind] = useState<TechnicianCertificateKind>(initialKind);
  const [title, setTitle] = useState(
    CERT_KIND_META[initialKind]?.label ?? "",
  );
  const [expires, setExpires] = useState("");
  const [file, setFile] = useState<FileChoice | null>(null);

  const canSubmit = title.trim().length > 1 && file !== null && !isUploading;

  const handlePick = async (pref: "photo" | "pdf") => {
    try {
      const uploaded = await pickAndUpload({
        purpose: "technician_certificate",
        ownerRef: PRIMARY_TECHNICIAN_ID,
        selection: pref === "photo" ? "photo" : "document",
        fallbackName: `${kind}-${pref === "photo" ? "foto" : "belge"}-${Date.now()}`,
        documentTypes: ["application/pdf"],
      });

      if (!uploaded) {
        return;
      }

      setFile({
        name: uploaded.name,
        mime: uploaded.asset.mime_type,
        uri: uploaded.localUri,
        asset: uploaded.asset,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Belge yüklenirken bir sorun oluştu.";
      Alert.alert("Yükleme başarısız", message);
    }
  };

  const handleSubmit = () => {
    if (!canSubmit || !file) return;
    const cert: TechnicianCertificate = {
      id: `cert-${Date.now()}`,
      technician_id: PRIMARY_TECHNICIAN_ID,
      kind,
      title: title.trim(),
      file_url: file.asset?.download_url ?? file.uri,
      mime_type: file.mime,
      asset: file.asset,
      uploaded_at: new Date().toISOString(),
      verified_at: null,
      expires_at: expires.trim().length >= 8 ? expires.trim() : null,
      status: "pending",
      reviewer_note: null,
    };
    if (context === "onboarding") {
      addOnboardingCertificate(cert);
    } else {
      addCertificate(cert);
    }
    Alert.alert(
      "Yüklendi",
      "Sertifikan incelemeye alındı. Onaylandığında bildirim alacaksın.",
      [{ text: "Tamam", onPress: () => router.back() }],
    );
  };

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-28">
      <View className="flex-row items-center gap-3">
        <BackButton variant="close" onPress={() => router.back()} />
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="subtle">
            Sertifika
          </Text>
          <Text variant="h2" tone="inverse">
            Belge Yükle
          </Text>
        </View>
      </View>

      <View className="gap-3">
        <SectionHeader
          title="Belge türü"
          description="Hangi doğrulama belgesini yüklüyorsun?"
        />
        <View className="gap-2">
          {ALL_CERT_KINDS.map((k) => {
            const meta = CERT_KIND_META[k];
            return (
              <KindRow
                key={k}
                meta={meta}
                active={kind === k}
                onPress={() => {
                  setKind(k);
                  const isLabelStale =
                    !title ||
                    ALL_CERT_KINDS.some(
                      (other) => CERT_KIND_META[other]?.label === title,
                    );
                  if (isLabelStale) {
                    setTitle(meta.label);
                  }
                }}
              />
            );
          })}
        </View>
      </View>

      <View className="gap-3">
        <SectionHeader title="Başlık" />
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Örn. Vergi Levhası 2026"
          placeholderTextColor="#66718d"
          className="rounded-[14px] border border-app-outline bg-app-surface px-4 py-3 text-app-text"
        />
      </View>

      <View className="gap-3">
        <SectionHeader
          title="Geçerlilik tarihi (opsiyonel)"
          description="GG.AA.YYYY veya ISO format. Süresi biten belgeler için hatırlatma gönderilir."
        />
        <TextInput
          value={expires}
          onChangeText={setExpires}
          placeholder="31.01.2027"
          placeholderTextColor="#66718d"
          className="rounded-[14px] border border-app-outline bg-app-surface px-4 py-3 text-app-text"
        />
      </View>

      <View className="gap-3">
        <SectionHeader title="Dosya" description="Fotoğraf veya PDF yükle" />
        {file ? (
          <View className="flex-row items-center gap-3 rounded-[16px] border border-app-success/30 bg-app-success-soft px-4 py-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-app-success/20">
              <Icon
                icon={file.mime.startsWith("image") ? ImageIcon : FileText}
                size={16}
                color="#2dd28d"
              />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="label" tone="inverse" className="text-[13px]">
                {file.name}
              </Text>
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[11px]"
              >
                {file.mime}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setFile(null)}
              className="rounded-full border border-app-outline px-3 py-1 active:opacity-80"
            >
              <Text variant="caption" tone="muted" className="text-[11px]">
                Kaldır
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              onPress={() => void handlePick("photo")}
              disabled={isUploading}
              className="flex-1 items-center gap-2 rounded-[16px] border border-dashed border-app-outline-strong bg-app-surface px-4 py-4 active:opacity-80"
            >
              <Icon icon={ImageIcon} size={18} color="#83a7ff" />
              <Text variant="label" tone="inverse" className="text-[13px]">
                Fotoğraf
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void handlePick("pdf")}
              disabled={isUploading}
              className="flex-1 items-center gap-2 rounded-[16px] border border-dashed border-app-outline-strong bg-app-surface px-4 py-4 active:opacity-80"
            >
              <Icon icon={FileText} size={18} color="#83a7ff" />
              <Text variant="label" tone="inverse" className="text-[13px]">
                PDF
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <View className="gap-2 rounded-[16px] border border-app-outline bg-app-surface-2 px-4 py-3">
        <View className="flex-row items-center gap-2">
          <Icon icon={Upload} size={13} color="#0ea5e9" />
          <Text variant="eyebrow" tone="subtle">
            Bilgi
          </Text>
        </View>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[12px] leading-[17px]"
        >
          Belgeler admin tarafından ortalama 24 saat içinde incelenir.
          Onaylandığında profilinde "Doğrulandı" rozeti aktif olur.
        </Text>
        <View className="flex-row flex-wrap gap-1">
          <TrustBadge label="Güvenli" tone="success" />
          <TrustBadge label="KVKK" tone="info" />
        </View>
      </View>

      <Button
        label={isUploading ? "Yükleniyor..." : "Yükle"}
        size="lg"
        disabled={!canSubmit}
        variant={canSubmit ? "primary" : "outline"}
        onPress={handleSubmit}
        fullWidth
      />
    </Screen>
  );
}

function KindRow({
  meta,
  active,
  onPress,
}: {
  meta: CertificateKindMeta;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`flex-row items-center gap-3 rounded-[14px] border px-4 py-3 active:opacity-85 ${
        active
          ? "border-brand-500/40 bg-brand-500/10"
          : "border-app-outline bg-app-surface"
      }`}
    >
      <View className="h-8 w-8 items-center justify-center rounded-full bg-app-surface-2">
        <Icon icon={meta.icon} size={14} color={active ? "#f45f25" : "#83a7ff"} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="label" tone="inverse" className="text-[13px]">
          {meta.label}
        </Text>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[11px]"
        >
          {meta.description}
        </Text>
      </View>
    </Pressable>
  );
}
