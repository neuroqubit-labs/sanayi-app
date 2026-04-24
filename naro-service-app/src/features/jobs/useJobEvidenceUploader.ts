import type { CaseAttachment, CaseAttachmentKind } from "@naro/domain";
import { useCallback } from "react";

import {
  type UploadedServiceMedia,
  useServiceMediaUpload,
} from "@/shared/media/useServiceMediaUpload";

import { useAddJobEvidence } from "./api.live";

const KIND_LABEL: Record<CaseAttachmentKind, string> = {
  photo: "Fotoğraf",
  video: "Video",
  audio: "Ses notu",
  invoice: "Fatura",
  report: "Rapor",
  document: "Belge",
  location: "Konum",
};

const DEFAULT_NOTE: Record<CaseAttachmentKind, string> = {
  photo: "Fotoğraf paylaşıldı.",
  video: "Video paylaşıldı.",
  audio: "Ses notu paylaşıldı.",
  invoice: "Fatura paylaşıldı.",
  report: "Rapor paylaşıldı.",
  document: "Belge paylaşıldı.",
  location: "Konum paylaşıldı.",
};

function buildAttachment(
  kind: CaseAttachmentKind,
  input: UploadedServiceMedia | null,
  note?: string,
): CaseAttachment | null {
  if (!input) {
    return null;
  }

  const subtitle =
    note?.trim() ||
    (kind === "video" && input.durationSec
      ? `${input.durationSec}s video`
      : kind === "audio"
        ? "Ses notu"
        : KIND_LABEL[kind]);

  return {
    id: input.asset.id,
    kind,
    title: input.name || KIND_LABEL[kind],
    subtitle,
    statusLabel: "Yüklendi",
    asset: input.asset,
  };
}

export function useJobEvidenceUploader(caseId: string, taskId?: string) {
  const addEvidence = useAddJobEvidence(caseId);
  const { isUploading, pickAndUpload } = useServiceMediaUpload();

  const uploadEvidence = useCallback(
    async (kind: "photo" | "video" | "audio" | "document", note?: string) => {
      if (!caseId) {
        return null;
      }

      const resolvedTaskId = taskId ?? "general";

      const uploaded = await pickAndUpload({
        purpose:
          kind === "video"
            ? "case_evidence_video"
            : kind === "audio"
              ? "case_evidence_audio"
              : "case_evidence_photo",
        ownerRef: `case:${caseId}:task:${resolvedTaskId}`,
        selection:
          kind === "photo"
            ? "photo"
            : kind === "video"
              ? "video"
              : kind === "audio"
                ? "audio"
                : "document",
        fallbackName: `${kind}-${Date.now()}${
          kind === "video" ? ".mp4" : kind === "audio" ? ".m4a" : ".jpg"
        }`,
        documentTypes:
          kind === "document" ? ["application/pdf", "image/*"] : undefined,
      });

      const attachment = buildAttachment(kind, uploaded, note);
      if (!attachment) {
        return null;
      }

      await addEvidence.mutateAsync({
        taskId: resolvedTaskId,
        attachment,
        note: note?.trim() || DEFAULT_NOTE[kind],
      });

      return attachment;
    },
    [addEvidence, caseId, pickAndUpload, taskId],
  );

  return {
    uploadEvidence,
    isUploading: isUploading || addEvidence.isPending,
  };
}
