import type { ServiceRequestDraft, ServiceRequestKind } from "@naro/domain";
import type { ReactElement } from "react";

export type ComposerStepKey =
  | "emergency_panel"
  | "accident_kind"
  | "accident_photos"
  | "report"
  | "documents"
  | "insurance"
  | "review"
  | "location"
  | "dropoff"
  | "timing"
  | "price"
  | "breakdown_category"
  | "breakdown_drivable"
  | "breakdown_detail"
  | "breakdown_media"
  | "breakdown_service"
  | "breakdown_review"
  | "breakdown_symptoms"
  | "maintenance_type"
  | "maintenance_items"
  | "maintenance_preference"
  | "maintenance_category"
  | "maintenance_detail"
  | "maintenance_media"
  | "maintenance_logistics"
  | "maintenance_review";

export type ComposerStepContext = {
  kind: ServiceRequestKind;
  draft: ServiceRequestDraft;
  updateDraft: (patch: Partial<ServiceRequestDraft>) => void;
  goNext: () => void;
};

export type ComposerStepRenderProps = ComposerStepContext;

export type ComposerStep = {
  key: ComposerStepKey;
  title: string;
  description?: string;
  /** Null means "ready to continue". Any string is the human-readable blocker. */
  validate: (draft: ServiceRequestDraft) => string | null;
  render: (props: ComposerStepRenderProps) => ReactElement;
  /** Mark the step as a hard-stop: next button swaps to a different label. */
  isTerminal?: boolean;
  /** Steps tagged as "info" show without validation blocking submit. */
  optional?: boolean;
  /** Hide the flow footer entirely (step owns its advance action). */
  hideFooter?: boolean;
};

export type ComposerFlow = {
  kind: ServiceRequestKind;
  eyebrow: string;
  title: string;
  description: string;
  steps: ComposerStep[];
  /** Progress variant for this flow. Defaults to "rail". */
  progressVariant?: "rail" | "bar";
  /** Override the footer primary label on the terminal step. */
  submitLabel?: string;
};
