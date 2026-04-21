import type {
  MediaAsset,
  MediaDimensions,
  MediaOwnerKind,
  MediaPurpose,
  MediaPurposePolicy,
} from "@naro/domain";
import { getMediaPolicy, isMimeAllowed } from "@naro/domain";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  MediaApi,
  MediaFileSource,
  MediaPickerAdapter,
  MediaUploadProgress,
  MediaUploadResult,
  PickDocumentOptions,
  PickPhotoOptions,
  PickVideoOptions,
  PickedMediaFile,
  RecordAudioOptions,
} from "../media";
import { MediaUploadError, uploadAsset } from "../media";

import type { MediaCompressorAdapter } from "./compressor";

// ───────── Types ─────────

export type UploadPhase = MediaUploadProgress["phase"] | "validating" | "compressing";

export type UploadStatus =
  | "idle"
  | "picking"
  | "validating"
  | "compressing"
  | "intent"
  | "transfer"
  | "complete"
  | "ready"
  | "error"
  | "canceled";

export type UploadErrorCode =
  | "size_exceeded"
  | "mime_rejected"
  | "duration_exceeded"
  | "dimension_exceeded"
  | "prepare_failed"
  | "intent_failed"
  | "transfer_failed"
  | "complete_failed"
  | "canceled"
  | "unknown";

export type UploadValidationError = {
  code: UploadErrorCode;
  message: string;
};

export type UseMediaUploadDeps = {
  mediaApi: MediaApi;
  picker: MediaPickerAdapter;
  compressor?: MediaCompressorAdapter;
};

export type UploadInput = {
  purpose: MediaPurpose;
  ownerKind?: MediaOwnerKind;
  ownerId: string;
  source: MediaFileSource;
  dimensions?: MediaDimensions;
  durationSec?: number;
};

export type PickAndUploadInput = Omit<UploadInput, "source" | "dimensions" | "durationSec"> & {
  selection: "photo" | "video" | "document" | "audio";
  pickOptions?: PickPhotoOptions | PickVideoOptions | PickDocumentOptions | RecordAudioOptions;
  fallbackName?: string;
};

export type UploadSuccess = {
  result: MediaUploadResult;
  source: MediaFileSource;
  pick?: PickedMediaFile;
};

// ───────── Config ─────────

const RETRY_DELAYS_MS = [1000, 3000, 9000] as const;
const MAX_RETRY_ATTEMPTS = RETRY_DELAYS_MS.length;

// ───────── Validation (pure) ─────────

function validateSource(
  source: MediaFileSource,
  policy: MediaPurposePolicy,
  dimensions?: MediaDimensions,
  durationSec?: number,
): UploadValidationError | null {
  const size = source.sizeBytes ?? 0;
  if (size > policy.max_bytes) {
    return {
      code: "size_exceeded",
      message: `Dosya boyutu üst limiti aştı (${Math.round(size / 1024 / 1024)} MB > ${Math.round(policy.max_bytes / 1024 / 1024)} MB).`,
    };
  }

  const mime = source.mimeType ?? "application/octet-stream";
  if (!isMimeAllowed(policy, mime)) {
    return {
      code: "mime_rejected",
      message: `Bu dosya türü (${mime}) izinli değil.`,
    };
  }

  if (
    policy.max_duration_sec !== null &&
    typeof durationSec === "number" &&
    durationSec > policy.max_duration_sec
  ) {
    return {
      code: "duration_exceeded",
      message: `Süre üst limiti aştı (${durationSec}s > ${policy.max_duration_sec}s).`,
    };
  }

  return null;
}

// ───────── Hook ─────────

export type UseMediaUploadResult = {
  status: UploadStatus;
  progress: { phase: UploadPhase; attempt: number };
  error: UploadValidationError | null;
  upload: (input: UploadInput) => Promise<UploadSuccess | null>;
  pickAndUpload: (input: PickAndUploadInput) => Promise<UploadSuccess | null>;
  cancel: () => void;
  retry: () => Promise<UploadSuccess | null>;
  reset: () => void;
};

