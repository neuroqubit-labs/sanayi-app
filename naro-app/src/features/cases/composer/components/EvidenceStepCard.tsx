import type { CaseAttachment, CaseAttachmentKind } from "@naro/domain";
import { Icon, PhotoGrid, Text, TrustBadge } from "@naro/ui";
import {
  AudioWaveform,
  Camera,
  Image as ImageIcon,
  Mic,
  PlayCircle,
  Video,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, View } from "react-native";

import { useAttachmentPicker } from "@/shared/attachments";
import type { AttachmentDraft } from "@/shared/attachments";

import type { EvidenceStep } from "../data/evidenceSteps";

export type EvidenceStepCardProps = {
  step: EvidenceStep;
  attachments: CaseAttachment[];
  ownerRef: string;
  onAdd: (drafts: AttachmentDraft[]) => void;
  onRemove: (id: string) => void;
};

type ActionDef = {
  kind: CaseAttachmentKind | "gallery";
  label: string;
  icon: LucideIcon;
};

function buildActions(kinds: CaseAttachmentKind[]): ActionDef[] {
  const actions: ActionDef[] = [];
  if (kinds.includes("photo")) {
    actions.push({ kind: "photo", label: "Fotoğraf", icon: Camera });
  }
  if (kinds.includes("video")) {
    actions.push({ kind: "video", label: "Video", icon: Video });
  }
  if (kinds.includes("audio")) {
    actions.push({ kind: "audio", label: "Ses kaydı", icon: Mic });
  }
  if (kinds.includes("photo") || kinds.includes("video")) {
    actions.push({ kind: "gallery", label: "Galeri", icon: ImageIcon });
  }
  return actions;
}

