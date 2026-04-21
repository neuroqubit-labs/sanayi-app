import { ShieldCheck, ShieldQuestion } from "lucide-react-native";
import { View } from "react-native";

import { Icon } from "../../Icon";
import { StatusChip } from "../../StatusChip";
import { Text } from "../../Text";
import { CollapsibleSection } from "../CollapsibleSection";

import type { CaseCard } from "./types";

export const kaskoCard: CaseCard = {
  id: "kasko",
  appliesTo: ["accident", "towing"],
  priority: 60,
  shouldShow: ({ caseItem }) => {
    const d = caseItem.request;
    return Boolean(d.kasko_selected || d.sigorta_selected);
  },
  render: ({ caseItem }) => {
    const d = caseItem.request;
    const hasKasko = Boolean(d.kasko_selected);
    const hasTrafik = Boolean(d.sigorta_selected);

    return (
      <CollapsibleSection
        title="Sigorta"
        accent="#2dd28d"
        titleIcon={ShieldCheck}
        description="Kasko ve trafik poliçesi durumu"
        preview={
          <View className="flex-row flex-wrap gap-1.5">
            {hasKasko ? (
              <StatusChip
                label={`Kasko${d.kasko_brand ? ` · ${d.kasko_brand}` : ""}`}
                tone="success"
              />
            ) : null}
            {hasTrafik ? (
              <StatusChip
                label={`Trafik${d.sigorta_brand ? ` · ${d.sigorta_brand}` : ""}`}
                tone="info"
              />
            ) : null}
          </View>
        }
      >
        <View className="gap-2">
          {hasKasko ? (
            <SigortaRow
              label="Kasko"
              brand={d.kasko_brand ?? null}
              note="Hasar onarımı kasko üstünden yürür."
            />
          ) : null}
          {hasTrafik ? (
            <SigortaRow
              label="Trafik sigortası"
              brand={d.sigorta_brand ?? null}
              note="Karşı taraf hasarı için referans."
            />
          ) : null}
          {!hasKasko && !hasTrafik ? (
            <View className="flex-row items-start gap-3 rounded-[14px] border border-app-outline bg-app-surface px-3 py-2.5">
              <Icon icon={ShieldQuestion} size={14} color="#83a7ff" />
              <Text
                variant="caption"
                tone="muted"
                className="flex-1 text-app-text-muted text-[11px]"
              >
                Sigorta bilgisi paylaşılmamış.
              </Text>
            </View>
          ) : null}
        </View>
      </CollapsibleSection>
    );
  },
};

function SigortaRow({
  label,
  brand,
  note,
}: {
  label: string;
  brand: string | null;
  note: string;
}) {
  return (
    <View className="flex-row items-start gap-3 rounded-[14px] border border-app-outline bg-app-surface px-3 py-2.5">
      <View className="h-8 w-8 items-center justify-center rounded-full bg-app-success/15">
        <Icon icon={ShieldCheck} size={13} color="#2dd28d" />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text variant="label" tone="inverse" className="text-[13px]">
            {label}
          </Text>
          {brand ? (
            <Text
              variant="caption"
              tone="muted"
              className="text-app-text-subtle text-[11px]"
            >
              {brand}
            </Text>
          ) : null}
        </View>
        <Text
          variant="caption"
          tone="muted"
          className="text-app-text-muted text-[11px] leading-[16px]"
        >
          {note}
        </Text>
      </View>
    </View>
  );
}
