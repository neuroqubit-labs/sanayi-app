import { ActionSheetSurface, BottomSheetOverlay, Icon, Text } from "@naro/ui";
import {
  AudioWaveform,
  Camera,
  FileText,
  Film,
  type LucideIcon,
} from "lucide-react-native";
import { Alert, Pressable, View } from "react-native";

import { useEvidenceUploadStore } from "../evidence-upload-store";
import { useJobEvidenceUploader } from "../useJobEvidenceUploader";

type EvidenceOption = {
  kind: "photo" | "video" | "audio" | "document";
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  note: string;
};

const OPTIONS: EvidenceOption[] = [
  {
    kind: "photo",
    label: "Fotoğraf",
    description: "Aracın mevcut durumu, hasar, parça detay",
    icon: Camera,
    color: "#83a7ff",
    note: "Fotoğraf paylaşıldı",
  },
  {
    kind: "video",
    label: "Video",
    description: "Kısa çalışma videosu veya tespit kaydı",
    icon: Film,
    color: "#0ea5e9",
    note: "Video paylaşıldı",
  },
  {
    kind: "audio",
    label: "Ses notu",
    description: "Sesli teknik açıklama",
    icon: AudioWaveform,
    color: "#2dd28d",
    note: "Ses notu paylaşıldı",
  },
  {
    kind: "document",
    label: "Belge",
    description: "Rapor, fatura, poliçe, ekspertiz",
    icon: FileText,
    color: "#f5b33f",
    note: "Belge paylaşıldı",
  },
];

export function TechnicianEvidenceUploadSheet() {
  const caseId = useEvidenceUploadStore((state) => state.caseId);
  const taskId = useEvidenceUploadStore((state) => state.taskId);
  const close = useEvidenceUploadStore((state) => state.close);
  const { isUploading, uploadEvidence } = useJobEvidenceUploader(
    caseId ?? "",
    taskId ?? undefined,
  );

  const isOpen = Boolean(caseId);

  const handleSelect = async (option: EvidenceOption) => {
    if (!caseId) return;
    try {
      await uploadEvidence(option.kind, option.note);
      close();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Dosya yüklenirken bir sorun oluştu.";
      Alert.alert("Yükleme başarısız", message);
    }
  };

  return (
    <BottomSheetOverlay
      visible={isOpen}
      onClose={close}
      accessibilityLabel="Görsel yüklemeyi kapat"
    >
      <ActionSheetSurface
        title="Görsel ekle"
        description="Hangi tür dosya yükleyeceksin? Thread'e ve dosya feed'ine eklenir."
      >
        <View className="gap-2">
          {OPTIONS.map((option) => (
            <Pressable
              key={option.kind}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              onPress={() => void handleSelect(option)}
              disabled={isUploading}
              className="flex-row items-center gap-3 rounded-[16px] border border-app-outline bg-app-surface px-4 py-3 active:bg-app-surface-2"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-app-surface-2">
                <Icon icon={option.icon} size={18} color={option.color} />
              </View>
              <View className="flex-1 gap-0.5">
                <Text variant="label" tone="inverse" className="text-[14px]">
                  {option.label}
                </Text>
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-muted text-[12px]"
                >
                  {option.description}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ActionSheetSurface>
    </BottomSheetOverlay>
  );
}