export function EvidenceStepCard({
  step,
  attachments,
  ownerRef,
  onAdd,
  onRemove,
}: EvidenceStepCardProps) {
  const { pickPhoto, pickVideo, recordAudio, status } = useAttachmentPicker({
    purpose: "case_evidence_photo",
    ownerRef,
  });

  const stepAttachments = useMemo(
    () => attachments.filter((item) => item.id.startsWith(`${step.id}:`)),
    [attachments, step.id],
  );

  const photos = stepAttachments.filter((a) => a.kind === "photo");
  const videos = stepAttachments.filter((a) => a.kind === "video");
  const audios = stepAttachments.filter((a) => a.kind === "audio");

  const photoGridItems = useMemo(
    () =>
      photos.map((attachment) => ({
        id: attachment.id,
        uri:
          "localUri" in attachment
            ? (attachment as AttachmentDraft).localUri
            : undefined,
        label: attachment.subtitle,
      })),
    [photos],
  );

  const isBelowMin =
    step.minPhotos !== undefined && stepAttachments.length < step.minPhotos;

  const isSinglePhotoOnly =
    step.kinds.length === 1 && step.kinds[0] === "photo";

  const remaining = (picked: number) =>
    step.maxPhotos
      ? Math.max(0, step.maxPhotos - stepAttachments.length)
      : picked;

  const namespace = (drafts: AttachmentDraft[]): AttachmentDraft[] =>
    drafts.map((draft, index) => ({
      ...draft,
      id: `${step.id}:${draft.id}:${index}`,
    }));

  const handlePhoto = async () => {
    const picked = await pickPhoto("photo", step.title);
    if (picked.length === 0) return;
    onAdd(namespace(picked.slice(0, remaining(picked.length))));
  };

  const handleVideo = async () => {
    const picked = await pickVideo(step.title);
    if (picked.length === 0) return;
    onAdd(namespace(picked.slice(0, remaining(picked.length))));
  };

  const handleAudio = async () => {
    const picked = await recordAudio(step.title);
    if (picked.length === 0) return;
    onAdd(namespace(picked.slice(0, remaining(picked.length))));
  };

  const handleGallery = async () => {
    // Galeri mock — fotoğraf picker'ını yeniden kullanır
    await handlePhoto();
  };

  const handleAction = (kind: CaseAttachmentKind | "gallery") => {
    switch (kind) {
      case "photo":
        return handlePhoto();
      case "video":
        return handleVideo();
      case "audio":
        return handleAudio();
      case "gallery":
        return handleGallery();
      default:
        return undefined;
    }
  };

  const actions = buildActions(step.kinds);

  return (
    <View className="gap-3 rounded-[22px] border border-app-outline bg-app-surface-2 px-4 py-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text variant="label" tone="inverse">
              {step.title}
            </Text>
            {step.required ? (
              <TrustBadge label="Zorunlu" tone="warning" />
            ) : (
              <TrustBadge label="Opsiyonel" tone="neutral" />
            )}
            {stepAttachments.length > 0 ? (
              <TrustBadge
                label={`${stepAttachments.length}${
                  step.maxPhotos ? ` / ${step.maxPhotos}` : ""
                }`}
                tone="success"
              />
            ) : null}
          </View>
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            {step.hint}
          </Text>
        </View>
      </View>

      {isSinglePhotoOnly ? (
        <PhotoGrid
          items={photoGridItems}
          onAdd={handlePhoto}
          onRemove={onRemove}
          min={step.minPhotos}
          max={step.maxPhotos}
          disabled={status === "uploading"}
        />
      ) : (
        <>
          {photos.length > 0 ? (
            <PhotoGrid
              items={photoGridItems}
              onAdd={handlePhoto}
              onRemove={onRemove}
              min={step.minPhotos}
              max={step.maxPhotos}
              disabled={status === "uploading"}
            />
          ) : null}

          <View className="gap-2">
            {videos.map((video) => (
              <MediaRow
                key={video.id}
                icon={Video}
                iconColor="#83a7ff"
                label={video.title}
                meta={video.subtitle ?? "Video"}
                onRemove={() => onRemove(video.id)}
              />
            ))}
            {audios.map((audio) => (
              <MediaRow
                key={audio.id}
                icon={AudioWaveform}
                iconColor="#2dd28d"
                label={audio.title}
                meta={audio.subtitle ?? "Ses kaydı"}
                playable
                onRemove={() => onRemove(audio.id)}
              />
            ))}
          </View>

          <View className="flex-row flex-wrap gap-2">
            {actions.map((action) => (
              <Pressable
                key={action.kind}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                onPress={() => handleAction(action.kind)}
                disabled={status === "uploading"}
                className="flex-1 min-w-[120px] flex-row items-center justify-center gap-2 rounded-[16px] border border-app-outline bg-app-surface px-3 py-2.5 active:bg-app-surface-3"
              >
                <Icon icon={action.icon} size={16} color="#83a7ff" />
                <Text variant="label" tone="inverse" className="text-[13px]">
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {isBelowMin ? (
        <Text variant="caption" tone="warning">
          En az {step.minPhotos} kanıt gerekli.
        </Text>
      ) : null}
    </View>
  );
}

type MediaRowProps = {
  icon: LucideIcon;
  iconColor: string;
  label: string;
  meta: string;
  playable?: boolean;
  onRemove: () => void;
};

function MediaRow({
  icon,
  iconColor,
  label,
  meta,
  playable,
  onRemove,
}: MediaRowProps) {
  return (
    <View className="flex-row items-center gap-3 rounded-[16px] border border-app-outline bg-app-surface px-3 py-2.5">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-app-surface-2">
        <Icon icon={icon} size={16} color={iconColor} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="label" tone="inverse" className="text-[13px]">
          {label}
        </Text>
        <Text variant="caption" tone="muted" className="text-app-text-subtle">
          {meta}
        </Text>
      </View>
      {playable ? (
        <Icon icon={PlayCircle} size={20} color="#83a7ff" />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Kaldır"
        onPress={onRemove}
        hitSlop={8}
        className="h-7 w-7 items-center justify-center rounded-full border border-app-outline bg-app-surface-2"
      >
        <Icon icon={X} size={12} color="#6f7b97" />
      </Pressable>
    </View>
  );
}
