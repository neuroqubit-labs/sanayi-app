import type { MediaAsset, MediaPurpose } from "@naro/domain";
import {
  createExpoMediaPickerAdapter,
  uploadAsset,
} from "@naro/mobile-core";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";

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

const picker = createExpoMediaPickerAdapter({
  documentPicker: DocumentPicker,
  imagePicker: ImagePicker,
});

export function useServiceMediaUpload() {
  const [isUploading, setIsUploading] = useState(false);

  const pickAndUpload = useCallback(
    async (params: {
      purpose: MediaPurpose;
      ownerRef: string;
      selection: UploadSelectionKind;
      fallbackName: string;
      documentTypes?: string[];
      maxDurationSec?: number;
    }): Promise<UploadedServiceMedia | null> => {
      setIsUploading(true);

      try {
        const picks =
          params.selection === "photo"
            ? await picker.pickPhoto({ max: 1 })
            : params.selection === "video"
              ? await picker.pickVideo({ maxDurationSec: params.maxDurationSec })
              : await picker.pickDocument({
                  multiple: false,
                  types:
                    params.selection === "audio"
                      ? ["audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav"]
                      : params.documentTypes ?? ["application/pdf"],
                });

        const picked = picks[0];
        if (!picked) {
          return null;
        }

        const uploaded = await uploadAsset({
          mediaApi,
          purpose: params.purpose,
          ownerRef: params.ownerRef,
          source: {
            uri: picked.uri,
            name: picked.name ?? params.fallbackName,
            mimeType: picked.mimeType ?? "application/octet-stream",
            sizeBytes: picked.sizeBytes,
          },
        });

        return {
          localUri: picked.uri,
          name: picked.name ?? params.fallbackName,
          mimeType: uploaded.asset.mime_type,
          sizeBytes: picked.sizeBytes,
          durationSec: picked.durationSec,
          asset: uploaded.asset,
        };
      } finally {
        setIsUploading(false);
      }
    },
    [],
  );

  return {
    isUploading,
    pickAndUpload,
  };
}
