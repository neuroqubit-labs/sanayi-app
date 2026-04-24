import type { CaseAttachment, CaseAttachmentKind } from "@naro/domain";
import { ActionSheetSurface, BottomSheetOverlay, Icon, Text } from "@naro/ui";
import {
  AudioWaveform,
  Camera,
  FileText,
  Film,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, View } from "react-native";

import { useAttachmentPicker } from "@/shared/attachments";
import type { AttachmentUploadTarget } from "@/shared/attachments";

export type AddAttachmentSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (attachment: CaseAttachment) => void;
  target: AttachmentUploadTarget;
};

type AttachmentOption = {
  kind: CaseAttachmentKind;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  defaultTitle: string;
};

const OPTIONS: AttachmentOption[] = [
  {
    kind: "photo",
    label: "Fotoğraf",
    description: "Kamera veya galeriden fotoğraf ekle",
    icon: Camera,
    color: "#83a7ff",
    defaultTitle: "Fotoğraf",
  },
  {
    kind: "video",
    label: "Video",
    description: "Kısa video kaydı yükle",
    icon: Film,
    color: "#0ea5e9",
    defaultTitle: "Video",
  },
  {
    kind: "audio",
    label: "Ses notu",
    description: "Sesli açıklama bırak",
    icon: AudioWaveform,
    color: "#2dd28d",
    defaultTitle: "Ses notu",
  },
  {
    kind: "document",
    label: "Belge",
    description: "PDF, fatura veya rapor",
    icon: FileText,
    color: "#f5b33f",
    defaultTitle: "Belge",
  },
];

function nextId() {
  return `attach-${Math.random().toString(36).slice(2, 10)}`;
}

export function AddAttachmentSheet({
  visible,
  onClose,
  onSubmit,
  target,
}: AddAttachmentSheetProps) {
  const { pickDocument, pickPhoto, pickVideo, status } =
    useAttachmentPicker(target);
  const busy = status === "picking" || status === "uploading";

  const handleSelect = async (option: AttachmentOption) => {
    const picks =
      option.kind === "photo"
        ? await pickPhoto("photo", option.defaultTitle, { max: 1 })
        : option.kind === "video"
          ? await pickVideo(option.defaultTitle)
          : option.kind === "audio"
            ? await pickDocument("audio", option.defaultTitle, {
                multiple: false,
                types: ["audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav"],
              })
            : await pickDocument("document", option.defaultTitle, {
                multiple: false,
                types: ["application/pdf", "image/*"],
              });

    const picked = picks[0];
    if (!picked) {
      return;
    }

    onSubmit({
      id: picked.id || nextId(),
      kind: picked.kind,
      title: picked.title || option.defaultTitle,
      subtitle: picked.subtitle,
      statusLabel: picked.statusLabel ?? "Yüklendi",
      asset: picked.asset ?? null,
    });
    onClose();
  };

  return (
    <BottomSheetOverlay
      visible={visible}
      onClose={onClose}
      accessibilityLabel="Dosya seçimi kapat"
    >
      <ActionSheetSurface
        title="Dosya ekle"
        description="Hangi tür dosyayı yüklemek istiyorsun?"
      >
        <View className="gap-2">
          {OPTIONS.map((option) => (
            <Pressable
              key={option.kind}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              onPress={() => void handleSelect(option)}
              disabled={busy}
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
              {busy ? (
                <Text
                  variant="caption"
                  tone="muted"
                  className="text-app-text-subtle text-[11px]"
                >
                  Yükleniyor
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      </ActionSheetSurface>
    </BottomSheetOverlay>
  );
}
