import { MediaAssetSchema, type MediaAsset, type MediaPurpose } from "@naro/domain";

import type { ApiClient } from "./api";
import { z } from "./env";

const UploadIntentResponseSchema = z.object({
  upload_id: z.string(),
  asset_id: z.string(),
  object_key: z.string(),
  upload_method: z.literal("single_put"),
  upload_url: z.string().url(),
  upload_headers: z.record(z.string()),
  expires_at: z.string(),
});

const MediaAssetEnvelopeSchema = z.object({
  asset: MediaAssetSchema,
});

function toBackendMediaPurpose(purpose: MediaPurpose) {
  return purpose === "technician_cert" ? "technician_certificate" : purpose;
}

export type MediaApi = ReturnType<typeof createMediaApi>;

export type MediaUploadProgress =
  | { phase: "intent" }
  | { phase: "transfer" }
  | { phase: "complete" };

export type MediaUploadResult = {
  asset: MediaAsset;
  uploadId: string;
  objectKey: string;
};

export type MediaAssetReadPreference = "download" | "preview";

export type MediaFileSource = {
  uri: string;
  name?: string;
  mimeType?: string;
  sizeBytes?: number;
  checksumSha256?: string;
};

export type PickPhotoOptions = {
  multiple?: boolean;
  max?: number;
  quality?: number;
};

export type PickDocumentOptions = {
  multiple?: boolean;
  types?: string[];
};

export type PickVideoOptions = {
  maxDurationSec?: number;
};

export type RecordAudioOptions = {
  maxDurationSec?: number;
};

export type PickedMediaFile = {
  uri: string;
  name?: string;
  mimeType?: string;
  sizeBytes?: number;
  durationSec?: number;
};

export type MediaPickerAdapter = {
  pickPhoto: (options?: PickPhotoOptions) => Promise<PickedMediaFile[]>;
  pickDocument: (options?: PickDocumentOptions) => Promise<PickedMediaFile[]>;
  pickVideo: (options?: PickVideoOptions) => Promise<PickedMediaFile[]>;
  recordAudio: (options?: RecordAudioOptions) => Promise<PickedMediaFile[]>;
};

export class MediaUploadError extends Error {
  constructor(
    message: string,
    readonly kind: "prepare" | "intent" | "transfer" | "complete",
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "MediaUploadError";
  }
}

export function createMediaApi(apiClient: ApiClient) {
  return {
    createUploadIntent: (payload: {
      purpose: MediaPurpose;
      owner_ref: string;
      filename: string;
      mime_type: string;
      size_bytes: number;
      checksum_sha256?: string;
    }) =>
      apiClient("/media/uploads/intents", {
        method: "POST",
        body: {
          ...payload,
          purpose: toBackendMediaPurpose(payload.purpose),
        },
        parse: (value) => UploadIntentResponseSchema.parse(value),
      }),
    completeUpload: (uploadId: string, payload: { etag?: string; checksum_sha256?: string }) =>
      apiClient(`/media/uploads/${uploadId}/complete`, {
        method: "POST",
        body: payload,
        parse: (value) => MediaAssetEnvelopeSchema.parse(value).asset,
      }),
    getAsset: (assetId: string) =>
      apiClient(`/media/assets/${assetId}`, {
        parse: (value) => MediaAssetEnvelopeSchema.parse(value).asset,
      }),
    deleteAsset: (assetId: string) =>
      apiClient(`/media/assets/${assetId}`, {
        method: "DELETE",
        parse: (value) => MediaAssetEnvelopeSchema.parse(value).asset,
      }),
  };
}

export function selectMediaAssetUrl(
  asset: MediaAsset,
  preference: MediaAssetReadPreference = "download",
) {
  if (preference === "preview") {
    return asset.preview_url ?? asset.download_url ?? null;
  }

  return asset.download_url ?? asset.preview_url ?? null;
}

export async function ensureMediaAssetForRead(params: {
  mediaApi: MediaApi;
  asset: MediaAsset;
  preference?: MediaAssetReadPreference;
  forceRefresh?: boolean;
}): Promise<MediaAsset> {
  const { asset, forceRefresh, mediaApi, preference = "download" } = params;
  const shouldRefresh =
    forceRefresh ?? asset.visibility === "private"
      ? true
      : !selectMediaAssetUrl(asset, preference);

  if (!shouldRefresh) {
    return asset;
  }

  return mediaApi.getAsset(asset.id);
}

function inferFilename(source: MediaFileSource) {
  const directName = source.name?.trim();
  if (directName) {
    return directName;
  }

  const withoutQuery = source.uri.split("?")[0] ?? source.uri;
  const fallback = withoutQuery.split("/").pop()?.trim();
  return fallback || `upload-${Date.now()}`;
}

