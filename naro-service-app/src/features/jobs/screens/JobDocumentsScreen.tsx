import type { CaseDocument } from "@naro/domain";
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
  AudioWaveform,
  FileText,
  Image as ImageIcon,
  MapPin,
  Plus,
  Video,
} from "lucide-react-native";
import { Pressable, View } from "react-native";

import { openMediaAsset } from "@/shared/media/openAsset";

import { useJobDetail } from "../api.case-live";
import { useEvidenceUploadStore } from "../evidence-upload-store";

const KIND_ICON = {
  photo: ImageIcon,
  video: Video,
  audio: AudioWaveform,
  location: MapPin,
  document: FileText,
  invoice: FileText,
  report: FileText,
} as const;

const KIND_COLOR = {
  photo: "#83a7ff",
  video: "#0ea5e9",
  audio: "#2dd28d",
  location: "#f5b33f",
  document: "#f5b33f",
  invoice: "#2dd28d",
  report: "#f5b33f",
} as const;

export function JobDocumentsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const caseId = id ?? "";
  const { data: caseItem } = useJobDetail(caseId);
  const openUpload = useEvidenceUploadStore((state) => state.open);

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

  const documents = caseItem.documents ?? [];

  return (
    <Screen scroll backgroundClassName="bg-app-bg" className="gap-5 pb-20">
      <View className="flex-row items-center gap-3">
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 gap-1">
          <Text variant="eyebrow" tone="subtle">
            Belgeler
          </Text>
          <Text variant="h2" tone="inverse" numberOfLines={1}>
            {caseItem.title}
          </Text>
        </View>
      </View>

      <View className="gap-3 rounded-[22px] border border-app-outline bg-app-surface px-4 py-4">
        <View className="gap-1">
          <Text variant="label" tone="inverse" className="text-[14px]">
            Görseller ve belgeler tamam mı?
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted leading-[18px]"
          >
            Her eklenen dosya müşteriye de yansır ve vaka timeline'ında görünür.
            Fatura disiplini puanını olumlu etkiler.
          </Text>
        </View>
        <Button
          label="Görsel Ekle"
          leftIcon={<Icon icon={Plus} size={14} color="#ffffff" />}
          onPress={() => openUpload({ caseId })}
        />
      </View>

      <SectionHeader
        title={`${documents.length} belge`}
        description={
          documents.length === 0
            ? "Bu vakada henüz belge yok"
            : "Tüm paylaşılan belgeler"
        }
      />

      {documents.length === 0 ? (
        <View className="items-center gap-2 rounded-[20px] border border-dashed border-app-outline bg-app-surface px-4 py-12">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-app-surface-2">
            <Icon icon={FileText} size={22} color="#6b7280" />
          </View>
          <Text variant="label" tone="inverse" className="text-center">
            Henüz belge eklenmemiş
          </Text>
          <Text tone="muted" className="text-center text-app-text-muted">
            İlk görseli ekle — kabul fotoğrafı, teşhis detayı veya fatura.
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          {documents.map((doc: CaseDocument) => {
            const IconCmp = KIND_ICON[doc.kind] ?? FileText;
            const color = KIND_COLOR[doc.kind] ?? "#83a7ff";
            return (
              <Pressable
                key={doc.id}
                accessibilityRole="button"
                accessibilityLabel={`${doc.title} belgesini aç`}
                onPress={() => void openMediaAsset(doc.asset)}
                className="flex-row items-center gap-3 rounded-[16px] border border-app-outline bg-app-surface px-4 py-3 active:bg-app-surface-2"
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-app-surface-2">
                  <Icon icon={IconCmp} size={18} color={color} />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text
                    variant="label"
                    tone="inverse"
                    className="text-[13px]"
                    numberOfLines={1}
                  >
                    {doc.title}
                  </Text>
                  {doc.subtitle ? (
                    <Text
                      variant="caption"
                      tone="muted"
                      className="text-app-text-muted text-[11px]"
                      numberOfLines={1}
                    >
                      {doc.subtitle}
                    </Text>
                  ) : null}
                  <Text
                    variant="caption"
                    tone="muted"
                    className="text-app-text-subtle text-[10px]"
                  >
                    {doc.source_label} · {doc.created_at_label}
                  </Text>
                </View>
                <TrustBadge label={doc.status_label} tone="info" />
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