export function useMediaUpload(deps: UseMediaUploadDeps): UseMediaUploadResult {
  const { compressor, mediaApi, picker } = deps;

  const [status, setStatus] = useState<UploadStatus>("idle");
  const [phase, setPhase] = useState<UploadPhase>("intent");
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<UploadValidationError | null>(null);

  const lastInputRef = useRef<UploadInput | null>(null);
  const canceledRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const safeSet = useCallback(
    <T,>(setter: (value: T) => void, value: T) => {
      if (mountedRef.current) setter(value);
    },
    [],
  );

  const reset = useCallback(() => {
    canceledRef.current = false;
    lastInputRef.current = null;
    safeSet(setStatus, "idle");
    safeSet(setPhase, "intent");
    safeSet(setAttempt, 0);
    safeSet(setError, null);
  }, [safeSet]);

  const cancel = useCallback(() => {
    canceledRef.current = true;
    safeSet(setStatus, "canceled");
  }, [safeSet]);

  const runUploadAttempt = useCallback(
    async (
      input: UploadInput,
      policy: MediaPurposePolicy,
    ): Promise<MediaUploadResult> => {
      safeSet(setStatus, "intent");
      safeSet(setPhase, "intent");

      return await uploadAsset({
        mediaApi,
        purpose: input.purpose,
        ownerRef: input.ownerId,
        source: input.source,
        onProgress: (progress) => {
          if (canceledRef.current) return;
          const nextPhase = progress.phase;
          safeSet(setPhase, nextPhase);
          if (nextPhase === "intent") safeSet(setStatus, "intent");
          if (nextPhase === "transfer") safeSet(setStatus, "transfer");
          if (nextPhase === "complete") safeSet(setStatus, "complete");
        },
      }).catch((err) => {
        if (err instanceof MediaUploadError) {
          throw err;
        }
        throw new MediaUploadError("Unexpected upload failure", "transfer", err);
      });
    },
    [mediaApi, safeSet],
  );

  const upload = useCallback(
    async (input: UploadInput): Promise<UploadSuccess | null> => {
      canceledRef.current = false;
      lastInputRef.current = input;

      const policy = getMediaPolicy(input.purpose);

      // Validation
      safeSet(setStatus, "validating");
      safeSet(setPhase, "validating");
      const validationError = validateSource(
        input.source,
        policy,
        input.dimensions,
        input.durationSec,
      );
      if (validationError) {
        safeSet(setError, validationError);
        safeSet(setStatus, "error");
        return null;
      }

      // Compression (Faz 4 — opsiyonel, purpose foto ise + compressor varsa)
      let workingSource = input.source;
      let workingDimensions = input.dimensions;
      if (
        compressor &&
        policy.max_dimension_px !== null &&
        (input.source.mimeType ?? "").startsWith("image/")
      ) {
        try {
          safeSet(setStatus, "compressing");
          safeSet(setPhase, "compressing");
          const compressed = await compressor.compressImage(input.source, {
            maxDimensionPx: policy.max_dimension_px,
            mimeType: input.source.mimeType,
          });
          workingSource = compressed;
          if (compressed.dimensions) {
            workingDimensions = compressed.dimensions;
          }
        } catch {
          // Compression failure should not block upload; proceed with original.
          workingSource = input.source;
        }
      }

      const attemptedInput: UploadInput = {
        ...input,
        source: workingSource,
        dimensions: workingDimensions,
      };

      safeSet(setError, null);

      for (let tryNo = 0; tryNo <= MAX_RETRY_ATTEMPTS; tryNo += 1) {
        if (canceledRef.current) {
          safeSet(setError, { code: "canceled", message: "Yükleme iptal edildi." });
          return null;
        }
        safeSet(setAttempt, tryNo);

        try {
          const result = await runUploadAttempt(attemptedInput, policy);
          if (canceledRef.current) return null;
          safeSet(setStatus, "ready");
          return {
            result,
            source: workingSource,
          };
        } catch (err) {
          if (canceledRef.current) {
            safeSet(setError, { code: "canceled", message: "Yükleme iptal edildi." });
            return null;
          }

          if (tryNo >= MAX_RETRY_ATTEMPTS) {
            const code: UploadErrorCode =
              err instanceof MediaUploadError
                ? ((
                    {
                      prepare: "prepare_failed",
                      intent: "intent_failed",
                      transfer: "transfer_failed",
                      complete: "complete_failed",
                    } as const
                  )[err.kind] ?? "unknown")
                : "unknown";
            safeSet(setError, {
              code,
              message:
                err instanceof Error ? err.message : "Yükleme başarısız oldu.",
            });
            safeSet(setStatus, "error");
            return null;
          }

          const delay = RETRY_DELAYS_MS[tryNo] ?? 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      return null;
    },
    [compressor, runUploadAttempt, safeSet],
  );

  const pickAndUpload = useCallback(
    async (input: PickAndUploadInput): Promise<UploadSuccess | null> => {
      safeSet(setStatus, "picking");
      safeSet(setError, null);

      let picks: PickedMediaFile[];
      try {
        if (input.selection === "photo") {
          picks = await picker.pickPhoto(input.pickOptions as PickPhotoOptions);
        } else if (input.selection === "video") {
          picks = await picker.pickVideo(input.pickOptions as PickVideoOptions);
        } else if (input.selection === "document") {
          picks = await picker.pickDocument(input.pickOptions as PickDocumentOptions);
        } else {
          picks = await picker.recordAudio(
            input.pickOptions as RecordAudioOptions,
          );
        }
      } catch (err) {
        safeSet(setError, {
          code: "prepare_failed",
          message: err instanceof Error ? err.message : "Dosya seçilemedi.",
        });
        safeSet(setStatus, "error");
        return null;
      }

      const pick = picks[0];
      if (!pick) {
        safeSet(setStatus, "idle");
        return null;
      }

      const result = await upload({
        purpose: input.purpose,
        ownerKind: input.ownerKind,
        ownerId: input.ownerId,
        source: {
          uri: pick.uri,
          name: pick.name ?? input.fallbackName,
          mimeType: pick.mimeType,
          sizeBytes: pick.sizeBytes,
        },
        durationSec: pick.durationSec,
      });

      if (!result) return null;
      return { ...result, pick };
    },
    [picker, safeSet, upload],
  );

  const retry = useCallback(async (): Promise<UploadSuccess | null> => {
    if (!lastInputRef.current) return null;
    return upload(lastInputRef.current);
  }, [upload]);

  return useMemo<UseMediaUploadResult>(
    () => ({
      status,
      progress: { phase, attempt },
      error,
      upload,
      pickAndUpload,
      cancel,
      retry,
      reset,
    }),
    [
      status,
      phase,
      attempt,
      error,
      upload,
      pickAndUpload,
      cancel,
      retry,
      reset,
    ],
  );
}

// ───────── Helper: asset alanları ownerKind+ownerId'i server'a yansıtmak için ─────────

export type MediaAssetDraft = Pick<
  MediaAsset,
  "id" | "purpose" | "mime_type" | "size_bytes" | "download_url" | "preview_url"
>;
