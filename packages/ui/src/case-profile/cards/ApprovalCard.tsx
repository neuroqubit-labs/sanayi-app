import type { ServiceCase } from "@naro/domain";
import { ClipboardCheck, FileCheck2, Receipt } from "lucide-react-native";
import { View } from "react-native";

import { Icon } from "../../Icon";
import { StatusChip } from "../../StatusChip";
import { Text } from "../../Text";
import { TrustBadge } from "../../TrustBadge";
import { CollapsibleSection } from "../CollapsibleSection";

import type { CaseCard } from "./types";

const APPROVAL_KIND_META: Record<
  string,
  { label: string; icon: typeof Receipt; color: string }
> = {
  parts: { label: "Parça onayı", icon: ClipboardCheck, color: "#f5b33f" },
  invoice: { label: "Fatura onayı", icon: Receipt, color: "#2dd28d" },
  completion: { label: "Teslim onayı", icon: FileCheck2, color: "#0ea5e9" },
};

export const approvalCard: CaseCard = {
  id: "approval",
  appliesTo: "any",
  priority: 25,
  shouldShow: ({ caseItem }) => {
    const pending = caseItem.pending_approvals.filter(
      (a) => a.status === "pending",
    );
    return (
      pending.length > 0 ||
      caseItem.status === "parts_approval" ||
      caseItem.status === "invoice_approval"
    );
  },
  render: ({ caseItem, actor }) => {
    const pending = caseItem.pending_approvals.filter(
      (a) => a.status === "pending",
    );

    return (
      <CollapsibleSection
        title="Bekleyen karar"
        accent="#f5b33f"
        titleIcon={ClipboardCheck}
        description={
          actor === "customer"
            ? "Senin onayını bekleyen talepler"
            : "Müşteri onayında bekleyen talepler"
        }
        preview={
          pending.length > 0 ? (
            <View className="flex-row flex-wrap gap-1.5">
              {pending.slice(0, 2).map((a) => {
                const meta = APPROVAL_KIND_META[a.kind] ?? {
                  label: a.title,
                  icon: ClipboardCheck,
                  color: "#f5b33f",
                };
                return (
                  <StatusChip key={a.id} label={meta.label} tone="warning" />
                );
              })}
              {pending.length > 2 ? (
                <StatusChip
                  label={`+${pending.length - 2} daha`}
                  tone="neutral"
                />
              ) : null}
            </View>
          ) : (
            <TrustBadge label="Durum değişti" tone="info" />
          )
        }
      >
        <View className="gap-2">
          {pending.length === 0 ? (
            <View className="rounded-[14px] border border-app-outline bg-app-surface px-3 py-3">
              <Text
                variant="caption"
                tone="muted"
                className="text-app-text-muted text-[12px] leading-[17px]"
              >
                Bekleyen karar şu an yok — süreç bir sonraki eşiğe geçiyor.
              </Text>
            </View>
          ) : (
            pending.map((approval) => (
              <ApprovalRow
                key={approval.id}
                approval={approval}
                actor={actor}
              />
            ))
          )}
        </View>
      </CollapsibleSection>
    );
  },
};

function ApprovalRow({
  approval,
  actor,
}: {
  approval: ServiceCase["pending_approvals"][number];
  actor: "customer" | "technician";
}) {
  const meta = APPROVAL_KIND_META[approval.kind] ?? {
    label: approval.title,
    icon: ClipboardCheck,
    color: "#f5b33f",
  };
  return (
    <View className="gap-2 rounded-[16px] border border-app-warning/30 bg-app-warning-soft px-3 py-3">
      <View className="flex-row items-center gap-2.5">
        <View
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: `${meta.color}26` }}
        >
          <Icon icon={meta.icon} size={15} color={meta.color} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="label" tone="inverse" className="text-[13px]">
            {approval.title}
          </Text>
          <Text
            variant="caption"
            tone="muted"
            className="text-app-text-muted text-[11px]"
          >
            {approval.requested_at_label}
            {approval.amount_label ? ` · ${approval.amount_label}` : ""}
          </Text>
        </View>
      </View>

      {approval.description ? (
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[11px] leading-[16px]"
        >
          {approval.description}
        </Text>
      ) : null}

      {approval.line_items.length > 0 ? (
        <View className="gap-1">
          {approval.line_items.slice(0, 4).map((item) => (
            <View
              key={item.id}
              className="flex-row items-center justify-between gap-2 rounded-[10px] border border-app-outline bg-app-surface px-2.5 py-1.5"
            >
              <Text
                variant="caption"
                tone="inverse"
                className="flex-1 text-[11px]"
                numberOfLines={1}
              >
                {item.label}
              </Text>
              {item.value ? (
                <Text
                  variant="caption"
                  tone="accent"
                  className="text-[11px]"
                >
                  {item.value}
                </Text>
              ) : null}
            </View>
          ))}
          {approval.line_items.length > 4 ? (
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-subtle text-[10px]"
            >
              +{approval.line_items.length - 4} kalem daha
            </Text>
          ) : null}
        </View>
      ) : null}

      {approval.action_label ? (
        <Text
          variant="label"
          tone={actor === "customer" ? "warning" : "muted"}
          className="text-[11px]"
        >
          {actor === "customer" ? "Senin aksiyon" : "Müşteri bekliyor"}:{" "}
          {approval.action_label}
        </Text>
      ) : null}
    </View>
  );
}
