import type { CaseAttachmentKind } from "@naro/domain";
import {
  createExpoMediaPickerAdapter,
  useMediaUpload,
  type MediaPickerAdapter,
} from "@naro/mobile-core";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";

import { mediaApi } from "@/runtime";

import type {
  AttachmentDraft,
  AttachmentUploadTarget,
  PickDocumentOptions,
  PickPhotoOptions,
  PickVideoOptions,
  RecordAudioOptions,
} from "./types";
import { ATTACHMENT_KIND_LABEL } from "./types";

type PickerStatus = "idle" | "picking" | "uploading" | "error";

/**
 * Yazılabilir picker adapter — test/mock için setAttachmentPickerAdapter
 * ile değiştirilebilir. Prod'da expo image + document picker kullanılır.
 */
export type AttachmentPickerAdapter = MediaPickerAdapter;

let overrideAdapter: AttachmentPickerAdapter | null = null;

export function setAttachmentPickerAdapter(
  nextAdapter: AttachmentPickerAdapter | null,
) {
  overrideAdapter = nextAdapter;
}

function formatSize(bytes?: number): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return "—";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function useAttachmentPicker(target: AttachmentUploadTarget) {
  const [status, setStatus] = useState<PickerStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const defaultPicker = useMemo(
    () =>
      createExpoMediaPickerAdapter({
        documentPicker: DocumentPicker,
        imagePicker: ImagePicker,
      }),
    [],
  );
  const picker = overrideAdapter ?? defaultPicker;

  const upload = useMediaUpload({ mediaApi, picker });

  const pickFlow = useCallback(
    async (
      selection: "photo" | "video" | "document" | "audio",
      kind: CaseAttachmentKind,
      title: string | undefined,
      fallbackMime: string,
      pickOptions?: unknown,
    ): Promise<AttachmentDraft[]> => {
      setStatus("picking");
      setError(null);

      try {
        const outcome = await upload.pickAndUpload({
          purpose: target.purpose,
          ownerId: target.ownerRef,
          selection: selection === "audio" ? "document" : selection,
          pickOptions: pickOptions as never,
        });

        if (!outcome) {
          // peekError() senkron ref okur; upload.error React state closure
          // capture ettiğinden await sonrası hep null görünüyordu.
          const failure = upload.peekError();
          if (failure) {
            setStatus("error");
            setError(failure.message);
            Alert.alert(
              `${ATTACHMENT_KIND_LABEL[kind]} eklenemedi`,
              failure.message,
            );
            return [];
          }
          setStatus("idle");
          return [];
        }

        const pick = outcome.pick;
        const asset = outcome.result.asset;
        const draft: AttachmentDraft = {
          id: asset.id,
          kind,
          title: title ?? pick?.name ?? ATTACHMENT_KIND_LABEL[kind],
          subtitle: pick?.durationSec
            ? `${pick.durationSec}s · ${formatSize(pick?.sizeBytes)}`
            : formatSize(pick?.sizeBytes),
          statusLabel: "Yüklendi",
          localUri: pick?.uri ?? "",
          remoteUri: asset.download_url ?? pick?.uri ?? "",
          mimeType: asset.mime_type ?? pick?.mimeType ?? fallbackMime,
          sizeLabel: formatSize(pick?.sizeBytes),
          capturedAt: new Date().toISOString(),
          asset,
        };

        setStatus("idle");
        return [draft];
      } catch (reason) {
        const message =
          reason instanceof Error
            ? reason.message
            : `${ATTACHMENT_KIND_LABEL[kind]} eklenirken bir sorun oluştu.`;
        setStatus("error");
        setError(message);
        Alert.alert(`${ATTACHMENT_KIND_LABEL[kind]} eklenemedi`, message);
        return [];
      }
    },
    [target.ownerRef, target.purpose, upload],
  );

  const pickPhoto = useCallback(
    (
      kind: CaseAttachmentKind = "photo",
      title?: string,
      options?: PickPhotoOptions,
    ) => pickFlow("photo", kind, title, "image/jpeg", options),
    [pickFlow],
  );

  const pickDocument = useCallback(
    (
      kind: CaseAttachmentKind = "document",
      title?: string,
      options?: PickDocumentOptions,
    ) =>
      pickFlow("document", kind, title, "application/pdf", {
        multiple: false,
        types: options?.types ?? ["application/pdf"],
      }),
    [pickFlow],
  );

  const pickVideo = useCallback(
    (title?: string, options?: PickVideoOptions) =>
      pickFlow("video", "video", title, "video/mp4", options),
    [pickFlow],
  );

  const recordAudio = useCallback(
    (title?: string, _options?: RecordAudioOptions) =>
      pickFlow("document", "audio", title, "audio/mp4", {
        multiple: false,
        types: ["audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav"],
      }),
    [pickFlow],
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