async function readSourceBlob(source: MediaFileSource) {
  if (typeof console !== "undefined" && console.warn) {
    console.warn("[upload] readSourceBlob start", {
      uriPrefix: source.uri.slice(0, 32),
      protocol: source.uri.split(":")[0],
    });
  }
  try {
    const response = await fetch(source.uri);
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[upload] readSourceBlob fetched", { ok: response.ok, status: response.status });
    }
    if (!response.ok) {
      throw new Error(`failed to read local file ${response.status}`);
    }

    const blob = await response.blob();
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[upload] readSourceBlob blob", { size: blob.size, type: blob.type });
    }
    return blob;
  } catch (error) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[upload] readSourceBlob error", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
    throw new MediaUploadError("Unable to prepare media file", "prepare", error);
  }
}

export async function uploadAsset(params: {
  mediaApi: MediaApi;
  purpose: MediaPurpose;
  ownerRef: string;
  source: MediaFileSource;
  onProgress?: (progress: MediaUploadProgress) => void;
}): Promise<MediaUploadResult> {
  const { mediaApi, onProgress, ownerRef, purpose, source } = params;
  const filename = inferFilename(source);
  const mimeType = source.mimeType ?? "application/octet-stream";
  const fileBlob = await readSourceBlob(source);
  const sizeBytes = source.sizeBytes ?? fileBlob.size;

  onProgress?.({ phase: "intent" });

  if (typeof console !== "undefined" && console.warn) {
    console.warn("[upload] createIntent start", { filename, mimeType, sizeBytes });
  }

  let intent: z.infer<typeof UploadIntentResponseSchema>;
  try {
    intent = await mediaApi.createUploadIntent({
      purpose,
      owner_ref: ownerRef,
      filename,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      checksum_sha256: source.checksumSha256,
    });
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[upload] createIntent ok", { uploadId: intent.upload_id });
    }
  } catch (error) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[upload] createIntent error", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
    throw new MediaUploadError("Unable to create upload intent", "intent", error);
  }

  onProgress?.({ phase: "transfer" });

  if (typeof console !== "undefined" && console.warn) {
    console.warn("[upload] transfer start", {
      urlHost: (() => {
        try {
          return new URL(intent.upload_url).host;
        } catch {
          return intent.upload_url.slice(0, 48);
        }
      })(),
      headerKeys: Object.keys(intent.upload_headers ?? {}),
      blobSize: fileBlob.size,
    });
  }

  let transferResponse: Response;
  try {
    transferResponse = await fetch(intent.upload_url, {
      method: "PUT",
      headers: intent.upload_headers,
      body: fileBlob,
    });
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[upload] transfer response", {
        ok: transferResponse.ok,
        status: transferResponse.status,
      });
    }
  } catch (error) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[upload] transfer network error", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
    throw new MediaUploadError("Unable to upload media file", "transfer", error);
  }

  if (!transferResponse.ok) {
    // Status + body'yi oku, S3/Minio ne diyor görelim.
    let bodyPreview = "";
    try {
      bodyPreview = (await transferResponse.text()).slice(0, 400);
    } catch {
      /* ignore */
    }
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[upload] transfer http error", {
        status: transferResponse.status,
        bodyPreview,
      });
    }
    throw new MediaUploadError(
      `Upload failed with status ${transferResponse.status}`,
      "transfer",
    );
  }

  onProgress?.({ phase: "complete" });

  try {
    const asset = await mediaApi.completeUpload(intent.upload_id, {
      etag: transferResponse.headers.get("etag") ?? undefined,
      checksum_sha256: source.checksumSha256,
    });
    return {
      asset,
      uploadId: intent.upload_id,
      objectKey: intent.object_key,
    };
  } catch (error) {
    throw new MediaUploadError("Unable to finalize media upload", "complete", error);
  }
}

type ExpoImagePickerAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  duration?: number | null;
};

type ExpoImagePickerResult = {
  canceled?: boolean;
  cancelled?: boolean;
  assets?: Array<ExpoImagePickerAsset> | null;
};

type ExpoImagePickerModule = {
  MediaTypeOptions: {
    Images: unknown;
    Videos: unknown;
  };
  requestMediaLibraryPermissionsAsync?: () => Promise<{ granted: boolean }>;
  launchImageLibraryAsync: (options: Record<string, unknown>) => Promise<ExpoImagePickerResult>;
  // Android: MainActivity sessizce öldürüldüğünde (MIUI task-killer) picker
  // seçimini geri kazanmak için. expo-image-picker'da standart API.
  getPendingResultAsync?: () => Promise<Array<ExpoImagePickerResult | { error?: unknown }>>;
};

type ExpoDocumentPickerModule = {
  getDocumentAsync: (options: Record<string, unknown>) => Promise<{
    canceled?: boolean;
    assets?: Array<{
      uri: string;
      name?: string;
      mimeType?: string;
      size?: number;
    }> | null;
  }>;
};

