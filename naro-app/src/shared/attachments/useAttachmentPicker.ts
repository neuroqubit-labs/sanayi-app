import {
  createExpoMediaPickerAdapter,
  type MediaPickerAdapter,
} from "@naro/mobile-core";
import type { CaseAttachmentKind } from "@naro/domain";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

import type {
  AttachmentDraft,
  AttachmentUploadTarget,
  PickDocumentOptions,
  PickPhotoOptions,
  PickVideoOptions,
  RecordAudioOptions,
} from "./types";
import { ATTACHMENT_KIND_LABEL } from "./types";
import { uploadAttachment } from "./uploader";

type PickerStatus = "idle" | "picking" | "uploading" | "error";

/**
 * Abstract attachment picker. Real implementations are injected at boot time
 * once `expo-image-picker` / `expo-document-picker` / `expo-av` are added.
 * Until then the hook returns mock URIs so flows can be exercised end-to-end.
 */
export type AttachmentPickerAdapter = MediaPickerAdapter;

let adapter: AttachmentPickerAdapter = createExpoMediaPickerAdapter({
  documentPicker: DocumentPicker,
  imagePicker: ImagePicker,
});

export function setAttachmentPickerAdapter(nextAdapter: AttachmentPickerAdapter) {
  adapter = nextAdapter;
}

