import type { ServiceRequestDraft } from "@naro/domain";

export function summarizeServicePreferences(
  draft: ServiceRequestDraft,
  fallback: string,
): string {
  const parts: string[] = [];
  if (draft.on_site_repair) parts.push("Yerinde onarım");
  if (draft.valet_requested) parts.push("Vale servis");
  if (parts.length === 0) return fallback;
  return parts.join(" · ");
}