export function createExpoMediaPickerAdapter(deps: {
  imagePicker?: unknown;
  documentPicker?: unknown;
}): MediaPickerAdapter {
  const documentPicker = deps.documentPicker as
    | ExpoDocumentPickerModule
    | undefined;
  const imagePicker = deps.imagePicker as ExpoImagePickerModule | undefined;

  const ensureImagePicker = () => {
    if (!imagePicker) {
      throw new Error("Expo image picker is not configured");
    }
    return imagePicker;
  };

  const ensureDocumentPicker = () => {
    if (!documentPicker) {
      throw new Error("Expo document picker is not configured");
    }
    return documentPicker;
  };

  const mapAssets = (
    assets: Array<ExpoImagePickerAsset> | undefined,
  ): PickedMediaFile[] =>
    (assets ?? []).map((asset) => ({
      uri: asset.uri,
      name: asset.fileName ?? undefined,
      mimeType: asset.mimeType ?? undefined,
      sizeBytes: asset.fileSize ?? undefined,
      durationSec:
        typeof asset.duration === "number" ? Math.round(asset.duration / 1000) : undefined,
    }));

  // Android + MIUI özel: picker çalışırken MainActivity öldürülürse result
  // kaybolur ama sistem OnActivityResult'ı pending tutar. Bir sonraki launch
  // öncesi getPendingResultAsync ile kurtarıyoruz.
  const drainPendingResult = async (
    picker: ExpoImagePickerModule,
  ): Promise<PickedMediaFile[] | null> => {
    if (!picker.getPendingResultAsync) return null;
    try {
      const pending = await picker.getPendingResultAsync();
      const first = pending?.[0] as ExpoImagePickerResult | undefined;
      if (!first || "error" in (first as Record<string, unknown>)) return null;
      if (first.canceled || first.cancelled) return null;
      const assets = first.assets ?? undefined;
      if (!assets || assets.length === 0) return null;
      return mapAssets(assets);
    } catch {
      return null;
    }
  };

  return {
    async pickPhoto(options) {
      const picker = ensureImagePicker();

      // MIUI kill-recovery: önceki çağrıda MainActivity kill olduysa, pending
      // result burada gelir. Bu check'i fresh launch'tan ÖNCE yapıyoruz.
      const recovered = await drainPendingResult(picker);
      if (recovered && recovered.length > 0) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[picker] recovered pending result", recovered.length);
        }
        return recovered;
      }

      const permission = await picker.requestMediaLibraryPermissionsAsync?.();
      if (permission && permission.granted === false) {
        throw new Error(
          "Galeri izni verilmedi. Ayarlar → Uygulamalar → Naro → İzinler bölümünden fotoğraflara erişim aç.",
        );
      }

      const multiple = options?.multiple ?? false;
      // selectionLimit'i sadece multi-select modunda gönder; Android 12 MIUI
      // PhotoPicker'da `allowsMultipleSelection:false + selectionLimit:1`
      // kombinasyonu result.assets'i boş döndürüyordu.
      const launchOptions: Record<string, unknown> = {
        // expo-image-picker 16+: MediaTypeOptions deprecated → string literal array.
        mediaTypes: ["images"],
        allowsMultipleSelection: multiple,
        quality: options?.quality ?? 0.85,
      };
      if (multiple) {
        launchOptions.selectionLimit = options?.max ?? 1;
      }

      const result = await picker.launchImageLibraryAsync(launchOptions);

      // Tanılayıcı log — MIUI'da picker killed edilince sessizce boş dönüyordu.
      // Teyit sonrası çıkarılacak.
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[picker] result", {
          canceled: result.canceled ?? result.cancelled ?? null,
          assetsLen: result.assets?.length ?? 0,
        });
      }

      if (result.canceled || result.cancelled) {
        // MIUI kill sonrası tekrar bir drain deneyelim — bazen result cancel
        // olarak döner ama pending result asset'i tutabiliyor.
        const retryRecovered = await drainPendingResult(picker);
        if (retryRecovered && retryRecovered.length > 0) {
          return retryRecovered;
        }
        return [];
      }
      return mapAssets(result.assets ?? undefined);
    },
    async pickDocument(options) {
      const picker = ensureDocumentPicker();
      const result = await picker.getDocumentAsync({
        multiple: options?.multiple ?? false,
        type: options?.types ?? ["application/pdf"],
      });
      if (result.canceled) {
        return [];
      }
      return (result.assets ?? []).map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        sizeBytes: asset.size,
      }));
    },
    async pickVideo(options) {
      const picker = ensureImagePicker();
      await picker.requestMediaLibraryPermissionsAsync?.();
      const result = await picker.launchImageLibraryAsync({
        mediaTypes: picker.MediaTypeOptions.Videos,
        selectionLimit: 1,
        videoMaxDuration: options?.maxDurationSec,
      });
      if (result.canceled || result.cancelled) {
        return [];
      }
      return mapAssets(result.assets ?? undefined);
    },
    async recordAudio() {
      throw new Error("Audio recording adapter is not configured");
    },
  };
}