export function useAttachmentPicker(target: AttachmentUploadTarget) {
  const [status, setStatus] = useState<PickerStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const pickPhoto = useCallback(
    async (
      kind: CaseAttachmentKind = "photo",
      title?: string,
      options?: PickPhotoOptions,
    ): Promise<AttachmentDraft[]> => {
      setStatus("picking");
      setError(null);

      try {
        const picks = await adapter.pickPhoto(options);

        if (picks.length === 0) {
          setStatus("idle");
          return [];
        }

        setStatus("uploading");

        const drafts = await Promise.all(
          picks.map(async (pick) => {
            const uploaded = await uploadAttachment({
              localUri: pick.uri,
              mimeType: pick.mimeType,
              sizeBytes: pick.sizeBytes,
              target,
            });

            const draft: AttachmentDraft = {
              id: uploaded.id,
              kind,
              title: title ?? ATTACHMENT_KIND_LABEL[kind],
              subtitle: uploaded.sizeLabel,
              statusLabel: "Yüklendi",
              localUri: pick.uri,
              remoteUri: uploaded.remoteUri,
              mimeType: uploaded.mimeType,
              sizeLabel: uploaded.sizeLabel,
              capturedAt: new Date().toISOString(),
              asset: uploaded.asset,
            };

            return draft;
          }),
        );

        setStatus("idle");
        return drafts;
      } catch (reason) {
        const message =
          reason instanceof Error
            ? reason.message
            : "Fotoğraf eklenirken bir sorun oluştu.";
        setStatus("error");
        setError(message);
        Alert.alert("Fotoğraf eklenemedi", message);
        return [];
      }
    },
    [target],
  );

  const pickDocument = useCallback(
    async (
      kind: CaseAttachmentKind = "document",
      title?: string,
      options?: PickDocumentOptions,
    ): Promise<AttachmentDraft[]> => {
      setStatus("picking");
      setError(null);

      try {
        const picks = await adapter.pickDocument(options);

        if (picks.length === 0) {
          setStatus("idle");
          return [];
        }

        setStatus("uploading");

        const drafts = await Promise.all(
          picks.map(async (pick) => {
            const uploaded = await uploadAttachment({
              localUri: pick.uri,
              mimeType: pick.mimeType,
              sizeBytes: pick.sizeBytes,
              target,
              filename: pick.name,
            });

            const draft: AttachmentDraft = {
              id: uploaded.id,
              kind,
              title: title ?? pick.name ?? ATTACHMENT_KIND_LABEL[kind],
              subtitle: uploaded.sizeLabel,
              statusLabel: "Yüklendi",
              localUri: pick.uri,
              remoteUri: uploaded.remoteUri,
              mimeType: uploaded.mimeType,
              sizeLabel: uploaded.sizeLabel,
              capturedAt: new Date().toISOString(),
              asset: uploaded.asset,
            };

            return draft;
          }),
        );

        setStatus("idle");
        return drafts;
      } catch (reason) {
        const message =
          reason instanceof Error
            ? reason.message
            : "Belge eklenirken bir sorun oluştu.";
        setStatus("error");
        setError(message);
        Alert.alert("Belge eklenemedi", message);
        return [];
      }
    },
    [target],
  );

  const pickVideo = useCallback(
    async (
      title?: string,
      options?: PickVideoOptions,
    ): Promise<AttachmentDraft[]> => {
      setStatus("picking");
      setError(null);

      try {
        const picks = await adapter.pickVideo(options);
        if (picks.length === 0) {
          setStatus("idle");
          return [];
        }

        setStatus("uploading");

        const drafts = await Promise.all(
          picks.map(async (pick) => {
            const uploaded = await uploadAttachment({
              localUri: pick.uri,
              mimeType: pick.mimeType,
              sizeBytes: pick.sizeBytes,
              target,
            });

            const draft: AttachmentDraft = {
              id: uploaded.id,
              kind: "video",
              title: title ?? ATTACHMENT_KIND_LABEL.video,
              subtitle: pick.durationSec
                ? `${pick.durationSec}s · ${uploaded.sizeLabel}`
                : uploaded.sizeLabel,
              statusLabel: "Yüklendi",
              localUri: pick.uri,
              remoteUri: uploaded.remoteUri,
              mimeType: uploaded.mimeType,
              sizeLabel: uploaded.sizeLabel,
              capturedAt: new Date().toISOString(),
              asset: uploaded.asset,
            };

            return draft;
          }),
        );

        setStatus("idle");
        return drafts;
      } catch (reason) {
        const message =
          reason instanceof Error
            ? reason.message
            : "Video eklenirken bir sorun oluştu.";
        setStatus("error");
        setError(message);
        Alert.alert("Video eklenemedi", message);
        return [];
      }
    },
    [target],
  );

  const recordAudio = useCallback(
    async (
      title?: string,
      options?: RecordAudioOptions,
    ): Promise<AttachmentDraft[]> => {
      setStatus("picking");
      setError(null);

      try {
        let picks: Awaited<ReturnType<AttachmentPickerAdapter["recordAudio"]>>;
        try {
          picks = await adapter.recordAudio(options);
        } catch {
          picks = [];
        }
        if (picks.length === 0) {
          picks = await adapter.pickDocument({
            multiple: false,
            types: ["audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav"],
          });
        }
        if (picks.length === 0) {
          setStatus("idle");
          return [];
        }

        setStatus("uploading");

        const drafts = await Promise.all(
          picks.map(async (pick) => {
            const uploaded = await uploadAttachment({
              localUri: pick.uri,
              mimeType: pick.mimeType,
              sizeBytes: pick.sizeBytes,
              target,
            });

            const draft: AttachmentDraft = {
              id: uploaded.id,
              kind: "audio",
              title: title ?? ATTACHMENT_KIND_LABEL.audio,
              subtitle: pick.durationSec
                ? `${pick.durationSec}s kayıt`
                : "Ses kaydı",
              statusLabel: "Yüklendi",
              localUri: pick.uri,
              remoteUri: uploaded.remoteUri,
              mimeType: uploaded.mimeType,
              sizeLabel: uploaded.sizeLabel,
              capturedAt: new Date().toISOString(),
              asset: uploaded.asset,
            };

            return draft;
          }),
        );

        setStatus("idle");
        return drafts;
      } catch (reason) {
        const message =
          reason instanceof Error
            ? reason.message
            : "Ses kaydı eklenirken bir sorun oluştu.";
        setStatus("error");
        setError(message);
        Alert.alert("Ses kaydı eklenemedi", message);
        return [];
      }
    },
    [target],
  );

  return {
    status,
    error,
    pickPhoto,
    pickDocument,
    pickVideo,
    recordAudio,
  };
}
