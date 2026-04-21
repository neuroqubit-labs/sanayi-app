import type { CaseAttachment } from "@naro/domain";
import { Icon, Text, TrustBadge } from "@naro/ui";
import {
  CheckCircle2,
  FileText,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, View } from "react-native";

import { useAttachmentPicker } from "@/shared/attachments";
import type { AttachmentDraft } from "@/shared/attachments";

export type DocumentPickerRowProps = {
  id: string;
  title: string;
  hint?: string;
  attachments: CaseAttachment[];
  ownerRef: string;
  onAdd: (drafts: AttachmentDraft[]) => void;
  onRemove: (attachmentId: string) => void;
  icon?: LucideIcon;
  required?: boolean;
};

export function DocumentPickerRow({
  id,
  title,
  hint,
  attachments,
  ownerRef,
  onAdd,
  onRemove,
  icon,
  required,
}: DocumentPickerRowProps) {
  const { pickDocument, status } = useAttachmentPicker({
    purpose: "case_attachment",
    ownerRef,
  });

  const owned = useMemo(
    () => attachments.filter((attachment) => attachment.id.startsWith(`${id}:`)),
    [attachments, id],
  );

  const hasAttachment = owned.length > 0;
  const busy = status === "picking" || status === "uploading";

  const handlePick = async () => {
    const picked = await pickDocument("document", title, {
      multiple: false,
      types: ["application/pdf", "image/*"],
    });
    if (picked.length === 0) return;
    const namespaced = picked.map((draft, index) => ({
      ...draft,
      id: `${id}:${draft.id}:${index}`,
    }));
    onAdd(namespaced);
  };

  // Fallback file picker (unused for now but exposed for future PDF uploads)
  void pickDocument;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} ekle`}
      onPress={hasAttachment ? undefined : handlePick}
      disabled={busy}
      className={[
        "flex-row items-center gap-3 rounded-[20px] border px-4 py-3.5 active:opacity-90",
        hasAttachment
          ? "border-app-success/30 bg-app-success-soft"
          : "border-app-outline bg-app-surface",
      ].join(" ")}
    >
      <View
        className={[
          "h-10 w-10 items-center justify-center rounded-full border",
          hasAttachment
            ? "border-app-success/40 bg-app-success-soft"
            : "border-app-outline bg-app-surface-2",
        ].join(" ")}
      >
        <Icon
          icon={icon ?? FileText}
          size={18}
          color={hasAttachment ? "#2dd28d" : "#83a7ff"}
        />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text variant="label" tone="inverse">
            {title}
          </Text>
          {required && !hasAttachment ? (
            <TrustBadge label="Gerekli" tone="warning" />
          ) : null}
        </View>
        {hint && !hasAttachment ? (
          <Text variant="caption" tone="muted" className="text-app-text-muted">
            {hint}
          </Text>
        ) : null}
        {hasAttachment ? (
          <Text variant="caption" tone="success">
            {owned[0]?.statusLabel ?? "Eklendi"}
          </Text>
        ) : null}
      </View>
      {hasAttachment ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title} kaldır`}
          onPress={(event) => {
            event.stopPropagation();
            for (const attachment of owned) {
              onRemove(attachment.id);
            }
          }}
          hitSlop={8}
          className="h-8 w-8 items-center justify-center rounded-full border border-app-outline bg-app-surface"
        >
          <Icon icon={X} size={14} color="#6f7b97" />
        </Pressable>
      ) : (
        <View className="h-8 w-8 items-center justify-center rounded-full border border-dashed border-app-outline bg-app-surface">
          <Icon icon={Plus} size={14} color="#83a7ff" />
        </View>
      )}
      {hasAttachment ? (
        <View className="h-5 w-5 items-center justify-center rounded-full bg-app-success/20">
          <Icon icon={CheckCircle2} size={12} color="#2dd28d" />
        </View>
      ) : null}
    </Pressable>
  );
}
