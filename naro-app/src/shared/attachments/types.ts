import type {
  CaseAttachment,
  CaseAttachmentKind,
  MediaAsset,
  MediaPurpose,
} from "@naro/domain";

export type AttachmentDraft = CaseAttachment & {
  localUri?: string;
  remoteUri?: string;
  mimeType?: string;
  sizeLabel?: string;
  capturedAt?: string;
  asset?: MediaAsset | null;
};

export type AttachmentUploadTarget = {
  purpose: MediaPurpose;
  ownerRef: string;
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

export type AttachmentUploadResult = {
  id: string;
  remoteUri: string;
  mimeType: string;
  sizeLabel: string;
  asset: MediaAsset;
};

export type AttachmentKindLabelMap = Record<CaseAttachmentKind, string>;

export const ATTACHMENT_KIND_LABEL: AttachmentKindLabelMap = {
  photo: "Fotoğraf",
  video: "Video",
  audio: "Ses kaydı",
  invoice: "Fatura",
  report: "Rapor",
  document: "Belge",
  location: "Konum",
};

export type PickVideoOptions = {
  maxDurationSec?: number;
};

export type RecordAudioOptions = {
  maxDurationSec?: number;
};
