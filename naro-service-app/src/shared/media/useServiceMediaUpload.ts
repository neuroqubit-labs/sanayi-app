import type { MediaAsset, MediaOwnerKind, MediaPurpose } from "@naro/domain";
import {
  createExpoMediaPickerAdapter,
  useMediaUpload,
} from "@naro/mobile-core";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useMemo } from "react";

import { mediaApi } from "@/runtime";

type UploadSelectionKind = "photo" | "video" | "document" | "audio";

export type UploadedServiceMedia = {
  localUri: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
  durationSec?: number;
  asset: MediaAsset;
};

type PickAndUploadParams = {
  purpose: MediaPurpose;
  ownerKind?: MediaOwnerKind;
  ownerRef: string;
  selection: UploadSelectionKind;
  fallbackName: string;
  documentTypes?: string[];
  maxDurationSec?: number;
};

export function useServiceMediaUpload() {
  const picker = useMemo(
    () =>
      createExpoMediaPickerAdapter({
        documentPicker: DocumentPicker,
        imagePicker: ImagePicker,
      }),
    [],
  );
  const upload = useMediaUpload({ mediaApi, picker });

  const pickAndUpload = useCallback(
    async (
      params: PickAndUploadParams,
    ): Promise<UploadedServiceMedia | null> => {
      const pickOptions =
        params.selection === "photo"
          ? { max: 1 }
          : params.selection === "video"
            ? { maxDurationSec: params.maxDurationSec }
            : params.selection === "document"
              ? {
                  multiple: false,
                  types: params.documentTypes ?? ["application/pdf"],
                }
              : {
                  multiple: false,
                  types: ["audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav"],
                };

      const outcome = await upload.pickAndUpload({
        purpose: params.purpose,
        ownerKind: params.ownerKind,
        ownerId: params.ownerRef,
        selection: params.selection === "audio" ? "document" : params.selection,
        pickOptions,
        fallbackName: params.fallbackName,
      });

      if (!outcome || !outcome.pick) return null;

      return {
        localUri: outcome.pick.uri,
        name: outcome.pick.name ?? params.fallbackName,
        mimeType: outcome.result.asset.mime_type,
        sizeBytes: outcome.pick.sizeBytes,
        durationSec: outcome.pick.durationSec,
        asset: outcome.result.asset,
      };
    },
    [upload],
  );

  const isUploading =
    upload.status === "picking" ||
    upload.status === "validating" ||
    upload.status === "compressing" ||
    upload.status === "intent" ||
    upload.status === "transfer" ||
    upload.status === "complete";

  return {
    isUploading,
    error: upload.error,
    progress: upload.progress,
    cancel: upload.cancel,
    retry: upload.retry,
    pickAndUpload,
  };
}
