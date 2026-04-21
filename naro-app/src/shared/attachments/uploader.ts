import { uploadAsset } from "@naro/mobile-core";

import { mediaApi } from "@/runtime";

import type { AttachmentUploadResult, AttachmentUploadTarget } from "./types";

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "—";
  }

  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${Math.round(kb)} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
}

function inferFilename(localUri: string, mimeType: string) {
  const direct = localUri.split("?")[0]?.split("/").pop();
  if (direct) {
    return direct;
  }

  const extension = mimeType.split("/")[1] ?? "bin";
  return `upload-${Date.now()}.${extension}`;
}

export async function uploadAttachment(params: {
  localUri: string;
  mimeType?: string;
  sizeBytes?: number;
  target: AttachmentUploadTarget;
  filename?: string;
}): Promise<AttachmentUploadResult> {
  const {
    localUri,
    mimeType = "application/octet-stream",
    sizeBytes = 0,
    target,
    filename,
  } = params;

  const uploaded = await uploadAsset({
    mediaApi,
    purpose: target.purpose,
    ownerRef: target.ownerRef,
    source: {
      uri: localUri,
      name: filename ?? inferFilename(localUri, mimeType),
      mimeType,
      sizeBytes,
    },
  });

  return {
    id: uploaded.asset.id,
    remoteUri: uploaded.asset.download_url ?? localUri,
    mimeType: uploaded.asset.mime_type,
    sizeLabel: formatSize(sizeBytes),
    asset: uploaded.asset,
  };
}
