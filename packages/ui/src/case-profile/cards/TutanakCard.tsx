import { FileBadge, FileText, ScrollText, ShieldCheck } from "lucide-react-native";
import { View } from "react-native";

import { Icon } from "../../Icon";
import { StatusChip } from "../../StatusChip";
import { Text } from "../../Text";
import { CollapsibleSection } from "../CollapsibleSection";

import type { CaseCard } from "./types";

const REPORT_METHOD_META: Record<
  string,
  { label: string; icon: typeof FileText; description: string }
> = {
  e_devlet: {
    label: "e-Devlet tutanağı",
    icon: ShieldCheck,
    description: "Anlaşmalı kaza tutanağı dijital iletiliyor.",
  },
  paper: {
    label: "Kağıt tutanak",
    icon: ScrollText,
    description: "Tutanak fotoğrafı yüklenmiş, metne dönüşecek.",
  },
  police: {
    label: "Polis / jandarma raporu",
    icon: FileText,
    description: "Ekip raporu ve numara paylaşıldı.",
  },
};

export const tutanakCard: CaseCard = {
  id: "tutanak",
  appliesTo: ["accident"],
  priority: 50,
  shouldShow: ({ caseItem }) => Boolean(caseItem.request.report_method),
  render: ({ caseItem }) => {
    const method = caseItem.request.report_method;
    if (!method) return null;
    const meta = REPORT_METHOD_META[method] ?? {
      label: method,
      icon: FileText,
      description: "Tutanak bilgisi paylaşıldı.",
    };
    return (
      <CollapsibleSection
        title="Tutanak"
        accent="#83a7ff"
        titleIcon={FileBadge}
        description="Resmi kayıt yöntemi"
        preview={<StatusChip label={meta.label} tone="info" />}
      >
        <View className="flex-row items-start gap-3 rounded-[14px] border border-app-outline bg-app-surface px-3 py-3">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-app-surface-2">
            <Icon icon={meta.icon} size={15} color="#83a7ff" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text variant="label" tone="inverse" className="text-[13px]">
              {meta.label}
            </Text>
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-muted text-[11px] leading-[16px]"
            >
              {meta.description}
            </Text>
          </View>
        </View>
      </CollapsibleSection>
    );
  },
};
